// Probe de comportament pentru confirmarea proprietății la depunerea unui test de
// sănătate (SEC-003). Testează funcția reală `actorConfirmatProprietar` cu o magazie
// falsă — nu regex pe sursă.
import { test } from "node:test";
import assert from "node:assert/strict";
import { magazieFalsa } from "./_harness.mjs";
import { actorConfirmatProprietar } from "../registru-sanatate.mjs";

// Un registru cu: un cuib al membrului "MEMBRU-A" (dmf.membruId), din care s-a emis un
// certificat pentru câinele cu seria CFCR-P-2026-0001; proprietarul de pe act = "Ion Pop".
const magazie = () => magazieFalsa({
  "dmf/DMF1": { membruId: "MEMBRU-A", membruNume: "Ana Crescatoru" },
  "pedigree/CFCR-P-2026-0001": {
    dmfId: "DMF1",
    crescator: { nume: "Ana Crescatoru" },
    proprietar: { nume: "Ion Pop" },
  },
});

test("SEC-003 (1) proprietar confirmat prin membruId al crescatorului => true", async () => {
  const s = magazie();
  assert.equal(await actorConfirmatProprietar(s, "CFCR-P-2026-0001", { id: "MEMBRU-A", nume: "oricine" }), true);
});

test("SEC-003 (1b) potrivire de nume pe proprietar => true", async () => {
  const s = magazie();
  assert.equal(await actorConfirmatProprietar(s, "CFCR-P-2026-0001", { id: "ALTUL", nume: "Ion Pop" }), true);
});

test("SEC-003 (1c) potrivire de nume, cu diacritice si spatii diferite => true", async () => {
  const s = magazieFalsa({
    "dmf/D": { membruId: "X" },
    "pedigree/S": { dmfId: "D", crescator: { nume: "Ștefan  Vodă" }, proprietar: { nume: "" } },
  });
  assert.equal(await actorConfirmatProprietar(s, "S", { id: "ALT", nume: "stefan voda" }), true);
});

test("SEC-003 (2) non-proprietar (alt id, alt nume) => false", async () => {
  const s = magazie();
  assert.equal(await actorConfirmatProprietar(s, "CFCR-P-2026-0001", { id: "INTRUS", nume: "Vasile Necunoscut" }), false);
});

test("SEC-003 (3) fara legatura demonstrabila: certificat inexistent => false", async () => {
  const s = magazie();
  assert.equal(await actorConfirmatProprietar(s, "CFCR-P-9999-9999", { id: "MEMBRU-A", nume: "Ana Crescatoru" }), false);
});

test("SEC-003 (3b) serie lipsa => false", async () => {
  assert.equal(await actorConfirmatProprietar(magazie(), "", { id: "MEMBRU-A", nume: "Ana" }), false);
});

test("SEC-003 (4) marcajul e SERVER-SIDE: sursa il calculeaza din helper, nu din body", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const src = readFileSync(fileURLToPath(new URL("../registru-sanatate.mjs", import.meta.url)), "utf8");
  // flagul se pune din rezultatul helperului...
  assert.match(src, /depunereDeNeproprietar: !confirmatProprietar/);
  assert.match(src, /const confirmatProprietar = await actorConfirmatProprietar\(/);
  // ...si NICIODATA nu se citeste din corpul cererii (clientul nu-l poate falsifica).
  assert.ok(!/body\.depunereDeNeproprietar/.test(src), "flagul NU trebuie citit din body");
});
