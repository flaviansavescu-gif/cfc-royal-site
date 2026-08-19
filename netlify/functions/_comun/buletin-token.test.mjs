// Probă de comportament pentru ciclul de viață al jetonului de confirmare a buletinului
// (DATA-001). Jetonul din link e SINGLE-USE: după prima folosire e consumat și nu mai poate
// fi reutilizat. Handler real (buletin-confirma), magazie în memorie, fetch stubuit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrapMockModule, magazieFalsa, mockBlobs } from "./_harness.mjs";

// Cheia locală, NU importată din buletin-acord: un import static ar încărca @netlify/blobs
// ÎNAINTE de mock, iar handlerul ar folosi magazia reală. Formatul e stabil.
const cheieAsteptare = (jeton) => "buletin-asteptare/" + jeton;
const reqGet = (jeton) => new Request("https://cfc-royal.ro/.netlify/functions/buletin-confirma?j=" + jeton);

if (!bootstrapMockModule(import.meta.url)) {
  test("buletin token — sărită (mock.module indisponibil pe acest Node)", { skip: true }, () => {});
} else {
  process.env.BREVO_API_KEY = "cheie-doar-pentru-probe"; // altfel handlerul dă 503 înainte de consum
  global.fetch = async () => new Response("", { status: 201 }); // nu atingem rețeaua Brevo

  const JETON = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"; // 32 hex
  const store = magazieFalsa({
    [cheieAsteptare(JETON)]: { email: "abonat@example.com", cerut: new Date().toISOString() },
  });
  mockBlobs(store);
  const handler = (await import("../buletin-confirma.mjs")).default;

  test("DATA-001: jeton VALID => confirmat (200) și consumat din magazie", async () => {
    const res = await handler(reqGet(JETON));
    assert.equal(res.status, 200);
    assert.equal(await store.get(cheieAsteptare(JETON)), null, "jetonul trebuie ȘTERS după folosire");
  });

  test("DATA-001: același jeton REUTILIZAT => 404 (nu se mai poate folosi)", async () => {
    const res = await handler(reqGet(JETON));
    assert.equal(res.status, 404);
  });

  test("DATA-001: jeton cu format invalid => 400", async () => {
    const res = await handler(reqGet("nu-e-hex"));
    assert.equal(res.status, 400);
  });

  test("DATA-001: jeton necunoscut (format bun) => 404", async () => {
    const res = await handler(reqGet("00000000000000000000000000000000"));
    assert.equal(res.status, 404);
  });

  test("DATA-001: jeton EXPIRAT => 410 și consumat", async () => {
    const vechi = "ffffffffffffffffffffffffffffffff";
    store._map.set(cheieAsteptare(vechi), { email: "x@y.ro", cerut: "2020-01-01T00:00:00.000Z" });
    const res = await handler(reqGet(vechi));
    assert.equal(res.status, 410);
    assert.equal(await store.get(cheieAsteptare(vechi)), null, "jetonul expirat se curăță");
  });
}
