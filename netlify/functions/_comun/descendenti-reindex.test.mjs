// Probă de comportament pentru reindexarea descendenților (PERF-001): admin+2FA reconstruiește
// indexul microcip->declarație și ridică steagul; non-adminul e refuzat. Handler real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scryptSync, createHash } from "node:crypto";
import { bootstrapMockModule, magazieFalsa, reqJSON, mockBlobs } from "./_harness.mjs";

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

if (!bootstrapMockModule(import.meta.url)) {
  test("reindex descendenți — sărită (mock.module indisponibil)", { skip: true }, () => {});
} else {
  process.env.ADMIN_HASH = scryptSync(sha256("ADMIN-COD"), "5bc690c359954798d5149721d0f7cada", 32).toString("hex");
  process.env.BREVO_API_KEY = "cheie-doar-pentru-probe"; // ca al doilea factor să fie activ
  delete process.env.FARA_AL_DOILEA_FACTOR;

  const store = magazieFalsa({
    ["dispozitiv/" + sha256("JETON-BUN")]: { rol: "admin", expira: "2099-01-01T00:00:00Z" },
    "dmf/D1": { id: "D1", mascul: { microcip: "941000000000011" }, femela: { microcip: "941000000000012" } },
    "dmf/D2": { id: "D2", mascul: { microcip: "941000000000011" }, femela: { microcip: "941000000000099" } },
  });
  mockBlobs(store);
  const handler = (await import("../registru-pedigree.mjs")).default;

  test("PERF-001: non-admin (fără cod) => 401", async () => {
    const res = await handler(reqJSON({ actiune: "reindex-descendenti" }));
    assert.equal(res.status, 401);
  });

  test("PERF-001: admin+2FA reconstruiește indexul și ridică steagul", async () => {
    const res = await handler(reqJSON({ cod: "ADMIN-COD", dispozitiv: "JETON-BUN", actiune: "reindex-descendenti" }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.legaturi, 4, "2 DMF × 2 părinți = 4 legături scrise");
    // steagul ridicat + intrări de index scrise (părintele 941...011 apare în ambele cuiburi)
    assert.ok(await store.get("descendent-index-gata"), "steagul trebuie ridicat");
    assert.ok(await store.get("descendent-cip/941000000000011/D1"), "index pentru cuibul D1");
    assert.ok(await store.get("descendent-cip/941000000000011/D2"), "index pentru cuibul D2");
  });

  test("PERF-001: admin fără al doilea factor => 403", async () => {
    const res = await handler(reqJSON({ cod: "ADMIN-COD", dispozitiv: "NECUNOSCUT", actiune: "reindex-descendenti" }));
    assert.equal(res.status, 403);
  });
}
