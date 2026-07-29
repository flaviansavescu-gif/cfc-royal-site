// Teste pentru algoritmii de comparație JCR. Rulează: node --test netlify/functions/_jcr/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comparaCalificativ, comparaDefecte, spearman, kendall, comparaClasament,
  comparaObservatii, comparaRaspuns,
} from "./compare.mjs";

test("calificativ: identic => acord, distanță 0", () => {
  const r = comparaCalificativ("Excellent", "Excellent");
  assert.equal(r.status, "acord");
  assert.equal(r.distanta, 0);
});

test("calificativ: o treaptă mai sever => acord-parțial, distanță pozitivă", () => {
  const r = comparaCalificativ("Very Good", "Excellent");
  assert.equal(r.status, "acord-parțial");
  assert.equal(r.distanta, 1);
});

test("calificativ: două trepte => dezacord", () => {
  const r = comparaCalificativ("Good", "Excellent");
  assert.equal(r.status, "dezacord");
  assert.equal(r.distanta, 2);
});

test("calificativ: special diferit => dezacord, distanță null", () => {
  const r = comparaCalificativ("Disqualified", "Excellent");
  assert.equal(r.status, "dezacord");
  assert.equal(r.distanta, null);
});

test("defecte: acord, parțial, omis, suplimentar", () => {
  const student = [{ cod: "A", gravitate: "grav" }, { cod: "B", gravitate: "minor" }, { cod: "X", gravitate: "minor" }];
  const referinta = [{ cod: "A", gravitate: "grav" }, { cod: "B", gravitate: "grav" }, { cod: "C", gravitate: "eliminator" }];
  const r = comparaDefecte(student, referinta);
  const by = Object.fromEntries(r.detalii.map((d) => [d.cod, d.status]));
  assert.equal(by.A, "acord");
  assert.equal(by.B, "acord-parțial");
  assert.equal(by.C, "omis");
  assert.equal(by.X, "suplimentar");
  assert.deepEqual(r.sumar, { acord: 1, partial: 1, omise: 1, suplimentare: 1, total_referinta: 3 });
});

test("spearman: clasament identic => 1", () => {
  assert.equal(spearman(["a", "b", "c"], ["a", "b", "c"]), 1);
});

test("spearman: clasament invers (3 elem) => -1", () => {
  assert.equal(spearman(["a", "b", "c"], ["c", "b", "a"]), -1);
});

test("spearman/kendall: sub 2 comune => null", () => {
  assert.equal(spearman(["a"], ["a"]), null);
  assert.equal(kendall(["a"], ["b"]), null);
});

test("kendall: identic => 1, invers => -1", () => {
  assert.equal(kendall(["a", "b", "c"], ["a", "b", "c"]), 1);
  assert.equal(kendall(["a", "b", "c"], ["c", "b", "a"]), -1);
});

test("comparaClasament: o inversiune de vecini => acord-parțial sau acord", () => {
  const r = comparaClasament(["a", "b", "c", "d"], ["b", "a", "c", "d"]);
  assert.ok(r.spearman > 0.5);
  assert.ok(["acord", "acord-parțial"].includes(r.status));
});

test("observatii: acoperit vs neabordat", () => {
  const student = [{ criteriuId: "cap" }, { criteriuId: "corp" }];
  const referinta = [{ criteriuId: "cap", eticheta: "Cap" }, { criteriuId: "coada", eticheta: "Coadă" }];
  const r = comparaObservatii(student, referinta);
  const by = Object.fromEntries(r.detalii.map((d) => [d.criteriuId, d.status]));
  assert.equal(by.cap, "acoperit");
  assert.equal(by.coada, "neabordat");
  assert.equal(r.sumar.acoperite, 1);
});

test("comparaRaspuns: integrează toate secțiunile fără să arunce", () => {
  const r = comparaRaspuns(
    { calificativ: "Very Good", defecte: [{ cod: "A", gravitate: "minor" }], clasament: ["x", "y"], observatii: [{ criteriuId: "cap" }] },
    { calificativ: "Excellent", defecte: [{ cod: "A", gravitate: "grav" }], clasament: ["y", "x"], observatii: [{ criteriuId: "cap" }] },
  );
  assert.equal(r.calificativ.status, "acord-parțial");
  assert.equal(r.defecte.detalii[0].status, "acord-parțial");
  assert.ok(r.clasament.spearman !== undefined);
  assert.equal(r.observatii.sumar.acoperite, 1);
});

test("comparaRaspuns: intrări goale nu aruncă", () => {
  const r = comparaRaspuns(undefined, undefined);
  assert.equal(r.calificativ.status, "necompletat");
  assert.equal(r.defecte.sumar.total_referinta, 0);
  assert.equal(r.clasament.status, "indisponibil");
});
