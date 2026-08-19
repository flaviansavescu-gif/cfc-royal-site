// Probă de comportament: validarea upload-ului la depunerea unui certificat de sănătate
// (P2-5 C). MIME nepermis / fișier prea mare / microcip invalid => respinse; upload valid
// => acceptat. Handler real, magazie în memorie.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { bootstrapMockModule, magazieFalsa, reqJSON, mockBlobs } from "./_harness.mjs";

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

if (!bootstrapMockModule(import.meta.url)) {
  test("upload sănătate — sărită (mock.module indisponibil pe acest Node)", { skip: true }, () => {});
} else {
  const CIP = "941000024681357";
  const store = magazieFalsa({
    ["membru/" + sha256("MCOD")]: { nume: "Ana", email: "a@x.ro", cotizatiePana: "2099-01-01" },
    ["pedigree-caine/" + CIP]: { serie: "CFCR-P-2026-0001" },
    "pedigree/CFCR-P-2026-0001": { dmfId: "D", crescator: { nume: "Ana" }, proprietar: { nume: "Ana" } },
  });
  mockBlobs(store);
  const handler = (await import("../registru-sanatate.mjs")).default;

  const baza = (o) => ({
    cod: "MCOD", actiune: "depune", microcip: CIP, tip: "hd", rezultat: "A",
    emitent: "Dr. Test Veterinar", continut: "QUFB", tipFisier: "image/jpeg", ...o,
  });

  test("C: MIME nepermis => 400", async () => {
    const res = await handler(reqJSON(baza({ tipFisier: "application/x-msdownload" })));
    assert.equal(res.status, 400);
  });

  test("C: fișier prea mare => 400", async () => {
    const urias = "A".repeat(6 * 1024 * 1024 + 16);
    const res = await handler(reqJSON(baza({ continut: urias })));
    assert.equal(res.status, 400);
  });

  test("C: microcip invalid => 400 (nu 500)", async () => {
    const res = await handler(reqJSON(baza({ microcip: "123" })));
    assert.equal(res.status, 400);
  });

  test("C: câine neînregistrat în Cartea de origini => 404", async () => {
    const res = await handler(reqJSON(baza({ microcip: "111111111111119" })));
    assert.equal(res.status, 404);
  });

  test("C: upload valid => 200 și testId", async () => {
    const res = await handler(reqJSON(baza()));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.ok && body.testId, "trebuie să întoarcă ok + testId");
  });
}
