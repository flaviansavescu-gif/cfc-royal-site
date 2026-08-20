// inima.test.mjs — judecata bătăilor de inimă ale funcțiilor programate.
//   node --test netlify/functions/_comun/inima.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { judecaInimile, INIMI } from "./inima.mjs";

const ACUM = Date.parse("2026-08-20T12:00:00Z");
const cuVarsta = (minute) => ({ la: new Date(ACUM - minute * 60000).toISOString() });

test("toate inimile proaspete => ok", () => {
  const batai = Object.fromEntries(Object.keys(INIMI).map((n) => [n, cuVarsta(5)]));
  const r = judecaInimile(batai, ACUM);
  assert.equal(r.ok, true);
  assert.deepEqual(r.intarziate, []);
  assert.deepEqual(r.nebatute, []);
});

test("monitorul tăcut peste prag => alarmă, cu vârsta spusă", () => {
  const batai = Object.fromEntries(Object.keys(INIMI).map((n) => [n, cuVarsta(5)]));
  batai["monitor-flux"] = cuVarsta(61);
  const r = judecaInimile(batai, ACUM);
  assert.equal(r.ok, false);
  assert.equal(r.intarziate.length, 1);
  assert.equal(r.intarziate[0].nume, "monitor-flux");
  assert.equal(r.intarziate[0].deMinute, 61);
});

test("monitorul la 59 de minute NU alarmează (pragul e 60)", () => {
  const batai = Object.fromEntries(Object.keys(INIMI).map((n) => [n, cuVarsta(5)]));
  batai["monitor-flux"] = cuVarsta(59);
  assert.equal(judecaInimile(batai, ACUM).ok, true);
});

test("săptămânala tace 7 zile => încă ok; 8 zile și un minut => alarmă", () => {
  const batai = Object.fromEntries(Object.keys(INIMI).map((n) => [n, cuVarsta(5)]));
  batai["registru-backup"] = cuVarsta(7 * 24 * 60);
  assert.equal(judecaInimile(batai, ACUM).ok, true, "7 zile e sub pragul de 8");
  batai["registru-backup"] = cuVarsta(8 * 24 * 60 + 1);
  const r = judecaInimile(batai, ACUM);
  assert.equal(r.ok, false);
  assert.equal(r.intarziate[0].nume, "registru-backup");
});

test("inima care N-A bătut niciodată NU alarmează — se raportează doar", () => {
  // Prima bătaie a săptămânalelor vine abia duminică; până atunci, alarma ar fi minciună.
  const r = judecaInimile({}, ACUM);
  assert.equal(r.ok, true);
  assert.equal(r.nebatute.length, Object.keys(INIMI).length);
});

test("o bătaie coruptă (dată necitibilă) se tratează ca nebătută, nu ca proaspătă", () => {
  const batai = Object.fromEntries(Object.keys(INIMI).map((n) => [n, cuVarsta(5)]));
  batai["paznic-veghe"] = { la: "cândva" };
  const r = judecaInimile(batai, ACUM);
  assert.equal(r.ok, true);
  assert.deepEqual(r.nebatute, ["paznic-veghe"]);
});
