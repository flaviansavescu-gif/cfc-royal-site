// Probă de comportament pentru SEC-006: o excepție internă neașteptată NU scurge detaliul
// tehnic către client — mesaj generic, status păstrat. Erorile de validare controlate
// rămân specifice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scryptSync, createHash } from "node:crypto";
import { bootstrapMockModule, magazieFalsa, reqJSON, mockBlobs } from "./_harness.mjs";

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
const SECRET = "SECRET-INTERN parola=xyz la /home/app/registru.js:512";

if (!bootstrapMockModule(import.meta.url)) {
  test("erori generice — sărită (mock.module indisponibil pe acest Node)", { skip: true }, () => {});
} else {
  // Admin valid; NU configurăm poșta => al doilea factor nu se impune (operational=false),
  // deci adminul ajunge la acțiune fără dispozitiv. Magazia ARUNCĂ la listare, cu un mesaj
  // care conține un „secret", ca să verificăm că NU ajunge la client.
  process.env.ADMIN_HASH = scryptSync(sha256("ADMIN-COD"), "5bc690c359954798d5149721d0f7cada", 32).toString("hex");
  delete process.env.BREVO_API_KEY;
  delete process.env.FARA_AL_DOILEA_FACTOR;

  const baza = magazieFalsa();
  const store = { ...baza, async list() { throw new Error(SECRET); } };
  mockBlobs(store);
  const handler = (await import("../registru-pedigree.mjs")).default;

  test("SEC-006: excepție internă => 500 generic, FĂRĂ detaliul tehnic", async () => {
    const res = await handler(reqJSON({
      cod: "ADMIN-COD", actiune: "extras-carte", deLa: "1", panaLa: "100",
    }));
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.eroare, "Nu am putut citi registrul. Încearcă din nou.");
    const brut = JSON.stringify(body);
    assert.ok(!brut.includes("SECRET-INTERN"), "detaliul intern nu are voie la client");
    assert.ok(!brut.includes("parola"), "niciun secret în răspuns");
    assert.ok(!brut.includes("/home/"), "nicio cale internă în răspuns");
  });

  test("SEC-006: eroarea de validare controlată RĂMÂNE specifică (nu genericizată)", async () => {
    const res = await handler(reqJSON({ cod: "ADMIN-COD", actiune: "extras-carte", deLa: "nu-e-numar", panaLa: "asa-ceva" }));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.notEqual(body.eroare, "Nu am putut citi registrul. Încearcă din nou.");
    assert.ok(body.eroare && body.eroare.length > 0, "mesaj de validare specific");
  });
}
