// Teste pentru sursa unică de roluri. Rulează cu:
//   node --test netlify/functions/_comun/roluri.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  sha256, egal, ADMIN_HASH, ACCES_HASH, LECTORI,
  actorDinCod, rolLaIntrare, grupeLector, lectoriCuGrupe, TOATE_GRUPELE,
} from "./roluri.mjs";

test("sha256 dă valoarea cunoscută", () => {
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("egal compară corect, inclusiv lungimi diferite", () => {
  assert.equal(egal("abc", "abc"), true);
  assert.equal(egal("abc", "abd"), false);
  assert.equal(egal("abc", "abcd"), false); // nu aruncă la lungimi diferite
  assert.equal(egal("", ""), true);
  assert.equal(egal(null, undefined), true); // ambele devin ""
});

test("un cod greșit nu primește niciun rol", () => {
  assert.equal(actorDinCod("cod-inexistent-oarecare"), null);
  assert.equal(actorDinCod(""), null);
  assert.equal(actorDinCod(null), null);
  assert.equal(rolLaIntrare("cod-inexistent-oarecare"), null);
});

// GARDA CENTRALĂ: codul COMUN de candidați nu trebuie să fie recunoscut niciodată
// de actorDinCod — altfel `cereLector` (PAA/JCR) l-ar accepta ca lector.
test("codul comun de candidați NU poate deveni admin sau lector", () => {
  const amprenteDePutere = [ADMIN_HASH, ...LECTORI.map((l) => l.hash)];
  assert.equal(amprenteDePutere.includes(ACCES_HASH), false,
    "amprenta codului comun nu are voie să apară printre cele cu drepturi de administrare");
});

test("amprentele sunt distincte între ele", () => {
  const toate = [ADMIN_HASH, ACCES_HASH, ...LECTORI.map((l) => l.hash)];
  assert.equal(new Set(toate).size, toate.length, "două roluri nu pot avea aceeași amprentă");
});

test("toate amprentele au forma unui SHA-256", () => {
  for (const h of [ADMIN_HASH, ACCES_HASH, ...LECTORI.map((l) => l.hash)])
    assert.match(h, /^[a-f0-9]{64}$/);
});

test("slug-urile lectorilor sunt unice", () => {
  const s = LECTORI.map((l) => l.slug);
  assert.equal(new Set(s).size, s.length);
});

test("competențele pe grupe: All Breed = toate cele 10", () => {
  assert.deepEqual(grupeLector("flavian-savescu"), TOATE_GRUPELE);
  assert.equal(grupeLector("mihail-cosmin-neagu").length, 10);
});

test("competențele pe grupe: lectori cu grupe limitate", () => {
  assert.deepEqual(grupeLector("andreea-daniela-popescu"), [3, 5, 9]);
  assert.deepEqual(grupeLector("alexandru-paul-ciolac"), [2, 3, 4, 6, 8]);
});

test("un slug inexistent nu primește nicio grupă", () => {
  assert.deepEqual(grupeLector("cineva-care-nu-exista"), []);
});

test("grupeLector întoarce o copie (nu se poate altera lista sursă)", () => {
  const a = grupeLector("andreea-daniela-popescu");
  a.push(99);
  assert.deepEqual(grupeLector("andreea-daniela-popescu"), [3, 5, 9]);
});

test("lectoriCuGrupe: 6 lectori, 4 All Breed, grupe valide", () => {
  const l = lectoriCuGrupe();
  assert.equal(l.length, 6);
  assert.equal(l.filter((x) => x.allBreed).length, 4);
  for (const x of l) {
    assert.ok(x.slug && x.nume, "fiecare lector are slug și nume");
    assert.ok(x.grupe.length >= 1, "fiecare lector acoperă cel puțin o grupă");
    for (const g of x.grupe) assert.ok(g >= 1 && g <= 10, "grupele sunt în 1–10");
  }
});

test("lectoriCuGrupe NU expune amprentele codurilor", () => {
  for (const x of lectoriCuGrupe())
    assert.equal("hash" in x, false, "lista trimisă spre interfață nu are voie să conțină amprente");
});
