// Ce se întâmplă cu o expoziție după ce îi trece termenul.
//
// DE CE EXISTĂ. Până acum expoziția pur și simplu dispărea din formular. Din partea
// vizitatorului, asta arată ca o defecțiune: ieri era acolo, azi scrie „nu sunt expoziții
// cu înscrieri deschise", fără să spună nimeni de ce. Acum rămâne la vedere, însemnată.
//
// Regula are două jumătăți care se pot strica una fără alta:
//   1. CARE expoziție se arată ca închisă — nu orice expoziție oprită. Una retrasă din
//      manager nu s-a anunțat niciodată; ea nu are ce căuta pe site.
//   2. CÂT TIMP se mai arată — nu la nesfârșit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { inchisPentruInscrieri, inchisPrinTermen, seMaiArataInchisa } from "../inscriere-expo.mjs";

const ZI = 24 * 3600 * 1000;
const acum = Date.now();
const cand = (ms) => new Date(acum + ms).toISOString();

/** O expoziție publicată, cu termenul și ziua date față de acum. */
const expo = (termenMs, ziMs) => ({ deschis: true, termen: cand(termenMs), data: cand(ziMs) });

test("cu termenul încă în față: nu e închisă, iar înscrierile merg", () => {
  const e = expo(5 * ZI, 12 * ZI);
  assert.equal(inchisPrinTermen(e), false);
  assert.equal(inchisPentruInscrieri(e), false);
});

test("cu termenul trecut: e închisă prin termen ȘI oprită pentru înscrieri", () => {
  // Amândouă trebuie să fie adevărate. Dacă prima ar fi adevărată și a doua nu, formularul
  // ar arăta „închis" dar ar primi înscrieri — cel mai rău dintre răspunsuri.
  const e = expo(-1 * ZI, 4 * ZI);
  assert.equal(inchisPrinTermen(e), true);
  assert.equal(inchisPentruInscrieri(e), true);
});

test("retrasă din manager: oprită, dar NU se arată ca închisă", () => {
  // Deosebirea care contează. `deschis: false` înseamnă că expoziția nu s-a publicat sau
  // s-a retras — nu s-a anunțat niciodată, deci nu are ce explica nimănui.
  const e = { ...expo(5 * ZI, 12 * ZI), deschis: false };
  assert.equal(inchisPentruInscrieri(e), true, "oprită, da");
  assert.equal(inchisPrinTermen(e), false, "dar nu «închisă prin termen» — nu se arată deloc");
});

test("termen ilizibil: nu o declarăm închisă din greșeală", () => {
  const e = { deschis: true, termen: "candva", data: cand(10 * ZI) };
  assert.equal(inchisPrinTermen(e), false);
  assert.equal(inchisPentruInscrieri(e), false, "nici oprită — un termen stricat nu închide o expoziție");
});

test("o secundă face deosebirea, fiindcă termenul e un moment", () => {
  assert.equal(inchisPrinTermen(expo(1000, 10 * ZI)), false, "cu o secundă înainte: deschisă");
  assert.equal(inchisPrinTermen(expo(-1000, 10 * ZI)), true, "cu o secundă după: închisă");
});

test("se mai arată până a doua zi după expoziție, apoi nu", () => {
  assert.equal(seMaiArataInchisa(expo(-2 * ZI, 3 * ZI)), true, "expoziția e peste trei zile");
  assert.equal(seMaiArataInchisa(expo(-9 * ZI, -2 * ZI)), false, "expoziția a fost acum două zile");
  // Marginea: chiar în ziua de după expoziție încă se vede.
  assert.equal(seMaiArataInchisa(expo(-9 * ZI, -1 * ZI + 3600 * 1000)), true, "la 23 de ore după");
});

test("fără dată de expoziție nu se arată: n-am ști până când", () => {
  assert.equal(seMaiArataInchisa({ deschis: true, termen: cand(-ZI) }), false);
  assert.equal(seMaiArataInchisa({ deschis: true, termen: cand(-ZI), data: "candva" }), false);
});

test("cele două întrebări sunt deosebite, nu una singură", () => {
  // O expoziție veche e închisă prin termen, DAR nu se mai arată. Dacă cineva ar lega
  // cele două laolaltă, formularul s-ar umple cu expoziții de anul trecut.
  const veche = expo(-100 * ZI, -90 * ZI);
  assert.equal(inchisPrinTermen(veche), true);
  assert.equal(seMaiArataInchisa(veche), false);
});

console.log("expozitie-inchisa: toate probele trecute");
