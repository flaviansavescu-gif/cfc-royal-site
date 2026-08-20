// poarta-scrieri.test.mjs — comutatorul de urgență al scrierilor publice.
//   node --test netlify/functions/_comun/poarta-scrieri.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bootstrapMockModule, magazieFalsa, mockBlobs } from "./_harness.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("poarta scrierilor — sărită (mock.module indisponibil)", { skip: true }, () => {});
} else {
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

  // `mock.module` se instalează O SINGURĂ dată — al doilea apel nu-l înlocuiește. Ca
  // fiecare probă să-și aducă magazia ei, mock-ul delegă către un suport MUTABIL.
  const suport = { magazie: magazieFalsa({}) };
  mockBlobs({
    get: (...a) => suport.magazie.get(...a),
    setJSON: (...a) => suport.magazie.setJSON(...a),
    delete: (...a) => suport.magazie.delete(...a),
    list: (...a) => suport.magazie.list(...a),
    getWithMetadata: (...a) => suport.magazie.getWithMetadata(...a),
  });
  const { refuzaDacaInchis } = await import("./poarta-scrieri.mjs");

  test("poarta închisă => refuz 503, cu motivul în mesaj", async () => {
    suport.magazie = magazieFalsa({ "poarta-scrieri": { inchis: true, motiv: "verificăm un dosar" } });
    const r = await refuzaDacaInchis(json);
    assert.ok(r, "trebuie refuzat");
    assert.equal(r.status, 503);
    const corp = await r.json();
    assert.match(corp.eroare, /doar citiri/);
    assert.match(corp.eroare, /verificăm un dosar/);
  });

  test("poarta deschisă (cheia lipsește) => trece", async () => {
    suport.magazie = magazieFalsa({});
    assert.equal(await refuzaDacaInchis(json), null);
  });

  test("FAIL-OPEN: magazia moare => poarta se consideră deschisă", async () => {
    suport.magazie = { get: async () => { throw new Error("magazia nu răspunde"); } };
    assert.equal(await refuzaDacaInchis(json), null,
      "un comutator de urgență blocat singur pe închis ar fi el însuși o avarie");
  });

  test("toate cele 4 uși publice de scriere au gardul", () => {
    for (const f of ["inscriere-expo", "registru-dmf", "registru-sanatate", "registru-canise"]) {
      const sursa = readFileSync(new URL("../" + f + ".mjs", import.meta.url), "utf8");
      assert.ok(sursa.includes("refuzaDacaInchis"), f + " nu mai cheamă poarta scrierilor");
    }
  });

  test("faptele comutatorului sunt în registrul FAPTE (altfel jurnalul le-ar arunca)", async () => {
    const { FAPTE } = await import("./registru-jurnal.mjs");
    assert.ok(FAPTE["poarta-inchisa"], "fapta poarta-inchisa lipsește");
    assert.ok(FAPTE["poarta-deschisa"], "fapta poarta-deschisa lipsește");
  });
}
