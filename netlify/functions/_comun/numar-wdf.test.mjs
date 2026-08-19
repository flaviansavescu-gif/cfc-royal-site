// Probe pentru alocarea atomică a numărului WDF de cuib (SEC-002).
//
// Cursă TOCTOU reparată: înainte, `wdf/<cand>` se scria necondiționat (get-then-set), deci
// două atribuiri simultane puteau bate ACELAȘI număr WDF permanent pe două cuiburi. Acum
// rezervarea folosește `onlyIfNew: true` — verificarea și scrierea sunt aceeași faptă.
//
// Netlify Blobs nu e disponibil în probe și logica e inline în handler, așa că testăm
// (1) semantica `onlyIfNew` pe o magazie falsă, reproducând bucla de alocare, și (2) că
// sursa reală folosește chiar acest mecanism (blocaj împotriva unei regresii viitoare).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ——— Magazie falsă cu semantica reală a lui onlyIfNew ———
function magazieFalsa() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async setJSON(k, v, opts = {}) {
      if (opts.onlyIfNew && m.has(k)) return { modified: false }; // cheia există deja: pierde
      m.set(k, v);
      return { modified: true };
    },
    _map: m,
  };
}

// Copie fidelă a buclei de alocare din registru-pedigree.mjs (varianta reparată).
async function alocaWDF(s, serie, WDF_ULTIMUL_PE_HARTIE = 76) {
  let numarWDF = null;
  for (let i = 0; i < 30; i++) {
    const c = await s.get("contor/wdf");
    const urm = Math.max(c?.ultim || 0, WDF_ULTIMUL_PE_HARTIE) + 1;
    const cand = "WDF-" + String(urm).padStart(4, "0");
    await s.setJSON("contor/wdf", { ultim: urm });
    let alMeu = false;
    try {
      const r = await s.setJSON("wdf/" + cand, { serie, rezervat: "t" }, { onlyIfNew: true });
      alMeu = r?.modified !== false;
    } catch { /* ignora */ }
    if (alMeu) { numarWDF = cand; break; }
  }
  return numarWDF;
}

test("SEC-002: două atribuiri concurente NU pot primi același număr WDF", async () => {
  const s = magazieFalsa();
  // Ambele pornesc de la același contor (77 = primul după hârtie), ca într-o cursă reală.
  const [a, b] = await Promise.all([alocaWDF(s, "CFCR-P-2026-0001"), alocaWDF(s, "CFCR-P-2026-0002")]);
  assert.ok(a && b, "ambele trebuie să obțină un număr");
  assert.notEqual(a, b, "COLIZIUNE: același număr WDF pe două cuiburi");
});

test("SEC-002: al doilea candidat pe o cheie ocupată primește modified:false", async () => {
  const s = magazieFalsa();
  const r1 = await s.setJSON("wdf/WDF-0078", { serie: "X" }, { onlyIfNew: true });
  const r2 = await s.setJSON("wdf/WDF-0078", { serie: "Y" }, { onlyIfNew: true });
  assert.equal(r1.modified, true);
  assert.equal(r2.modified, false);
  assert.equal((await s.get("wdf/WDF-0078")).serie, "X", "primul rămâne, nu e suprascris");
});

test("SEC-002: 12 alocări în paralel dau 12 numere distincte", async () => {
  // 12 e mult sub plafonul de 30 de reîncercări, deci nimeni nu epuizează bucla; ce
  // demonstrează testul e că onlyIfNew face imposibile DUPLICATELE, nu debitul.
  const s = magazieFalsa();
  const rez = await Promise.all(Array.from({ length: 12 }, (_, i) => alocaWDF(s, "S" + i)));
  assert.ok(rez.every(Boolean), "toate au primit un număr");
  assert.equal(new Set(rez).size, 12, "există numere WDF duplicate");
});

// ——— Blocaj pe sursa reală: blocul WDF folosește onlyIfNew, nu scriere necondiționată ———
test("SEC-002: sursa reală rezervă wdf/<cand> cu onlyIfNew și tratează coliziunea", () => {
  const FN = fileURLToPath(new URL("..", import.meta.url));
  const src = readFileSync(FN + "registru-pedigree.mjs", "utf8");
  // Regexul cu `[^)]*` ar sări peste parantezul din `toISOString()`; verificăm pe linie.
  const liniaWdf = src.split("\n").find((l) => l.includes('setJSON("wdf/" + cand') && l.includes("onlyIfNew: true"));
  assert.ok(liniaWdf, "rezervarea WDF trebuie să fie atomică (onlyIfNew pe wdf/<cand>)");
  assert.match(src, /alMeu = r\?\.modified !== false/, "coliziunea (modified:false) trebuie tratată");
  // și că NU a mai rămas vechea scriere necondiționată pe wdf/
  assert.ok(!/await s\.setJSON\("wdf\/" \+ cand, \{ serie: d\.serie, rezervat: new Date\(\)\.toISOString\(\) \}\);/.test(src),
    "a rămas o scriere WDF necondiționată (get-then-set)");
});
