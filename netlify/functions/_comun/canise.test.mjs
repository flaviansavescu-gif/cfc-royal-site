// Probele regulilor afixului.
//
// DE CE EXISTĂ. Unicitatea afixului e temelia întregii evidențe a caniselor: dacă două
// canise pot purta „același nume scris altfel", certificatele lor devin de nedeosebit.
// Regula de comparație trebuie deci probată pe chiar cazurile care păcălesc ochiul.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeazaAfix, afixValid, verdictAfix, poateDepuneDinNou, RACIRE_DUPA_RESPINGERE_MS } from "./canise.mjs";

test("diacriticele, spațiile și cratimele nu deosebesc afixele", () => {
  // Perechile de mai jos TREBUIE să fie același afix — altfel s-ar putea înregistra amândouă.
  const perechi = [
    ["Vulturii Carpaților", "VULTURII-CARPATILOR"],
    ["Șoimii Țării", "Soimii Tarii"],
    ["De  la   Munte", "de-la-munte"],
    ["Câmpia Băniei", "CAMPIA BANIEI"],
  ];
  for (const [a, b] of perechi) {
    assert.equal(normalizeazaAfix(a), normalizeazaAfix(b), `${a} ↔ ${b}`);
  }
});

test("afixe cu adevărat diferite rămân diferite", () => {
  assert.notEqual(normalizeazaAfix("Carpați"), normalizeazaAfix("Carpați Nord"));
  assert.notEqual(normalizeazaAfix("Royal"), normalizeazaAfix("Regal"));
});

test("ce nu poate fi un afix e oprit cu motiv, nu cu tăcere", () => {
  assert.equal(afixValid("").ok, false);
  assert.equal(afixValid("AB").ok, false, "două litere nu deosebesc nimic");
  assert.equal(afixValid("X".repeat(41)).ok, false, "nu încape pe act");
  assert.equal(afixValid("Câini & Co.").ok, false, "semne neîngăduite");
  assert.equal(afixValid("---").ok, false, "doar cratime = nicio literă");
  assert.equal(afixValid("Vulturii Carpaților").ok, true);
  assert.equal(afixValid("K-9 Elite").ok, true, "cifrele și cratima sunt îngăduite");
});

test("verdictul spune cine poartă afixul, nu doar că e luat", () => {
  const ocupate = new Map([[normalizeazaAfix("Carpați"), "canisa CARPAȚI (membru existent)"]]);
  assert.deepEqual(verdictAfix("Lupii Nordului", ocupate), { stare: "liber" });
  const v = verdictAfix("carpati", ocupate);
  assert.equal(v.stare, "ocupat");
  assert.match(v.deCine, /CARPAȚI/);
  assert.equal(verdictAfix("!!", ocupate).stare, "invalid");
});

test("frâna de după respingere: 24 de ore, nici mai mult, nici la nesfârșit", () => {
  const acum = Date.now();
  const la = (ms) => new Date(acum - ms).toISOString();
  // respins acum o oră: oprit, cu orele rămase spuse omului
  const oprit = poateDepuneDinNou({ stare: "respinsa", hotarata: la(3600e3) }, acum);
  assert.equal(oprit.ok, false);
  assert.equal(oprit.oreRamase, 23);
  // respins acum 25 de ore: liber
  assert.equal(poateDepuneDinNou({ stare: "respinsa", hotarata: la(25 * 3600e3) }, acum).ok, true);
  // chiar la margine: fix 24 de ore = liber
  assert.equal(poateDepuneDinNou({ stare: "respinsa", hotarata: la(RACIRE_DUPA_RESPINGERE_MS) }, acum).ok, true);
  // aprobarea și lipsa istoricului nu frânează pe nimeni
  assert.equal(poateDepuneDinNou({ stare: "aprobata" }, acum).ok, true);
  assert.equal(poateDepuneDinNou(null, acum).ok, true);
  // o dată ilizibilă nu blochează din greșeală
  assert.equal(poateDepuneDinNou({ stare: "respinsa", hotarata: "candva" }, acum).ok, true);
});

console.log("canise: toate probele trecute");
