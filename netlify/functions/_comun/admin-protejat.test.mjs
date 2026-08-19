// Probă de comportament: protecția endpointului administrativ (P2-5 D).
// registru-export: non-admin => refuz; admin fără al doilea factor => refuz;
// admin cu dispozitiv cunoscut => trece de ambele porți. Handler real, magazie în memorie.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scryptSync, createHash } from "node:crypto";
import { bootstrapMockModule, magazieFalsa, reqJSON, mockBlobs } from "./_harness.mjs";

// sha256 LOCAL, nu din roluri.mjs: importul lui roluri trebuie să se întâmple abia la
// importul handlerului, DUPĂ ce am pus ADMIN_HASH — altfel roluri prinde amprenta veche.
const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

if (!bootstrapMockModule(import.meta.url)) {
  test("admin protejat — sărită (mock.module indisponibil pe acest Node)", { skip: true }, () => {});
} else {
  // Amprenta de admin = scryptTare(sha256(cod)) cu sarea comună din roluri.mjs. O calculăm
  // aici ca „ADMIN-COD" să fie un admin valid. (Dacă sarea se rotește, se actualizează aici.)
  const SARE = "5bc690c359954798d5149721d0f7cada";
  process.env.ADMIN_HASH = scryptSync(sha256("ADMIN-COD"), SARE, 32).toString("hex");
  delete process.env.FARA_AL_DOILEA_FACTOR;            // ne asigurăm că al doilea factor e ACTIV
  process.env.BREVO_API_KEY = "cheie-doar-pentru-probe"; // al doilea factor se impune DOAR când poșta
  // e configurată (altfel n-ai cum trimite OTP). O punem ca poarta de dispozitiv să fie exercitată.
  // Nicio cale testată aici nu trimite efectiv e-mail.

  const store = magazieFalsa({
    ["dispozitiv/" + sha256("JETON-BUN")]: { rol: "admin", expira: "2099-01-01T00:00:00Z" },
  });
  mockBlobs(store);
  const handler = (await import("../registru-export.mjs")).default;

  test("D: non-admin (cod oarecare) => 401", async () => {
    const res = await handler(reqJSON({ cod: "CINEVA", actiune: "export", dispozitiv: "JETON-BUN" }));
    assert.equal(res.status, 401);
  });

  test("D: admin FĂRĂ al doilea factor (dispozitiv necunoscut) => 403", async () => {
    const res = await handler(reqJSON({ cod: "ADMIN-COD", dispozitiv: "JETON-NECUNOSCUT" }));
    assert.equal(res.status, 403);
  });

  test("D: admin cu dispozitiv cunoscut => trece de ambele porți (nu 401/403)", async () => {
    const res = await handler(reqJSON({ cod: "ADMIN-COD", dispozitiv: "JETON-BUN", maxMB: 1 }));
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 403);
  });
}
