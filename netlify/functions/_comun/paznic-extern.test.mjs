// paznic-extern.test.mjs — reciprocitatea paznicilor: monitorul de pe Netlify veghează
// paznicul din GitHub Actions prin urma `paznic-extern`. Probăm judecata pură a prospețimii.
//   node --test netlify/functions/_comun/paznic-extern.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { paznicExternViu, PRAG_PAZNIC_EXTERN_MIN } from "../monitor-flux.mjs";

const ACUM = Date.parse("2026-08-23T12:00:00.000Z");
const cuMinute = (m) => ({ la: new Date(ACUM - m * 60000).toISOString() });

test("bootstrap: fără check-in încă → OK (nu alarmăm până bate GitHub prima dată)", () => {
  assert.equal(paznicExternViu(null, ACUM).ok, true);
});

test("check-in proaspăt (12 min) → OK", () => {
  assert.equal(paznicExternViu(cuMinute(12), ACUM).ok, true);
});

test("fix la prag → încă OK (fără alarmă falsă la graniță)", () => {
  assert.equal(paznicExternViu(cuMinute(PRAG_PAZNIC_EXTERN_MIN), ACUM).ok, true);
});

test("învechit peste prag → ALARMĂ (workflow dezactivat/șters)", () => {
  const r = paznicExternViu(cuMinute(PRAG_PAZNIC_EXTERN_MIN + 10), ACUM);
  assert.equal(r.ok, false);
  assert.match(r.detaliu, /dezactivat|șters|Actions/);
});

test("dată stricată → tratată ca bootstrap (OK), nu ca proaspătă falsă", () => {
  assert.equal(paznicExternViu({ la: "nu-e-o-dată" }, ACUM).ok, true);
});
