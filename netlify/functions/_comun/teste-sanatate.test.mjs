// Probe pentru nomenclatorul testelor de sănătate (Faza 1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { TIPURI_TEST_LISTA, tipValid, valideaza, numeTest, insignaTest, favorabil, recomandareDin } from "./teste-sanatate.mjs";

test("tipurile de test sunt cele așteptate", () => {
  assert.deepEqual(TIPURI_TEST_LISTA.sort(), ["adn", "ed", "genetic", "hd", "ochi"]);
});

test("tipValid recunoaște doar tipuri cunoscute", () => {
  assert.equal(tipValid("hd"), true);
  assert.equal(tipValid("ed"), true);
  assert.equal(tipValid("inexistent"), false);
  assert.equal(tipValid(""), false);
  assert.equal(tipValid(null), false);
});

test("valideaza acceptă rezultate din lista închisă și le respinge pe cele străine", () => {
  assert.equal(valideaza("hd", "A").ok, true);
  assert.equal(valideaza("hd", "A").rezultat, "A");
  assert.ok(valideaza("hd", "Z").eroare, "HD-Z nu e permis");
  assert.equal(valideaza("ed", "0").ok, true);
  assert.ok(valideaza("ed", "9").eroare);
  assert.equal(valideaza("ochi", "liber").ok, true);
  assert.ok(valideaza("ochi", "verde").eroare);
});

test("valideaza cere un rezultat", () => {
  assert.ok(valideaza("hd", "").eroare);
  assert.ok(valideaza("hd", null).eroare);
});

test("testul genetic acceptă rezultat liber", () => {
  assert.equal(valideaza("genetic", "clar (N/N)").ok, true);
  assert.equal(valideaza("genetic", "purtător").ok, true);
});

test("valideaza refuză tip necunoscut", () => {
  assert.ok(valideaza("altceva", "A").eroare);
});

test("insignele publice sunt scurte și corecte", () => {
  assert.equal(insignaTest("hd", "A"), "HD-A");
  assert.equal(insignaTest("ed", "0"), "ED-0");
  assert.equal(insignaTest("ochi", "liber"), "Ochi: liber");
  assert.equal(insignaTest("ochi", "afectat"), "Ochi: afectat");
  assert.equal(insignaTest("adn", "depus"), "ADN depus");
  assert.equal(insignaTest("genetic", "clar"), "Genetic: clar");
  assert.equal(insignaTest("inexistent", "x"), "");
});

test("numeTest dă numele complet", () => {
  assert.equal(numeTest("hd"), "Displazie de șold (HD)");
  assert.equal(numeTest("ochi"), "Examen oftalmologic");
});

test("favorabil judecă corect rezultatele bune și rele", () => {
  assert.equal(favorabil("hd", "A"), true);
  assert.equal(favorabil("hd", "C"), true);
  assert.equal(favorabil("hd", "D"), false);
  assert.equal(favorabil("hd", "E"), false);
  assert.equal(favorabil("ed", "1"), true);
  assert.equal(favorabil("ed", "2"), false);
  assert.equal(favorabil("ochi", "liber"), true);
  assert.equal(favorabil("ochi", "afectat"), false);
  assert.equal(favorabil("adn", "depus"), true);
  assert.equal(favorabil("genetic", "orice"), null, "genetic = neutru, nu se judecă automat");
});

test("recomandareDin: un test bun și niciunul rău → acordată", () => {
  const r = recomandareDin([{ tip: "hd", rezultat: "A", stare: "verificat" }]);
  assert.equal(r.acordata, true);
  assert.equal(r.favorabile, 1);
  assert.equal(r.nefavorabile, 0);
});

test("recomandareDin: un test nefavorabil o retrage, chiar cu altele bune", () => {
  const r = recomandareDin([
    { tip: "hd", rezultat: "A", stare: "verificat" },
    { tip: "ochi", rezultat: "afectat", stare: "verificat" },
  ]);
  assert.equal(r.acordata, false, "un ochi afectat verificat anulează recomandarea");
});

test("recomandareDin: numără doar testele VERIFICATE", () => {
  const r = recomandareDin([
    { tip: "hd", rezultat: "A", stare: "in-asteptare" },
    { tip: "ochi", rezultat: "afectat", stare: "respins" },
  ]);
  assert.equal(r.acordata, false, "niciun test verificat → fără recomandare");
  assert.equal(r.favorabile, 0);
});

test("recomandareDin: doar test genetic (neutru) NU acordă singur", () => {
  const r = recomandareDin([{ tip: "genetic", rezultat: "clar", stare: "verificat" }]);
  assert.equal(r.acordata, false, "geneticul e neutru — nu contează ca favorabil");
});

test("recomandareDin: dosar gol → fără recomandare", () => {
  assert.equal(recomandareDin([]).acordata, false);
  assert.equal(recomandareDin(undefined).acordata, false);
});
