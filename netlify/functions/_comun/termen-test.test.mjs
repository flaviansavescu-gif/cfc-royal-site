// Probele regulilor de termen si penalizare (termen-test.mjs).
// Fara ghilimele romanesti in titluri: ele au stricat o data un script intreg.
import test from "node:test";
import assert from "node:assert/strict";
import { stareTermen, aplicaPenalizarea, curataPenalizarea } from "./termen-test.mjs";

const ACUM = Date.parse("2026-08-15T12:00:00Z");
const IERI = "2026-08-14T12:00:00Z";
const MAINE = "2026-08-16T12:00:00Z";

test("fara termen setat, testul e deschis si fara penalizare", () => {
  for (const t of [null, undefined, {}, { pana: null }, { pana: "" }]) {
    const s = stareTermen(t, ACUM);
    assert.equal(s.inchis, false);
    assert.equal(s.penalizare, 0);
  }
});

test("un termen ilizibil nu are voie sa inchida testul", () => {
  const s = stareTermen({ pana: "nu-e-data", penalizare: 10 }, ACUM);
  assert.equal(s.inchis, false);
  assert.equal(s.penalizare, 0);
});

test("termen in viitor: deschis, cu penalizarea ferestrei", () => {
  const s = stareTermen({ pana: MAINE, penalizare: 10 }, ACUM);
  assert.equal(s.inchis, false);
  assert.equal(s.penalizare, 10);
});

test("termen depasit: inchis", () => {
  const s = stareTermen({ pana: IERI, penalizare: 10 }, ACUM);
  assert.equal(s.inchis, true);
});

test("chiar la termen testul e inca deschis (inchis doar DUPA termen)", () => {
  const s = stareTermen({ pana: new Date(ACUM).toISOString() }, ACUM);
  assert.equal(s.inchis, false);
});

test("penalizarea se tine intre 0 si 90 la suta", () => {
  assert.equal(curataPenalizarea(-5), 0);
  assert.equal(curataPenalizarea(0), 0);
  assert.equal(curataPenalizarea(10.4), 10);
  assert.equal(curataPenalizarea(100), 90);
  assert.equal(curataPenalizarea("abc"), 0);
});

test("nota finala: 85 la suta brut cu 10 la suta penalizare = 77 (76,5 rotunjit)", () => {
  assert.equal(aplicaPenalizarea(85, 10), 77);
});

test("penalizarea musca real: 75 brut cu 10 penalizare = 68, sub pragul de 70", () => {
  assert.equal(aplicaPenalizarea(75, 10), 68);
  assert.ok(aplicaPenalizarea(75, 10) < 70);
});

test("fara penalizare nota ramane neatinsa; capetele raman in [0, 100]", () => {
  assert.equal(aplicaPenalizarea(100, 0), 100);
  assert.equal(aplicaPenalizarea(0, 50), 0);
  assert.equal(aplicaPenalizarea(100, 90), 10);
});
