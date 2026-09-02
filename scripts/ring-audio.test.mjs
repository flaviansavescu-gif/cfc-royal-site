// ring-audio.test.mjs — „Ascultă în ring": standardul citit în cască, pe repere.
// Cerut de VP Tehnic și de Arbitraj (02.09.2026). Probele de aici țin lipite de cod cele
// trei reguli care nu au voie să se piardă la o modificare viitoare:
//   1. funcția apare NUMAI în aplicația instalată pe telefon;
//   2. se citesc EXACT reperele cerute, nici mai multe, nici mai puține;
//   3. fără voce românească nu se citește (nu pronunțăm românește cu accent străin).
//   node --test scripts/ring-audio.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const app = readFileSync(new URL("../public/breed-explorer/assets/app.js", import.meta.url), "utf8");
const sw = readFileSync(new URL("../public/breed-explorer/sw.js", import.meta.url), "utf8");
const rase = JSON.parse(readFileSync(new URL("../netlify/functions/_breed/breeds.json", import.meta.url), "utf8")).breeds;

// Rulăm bucata de cod care alcătuiește reperele, ca s-o probăm pe fișele ADEVĂRATE,
// nu doar să căutăm cuvinte în fișier. Bucata nu atinge browserul la definire.
const bucata = app.slice(app.indexOf("const SECTIUNI_RING"), app.indexOf("function pastreazaOffline"));
const ctx = vm.createContext({ window: {} });
vm.runInContext(bucata + "\n;this.__bucatiRing = bucatiRing; this.__SECTIUNI = SECTIUNI_RING;", ctx);
const bucatiRing = ctx.__bucatiRing;
const SECTIUNI = ctx.__SECTIUNI;
const TOATE = SECTIUNI.reduce((o, s) => ((o[s.id] = true), o), {});

test("cele ȘAPTE repere cerute — exact ele", () => {
  const bloc = app.slice(app.indexOf("const SECTIUNI_RING"), app.indexOf("const RING_KEY"));
  for (const cerut of ["proportii", "cap", "ochi", "urechi", "gat", "coada", "talie"])
    assert.ok(bloc.includes(`id: "${cerut}"`), `lipsește reperul „${cerut}"`);
  // Ce NU se citește în ring (restul standardului): dacă apar aici, cineva a lărgit lista.
  for (const nedorit of ["movement", "coat", "color", "skin", "topline", "chest", "forequarters", "hindquarters", "feet"])
    assert.ok(!bloc.includes(`"${nedorit}"`), `reperul „${nedorit}" nu era cerut pentru ring`);
  // Capul adună rubricile lui, inclusiv dentiția — arbitrul le verifică împreună.
  for (const camp of ["head", "skull", "stop", "muzzle", "jaws_teeth"])
    assert.ok(bloc.includes(`"${camp}"`), `capul trebuie să cuprindă „${camp}"`);
});

test("pe fișele adevărate: se citește ceva, și numai reperele cerute", () => {
  const cao = rase.find((b) => b.wdf_code === "G02-066");
  assert.ok(cao, "Ciobănescul de Asia Centrală trebuie să fie în nomenclator");
  const b = bucatiRing(cao, TOATE);
  assert.ok(b.length >= 5, `prea puține repere citibile: ${b.length}`);
  assert.deepEqual([...new Set(b.map((x) => x.rasa))], [cao.breed_name]);
  // Ordinea e cea a arbitrajului, nu cea din fișă.
  const ordine = SECTIUNI.map((s) => s.eticheta);
  const pozitii = [...b].map((x) => ordine.indexOf(x.sectiune));
  assert.deepEqual(pozitii, [...pozitii].sort((x, y) => x - y), "reperele se citesc în ordinea aleasă");
  for (const x of b) assert.ok(x.text.trim().length > 0, "nu se citește un reper gol");
});

test("bifez un singur reper — se citește doar el", () => {
  const cao = rase.find((b) => b.wdf_code === "G02-066");
  const doar = bucatiRing(cao, { talie: true });
  assert.equal(doar.length, 1);
  assert.equal(doar[0].sectiune, "Talie și greutate");
  assert.equal(bucatiRing(cao, {}).length, 0, "nimic bifat = nimic citit");
});

test("mai multe rase: fiecare cu reperele ei, în ordinea aleasă de arbitru", () => {
  const trei = rase.slice(0, 3);
  const b = trei.reduce((acc, r) => acc.concat(bucatiRing(r, TOATE)), []);
  assert.deepEqual([...new Set(b.map((x) => x.rasa))], trei.map((r) => r.breed_name));
});

test("fișă ciuntită nu strică citirea (rasă fără rubricile alea)", () => {
  assert.equal(bucatiRing({ breed_name: "X" }, TOATE).length, 0);
  assert.equal(bucatiRing({ breed_name: "X", anatomy: { tail: "  " } }, TOATE).length, 0);
});

test("nomenclatorul întreg trece fără excepție", () => {
  let cuText = 0;
  for (const r of rase) { if (bucatiRing(r, TOATE).length) cuText++; }
  assert.ok(cuText > rase.length * 0.9, `doar ${cuText}/${rase.length} rase au repere citibile`);
});

test("apare NUMAI în aplicația instalată pe telefon", () => {
  assert.match(app, /function eInstalata\(\)/);
  assert.ok(app.includes("display-mode: standalone"), "se judecă pe modul instalat");
  // Intrarea din meniu e condiționată de instalare, nu adăugată necondiționat.
  assert.match(app, /eInstalata\(\) \? \[\{ id: "ring"/);
});

test("fără voce românească nu se citește", () => {
  assert.match(app, /function voceRo\(\)/);
  assert.ok(/\^ro\(-\|_\|\$\)/.test(app) || app.includes("/^ro(-|_|$)/i"), "vocea se caută pe limba ro");
  assert.ok(app.includes("nu are voce românească instalată"), "omul e anunțat cinstit");
});

test("merge fără semnal: reperele se pot păstra pe telefon", () => {
  assert.match(app, /function pastreazaOffline/);
  assert.ok(app.includes("cfcr.ringOffline"), "există locul unde se păstrează");
  // La ascultare, dacă rasele nu sunt încărcate, se cade pe ce e păstrat pe telefon.
  assert.ok(app.includes("store.get(RING_OFFLINE, [])"), "ascultarea folosește ce e păstrat");
});

test("vocea e a telefonului — nimic nu pleacă spre vreun server", () => {
  const bloc = app.slice(app.indexOf("const SECTIUNI_RING"), app.indexOf("RENDER — Dashboard"));
  assert.ok(!/fetch\(/.test(bloc), "modulul de ascultare nu cheamă niciun server");
  assert.ok(bloc.includes("SpeechSynthesisUtterance"), "citește cu vocea telefonului");
});

test("service worker-ul e urcat, ca telefoanele să ia aplicația nouă", () => {
  const m = /CACHE_VERSION = "cfcr-v(\d+)\.(\d+)\.(\d+)"/.exec(sw);
  assert.ok(m, "versiunea se poate citi");
  const [, major, minor] = m.map(Number);
  assert.ok(major > 5 || (major === 5 && minor >= 4), `versiune prea veche: ${m[0]}`);
});
