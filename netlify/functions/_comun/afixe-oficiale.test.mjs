// Probele evidenței oficiale a afixelor.
//
// DE CE EXISTĂ. Modulul afixe-oficiale.mjs e GENERAT din pagina publică a caniselor.
// Dacă cineva adaugă o canisă pe site și uită să regenereze, registrul online ar
// declara „liber" un afix înregistrat oficial — exact greșeala pe care lista trebuie
// s-o facă imposibilă. Proba de sincronizare oprește publicarea în acest caz.
import { test } from "node:test";
import assert from "node:assert/strict";
import { AFIXE_OFICIALE } from "./afixe-oficiale.mjs";
import { normalizeazaAfix, verdictAfix } from "./canise.mjs";
import { construiesteLista } from "../../../scripts/genereaza-afixe-oficiale.mjs";

test("modulul generat e la zi cu pagina publică a caniselor", () => {
  assert.deepEqual(AFIXE_OFICIALE, construiesteLista(),
    "colecția src/content/canise s-a schimbat — rulează: node scripts/genereaza-afixe-oficiale.mjs");
});

test("evidența oficială e întreagă și fără dubluri", () => {
  assert.ok(AFIXE_OFICIALE.length >= 28, "cel puțin cele 28 de canise din registrul de hârtie");
  for (const a of AFIXE_OFICIALE) {
    assert.ok(a.afix, "fiecare poziție are afix");
    assert.match(a.nrAfix, /^AFX\d+\/\d{4}$/, `număr oficial lizibil la „${a.afix}”: ${a.nrAfix}`);
    assert.ok(a.titular, `titular la „${a.afix}”`);
  }
  const norme = AFIXE_OFICIALE.map((a) => normalizeazaAfix(a.afix));
  assert.equal(new Set(norme).size, norme.length, "două poziții cu același afix normalizat");
});

test("un afix oficial nu poate fi declarat liber, oricum ar fi scris", () => {
  // Exact harta pe care o construiește funcția registru-canise din evidența oficială.
  const luate = new Map(AFIXE_OFICIALE.map((a) =>
    [normalizeazaAfix(a.afix), `canisa „${a.afix}” (nr. ${a.nrAfix}, evidența oficială)`]));
  // Scris altfel decât pe certificat: fără cratime, fără diacritice, cu alte majuscule.
  for (const incercare of ["Sweet Puppy Constanta", "SNOW-SPIRIT", "amor del mar", "Zăvod  Valah"]) {
    const v = verdictAfix(incercare, luate);
    assert.equal(v.stare, "ocupat", `„${incercare}” trebuie să fie ocupat`);
    assert.match(v.deCine, /evidența oficială/);
  }
  // Un nume cu adevărat nou rămâne liber.
  assert.equal(verdictAfix("Luceafărul din Banat", luate).stare, "liber");
});

console.log("afixe-oficiale: toate probele trecute");
