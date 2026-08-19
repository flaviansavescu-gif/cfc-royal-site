// Probă de comportament: autorizare/ownership pe dosarul DMF (P2-5 B).
// Membrul A NU poate citi dosarul membrului B — handlerul real, magazie în memorie.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrapMockModule, magazieFalsa, reqJSON, mockBlobs } from "./_harness.mjs";
import { sha256 } from "../_comun/roluri.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("ownership DMF — sărită (mock.module indisponibil pe acest Node)", { skip: true }, () => {});
} else {
  const idA = sha256("COD-MEMBRU-A");
  const idB = sha256("COD-MEMBRU-B");
  const store = magazieFalsa({
    ["membru/" + idA]: { nume: "Membru A", email: "a@x.ro", cotizatiePana: "2099-01-01" },
    ["membru/" + idB]: { nume: "Membru B", email: "b@x.ro", cotizatiePana: "2099-01-01" },
    "dmf/DOSAR-B": {
      id: "DOSAR-B", membruId: idB, serie: "CFCR-DMF-2026-0007", stare: "depus",
      mascul: { nume: "Tata", microcip: "941000000000001" },
      femela: { nume: "Mama", microcip: "941000000000002" },
      pui: [],
    },
  });
  mockBlobs(store);
  const handler = (await import("../registru-dmf.mjs")).default;

  test("B: membrul A → dosarul lui B = 403 (nu vede datele altuia)", async () => {
    const res = await handler(reqJSON({ cod: "COD-MEMBRU-A", actiune: "dosar", id: "DOSAR-B" }));
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(!JSON.stringify(body).includes("941000000000001"), "nu trebuie să scape microcipul dosarului lui B");
  });

  test("B: membrul B → propriul dosar = 200", async () => {
    const res = await handler(reqJSON({ cod: "COD-MEMBRU-B", actiune: "dosar", id: "DOSAR-B" }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.dosar?.serie, "CFCR-DMF-2026-0007");
  });

  test("B: cod necunoscut → 401 (nu 403/500)", async () => {
    const res = await handler(reqJSON({ cod: "COD-INEXISTENT", actiune: "dosar", id: "DOSAR-B" }));
    assert.equal(res.status, 401);
  });

  test("C: identificator periculos → 400 (SEC-001 prin handlerul real)", async () => {
    const res = await handler(reqJSON({ cod: "COD-MEMBRU-B", actiune: "dosar", id: "../../" }));
    assert.equal(res.status, 400);
  });

  test("B: dosar inexistent → 404 curat", async () => {
    const res = await handler(reqJSON({ cod: "COD-MEMBRU-B", actiune: "dosar", id: "NU-EXISTA" }));
    assert.equal(res.status, 404);
  });
}
