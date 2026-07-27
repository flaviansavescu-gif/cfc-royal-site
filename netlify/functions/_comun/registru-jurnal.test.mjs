// Teste pentru jurnalul de audit al registrului.
//
// Ce contează aici nu e că se scriu rânduri, ci că jurnalul rezistă exact în situațiile
// pentru care există: două fapte în aceeași clipă, o ștergere care nu poate fi
// consemnată, și un cod de acces care n-are voie să ajungă în probă.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FAPTE, actorJurnal, actorExtern, jurnalizeaza, jurnalizeazaObligatoriu,
  citesteJurnal, filtreaza, luniDinChei,
} from "./registru-jurnal.mjs";

/** Magazie de probă: ține cheile în memorie, ca stocarea reală. */
function magazie({ scrieEsueaza = false } = {}) {
  const date = new Map();
  return {
    date,
    async setJSON(cheie, val) {
      if (scrieEsueaza) throw new Error("magazie indisponibilă");
      date.set(cheie, JSON.parse(JSON.stringify(val)));
    },
    async get(cheie) { return date.has(cheie) ? date.get(cheie) : null; },
    async list({ prefix } = {}) {
      return { blobs: [...date.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((key) => ({ key })) };
    },
  };
}

test("o intrare = un blob, deci două fapte simultane nu se suprascriu", async () => {
  const s = magazie();
  await Promise.all([
    jurnalizeaza(s, { fapta: "dmf-depus", actor: actorJurnal({ rol: "admin" }), obiect: "CFCR-DMF-2026-0001" }),
    jurnalizeaza(s, { fapta: "dmf-depus", actor: actorJurnal({ rol: "admin" }), obiect: "CFCR-DMF-2026-0002" }),
    jurnalizeaza(s, { fapta: "dmf-depus", actor: actorJurnal({ rol: "admin" }), obiect: "CFCR-DMF-2026-0003" }),
  ]);
  assert.equal(s.date.size, 3, "toate cele trei fapte trebuie să existe separat");
});

test("cheia poartă luna, ca citirea să nu ceară tot istoricul", async () => {
  const s = magazie();
  await jurnalizeaza(s, { fapta: "dmf-depus", actor: actorJurnal({ rol: "admin" }), obiect: "X" });
  const cheie = [...s.date.keys()][0];
  const luna = new Date().toISOString().slice(0, 7);
  assert.ok(cheie.startsWith(`jurnal/${luna}/`), `cheia ${cheie} trebuie să înceapă cu jurnal/${luna}/`);
});

test("o faptă necunoscută nu se scrie — lista e închisă", async () => {
  const s = magazie();
  const scris = await jurnalizeaza(s, { fapta: "ceva-inventat", actor: actorJurnal({ rol: "admin" }) });
  assert.equal(scris, false);
  assert.equal(s.date.size, 0);
});

test("scrierea eșuată NU aruncă: fapta deja reușită nu devine eroare pentru om", async () => {
  const s = magazie({ scrieEsueaza: true });
  const scris = await jurnalizeaza(s, { fapta: "dmf-depus", actor: actorJurnal({ rol: "admin" }), obiect: "X" });
  assert.equal(scris, false);
});

test("pentru fapte distructive, scrierea eșuată ARUNCĂ — apelantul trebuie să renunțe", async () => {
  const s = magazie({ scrieEsueaza: true });
  await assert.rejects(
    () => jurnalizeazaObligatoriu(s, { fapta: "dmf-sters", actor: actorJurnal({ rol: "admin" }), obiect: "X" }),
    /magazie indisponibilă/,
  );
});

test("actorul nu poartă niciodată codul de acces", async () => {
  const s = magazie();
  const eu = {
    rol: "registratura",
    registrator: { id: "abc", nume: "Ana Popescu", cod: "REG-SECRETSECRET", email: "ana@example.com" },
  };
  await jurnalizeaza(s, {
    fapta: "dmf-respins", actor: actorJurnal(eu), obiect: "CFCR-DMF-2026-0001", detalii: "motiv oarecare",
  });
  const brut = JSON.stringify([...s.date.values()]);
  assert.ok(!brut.includes("REG-SECRETSECRET"), "codul nu are ce căuta în jurnal");
  assert.ok(brut.includes("Ana Popescu"), "numele, în schimb, trebuie să apară");
});

test("actorul extern e proprietarul masculului, cu numele scris de el", () => {
  assert.deepEqual(actorExtern("John Smith"), { rol: "extern", nume: "John Smith" });
  assert.equal(actorExtern("").nume, "proprietar mascul");
});

test("eticheta se ia din lista de fapte, ca să nu se scrie coduri în interfață", async () => {
  const s = magazie();
  await jurnalizeaza(s, { fapta: "certificat-emis", actor: actorJurnal({ rol: "admin" }), obiect: "X" });
  const x = [...s.date.values()][0];
  assert.equal(x.eticheta, FAPTE["certificat-emis"]);
});

test("citirea întoarce cea mai nouă faptă prima", async () => {
  const s = magazie();
  for (const serie of ["A", "B", "C"]) {
    await jurnalizeaza(s, { fapta: "dmf-depus", actor: actorJurnal({ rol: "admin" }), obiect: serie });
    await new Promise((r) => setTimeout(r, 2));   // ca marca de timp să difere
  }
  const { intrari } = await citesteJurnal(s);
  assert.equal(intrari.length, 3);
  assert.equal(intrari[0].obiect, "C");
  assert.equal(intrari[2].obiect, "A");
});

test("citirea unei luni fără fapte nu amestecă alte luni", async () => {
  const s = magazie();
  await jurnalizeaza(s, { fapta: "dmf-depus", actor: actorJurnal({ rol: "admin" }), obiect: "A" });
  const { intrari, luni } = await citesteJurnal(s, { luna: "2001-01" });
  assert.equal(intrari.length, 0);
  assert.ok(luni.includes("2001-01"), "luna cerută rămâne în listă chiar dacă e goală");
});

test("filtrarea merge pe faptă și pe text liber", () => {
  const intrari = [
    { fapta: "dmf-depus", eticheta: "Declarație depusă", actor: { nume: "Ion", rol: "membru" }, obiect: "CFCR-DMF-2026-0001", detalii: "Ciobănesc" },
    { fapta: "cod-sters", eticheta: "Acces revocat", actor: { nume: "Administrator", rol: "admin" }, obiect: "Maria", detalii: "" },
  ];
  assert.equal(filtreaza(intrari, { fapta: "cod-sters" }).length, 1);
  assert.equal(filtreaza(intrari, { cauta: "ciobănesc" }).length, 1);
  assert.equal(filtreaza(intrari, { cauta: "MARIA" }).length, 1);
  assert.equal(filtreaza(intrari, { cauta: "inexistent" }).length, 0);
  assert.equal(filtreaza(intrari, {}).length, 2);
});

test("lunile se scot din chei, cele mai noi întâi", () => {
  assert.deepEqual(
    luniDinChei(["jurnal/2026-05/x", "jurnal/2026-07/y", "jurnal/2026-05/z", "altceva/2026-01/q"]),
    ["2026-07", "2026-05"],
  );
});

test("textele lungi se taie, ca o intrare să nu poată umple magazia", async () => {
  const s = magazie();
  await jurnalizeaza(s, {
    fapta: "dmf-respins",
    actor: actorJurnal({ rol: "admin" }),
    obiect: "x".repeat(500),
    detalii: "y".repeat(5000),
  });
  const x = [...s.date.values()][0];
  assert.equal(x.obiect.length, 120);
  assert.equal(x.detalii.length, 400);
});
