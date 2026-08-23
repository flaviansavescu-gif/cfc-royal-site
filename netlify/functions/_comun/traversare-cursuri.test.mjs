// traversare-cursuri.test.mjs — cele două traversări critice din auditul de site (23.08),
// pe handlerele REALE: baremul lectorului nu se poate fura prin jcr-resurse, iar
// paa-standarde nu mai lasă traversare anonimă. Plus plasa: nicio funcție din platforma
// Școlii nu mai interpolează un id de la client fără segmentCheieValid.
//   node --test netlify/functions/_comun/traversare-cursuri.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootstrapMockModule, magazieFalsa, mockBlobs, reqJSON } from "./_harness.mjs";

const DIR = fileURLToPath(new URL("../", import.meta.url));

// —— Proba statică (rulează mereu): platforma Școlii importă gardianul de chei ——
test("funcțiile JCR/PAA/cursuri care interpolează un id de client importă segmentCheieValid", () => {
  const TINTE = [
    "jcr-resurse", "paa-standarde", "jcr-sesiuni", "jcr-raport", "jcr-raspuns",
    "paa-exercitii", "paa-imagine", "paa-sesiuni", "examen-final", "acte-scoala",
    "autorizare-cursuri", "asistente-cursuri", "arbitri-cursuri", "interese-rase",
    "candidati-cursuri", "buletin-cursuri",
  ];
  const lipsa = TINTE.filter((n) => !readFileSync(DIR + n + ".mjs", "utf8").includes("segmentCheieValid"));
  assert.deepEqual(lipsa, [], "aceste funcții nu importă/folosesc segmentCheieValid — risc de traversare SEC-001");
});

if (!bootstrapMockModule(import.meta.url)) {
  test("traversările — sărite (mock.module indisponibil)", { skip: true }, () => {});
} else {
  const suport = { magazie: magazieFalsa({}) };
  mockBlobs({
    get: (...a) => suport.magazie.get(...a),
    getWithMetadata: (...a) => suport.magazie.getWithMetadata(...a),
    setJSON: (...a) => suport.magazie.setJSON(...a),
    set: (...a) => suport.magazie.set(...a),
    delete: (...a) => suport.magazie.delete(...a),
    list: (...a) => suport.magazie.list(...a),
  });
  const paaStandarde = (await import("../paa-standarde.mjs")).default;
  const post = async (fn, b) => { const r = await fn(reqJSON(b)); return { status: r.status, corp: await r.json() }; };

  test("paa-standarde: traversarea anonimă e respinsă, cererea validă merge", async () => {
    suport.magazie = magazieFalsa({
      "std/ciobanesc-german/2026-01": { rasa: "ciobanesc-german", versiune: "2026-01", metrics: [] },
      "ex-raspuns/secret/candidat": { raspuns: "date private ale altui candidat" },
    });
    // Traversare: rasa="..", versiune="../ex-raspuns/secret/candidat" → ar ajunge la datele altcuiva.
    const atac = await post(paaStandarde, { actiune: "detalii", rasa: "..", versiune: "../ex-raspuns/secret/candidat" });
    assert.equal(atac.status, 400, JSON.stringify(atac.corp));
    assert.match(atac.corp.eroare, /invalid/i);
    // Cererea legitimă trece.
    const ok = await post(paaStandarde, { actiune: "detalii", rasa: "ciobanesc-german", versiune: "2026-01" });
    assert.equal(ok.status, 200, JSON.stringify(ok.corp));
    assert.equal(ok.corp.standard.rasa, "ciobanesc-german");
  });

  test("jcr-resurse: mediaId cu traversare spre barem e respins", async () => {
    const jcrResurse = (await import("../jcr-resurse.mjs")).default;
    suport.magazie = magazieFalsa({
      "session/S1": { id: "S1", status: "published", participanti: ["cand-insigna"] },
      "reference/S1": { barem: "evaluarea de referință a lectorului" },
    });
    // Chiar și fără a fi participant, garda de cheie lovește ÎNAINTE — mediaId invalid = 400.
    const atac = await post(jcrResurse, { actiune: "imagine", id: "S1", cid: "cod-candidat", mediaId: "../../reference/S1" });
    assert.equal(atac.status, 400, JSON.stringify(atac.corp));
    assert.match(atac.corp.eroare, /invalid/i);
  });
}
