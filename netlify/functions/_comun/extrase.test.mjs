// Probele extraselor oficiale.
//
// DE CE EXISTĂ. Extrasul scoate evidența din casă, pe hârtie. Două lucruri nu au voie
// să dea greș în tăcere: CINE îl poate cere (dreptul e al administratorului și al
// registratorului desemnat, nu al oricui are cod de registratură) și CE interval s-a
// cerut de fapt (un interval citit greșit ar produce un extras care minte prin omisiune).
import { test } from "node:test";
import assert from "node:assert/strict";
import { poateCereExtras, numarDinText, intervalulCerut, inInterval, inValuri } from "./extrase.mjs";

test("extrasul îl pot cere doar administratorul și registratorul desemnat", () => {
  assert.equal(poateCereExtras({ rol: "admin" }), true);
  assert.equal(poateCereExtras({ rol: "registratura", registrator: { poateDaAcces: true } }), true);
  // Registratorul FĂRĂ dreptul de a genera coduri lucrează dosarele, dar nu scoate registrul.
  assert.equal(poateCereExtras({ rol: "registratura", registrator: { poateDaAcces: false } }), false);
  assert.equal(poateCereExtras({ rol: "registratura", registrator: {} }), false);
  assert.equal(poateCereExtras({ rol: "membru", membru: {} }), false);
  assert.equal(poateCereExtras(null), false);
  // „poateDaAcces" trebuie să fie adevărul însuși, nu ceva care doar seamănă cu el.
  assert.equal(poateCereExtras({ rol: "registratura", registrator: { poateDaAcces: "da" } }), false);
});

test("numărul se citește din orice formă de evidență: primul șir de cifre", () => {
  assert.equal(numarDinText("WDF-0077"), 77);
  assert.equal(numarDinText("25"), 25);
  assert.equal(numarDinText("AFX006/2026"), 6, "anul nu se lipește de număr");
  assert.equal(numarDinText("nr. 3/2026"), 3);
  assert.equal(numarDinText(""), null);
  assert.equal(numarDinText(null), null);
  assert.equal(numarDinText("fără număr"), null);
});

test("intervalul cerut: gol = tot registrul, un capăt = deschis, întors = refuzat", () => {
  assert.deepEqual(intervalulCerut("", ""), { deLa: null, panaLa: null });
  assert.deepEqual(intervalulCerut("10", "25"), { deLa: 10, panaLa: 25 });
  assert.deepEqual(intervalulCerut("", "25"), { deLa: null, panaLa: 25 });
  assert.deepEqual(intervalulCerut("10", ""), { deLa: 10, panaLa: null });
  assert.match(intervalulCerut("25", "10").eroare, /întors/);
  assert.match(intervalulCerut("abc", "").eroare, /numere întregi/);
  assert.match(intervalulCerut("0", "").eroare, /pozitive/);
  assert.match(intervalulCerut("2.5", "7").eroare, /numere întregi/);
  // Același număr la ambele capete = un singur cuib, cerere legitimă.
  assert.deepEqual(intervalulCerut("7", "7"), { deLa: 7, panaLa: 7 });
});

test("apartenența la interval, cu capete lipsă", () => {
  assert.equal(inInterval(15, 10, 25), true);
  assert.equal(inInterval(10, 10, 25), true, "capetele sunt cuprinse, ca la extrasul de cont");
  assert.equal(inInterval(25, 10, 25), true);
  assert.equal(inInterval(9, 10, 25), false);
  assert.equal(inInterval(26, 10, 25), false);
  assert.equal(inInterval(3, null, 25), true);
  assert.equal(inInterval(99, 10, null), true);
  assert.equal(inInterval(5, null, null), true);
  // Fără număr nu există apartenență: poziția nu poate fi „între 10 și 25".
  assert.equal(inInterval(null, null, null), false);
});

test("valurile păstrează ordinea și trec prin toate", async () => {
  const dublate = await inValuri([1, 2, 3, 4, 5, 6, 7], 3, async (x) => x * 2);
  assert.deepEqual(dublate, [2, 4, 6, 8, 10, 12, 14]);
  assert.deepEqual(await inValuri([], 5, async (x) => x), []);
});

console.log("extrase: toate probele trecute");
