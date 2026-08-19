// Probă de comportament pentru SEC-004: poarta Școlii hrănește paznicul central de
// intruziune la un cod greșit, dar NU raportează un acces valid ca atac.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { bootstrapMockModule, magazieFalsa, reqJSON, mockBlobs } from "./_harness.mjs";

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
const paznicChei = (store) => [...store._map.keys()].filter((k) => k.startsWith("paznic/"));

if (!bootstrapMockModule(import.meta.url)) {
  test("SEC-004 paznic — sărită (mock.module indisponibil pe acest Node)", { skip: true }, () => {});
} else {
  const store = magazieFalsa({
    ["candidat/" + sha256("CANDIDAT-VALID")]: { nume: "Cursant Test" },
  });
  mockBlobs(store);
  const handler = (await import("../acces-cursuri.mjs")).default;

  test("SEC-004: accesul VALID nu lasă urmă la paznic", async () => {
    const res = await handler(reqJSON({ cod: "CANDIDAT-VALID" }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.rol, "candidat");
    assert.equal(paznicChei(store).length, 0, "un acces valid NU trebuie raportat ca atac");
  });

  test("SEC-004: codul greșit e consemnat la paznic + 401", async () => {
    const res = await handler(reqJSON({ cod: "COD-COMPLET-GRESIT" }));
    assert.equal(res.status, 401);
    const chei = paznicChei(store);
    assert.ok(chei.length >= 1, "refuzul de acreditare trebuie consemnat la paznic");
    // urma poartă numele ușii, nu codul sau vreo dată personală.
    assert.ok(chei.some((k) => k.includes("acces-cursuri")), "urma trebuie legată de ușa Școlii");
    assert.ok(!chei.some((k) => k.includes("COD-COMPLET-GRESIT")), "codul NU are voie în cheia paznicului");
  });
}
