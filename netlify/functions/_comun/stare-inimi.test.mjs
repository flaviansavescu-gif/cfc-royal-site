// stare-inimi.test.mjs — fereastra pe care o citește paznicul din GitHub Actions.
//
// Bug-ul istoric (reparat): paznic.yml verifica `grep -q '"ok":true'` NEANCORAT. Răspunsul
// are DOUĂ câmpuri `ok` — cel de sus (adevărul) și `posta.ok`. Când o inimă murea dar Brevo
// era sănătos, substringul `"ok":true` din `posta` păcălea grep-ul → rulare verde → niciun
// e-mail. Paznicul paznicilor tăcea exact în cazul lui central. Probele de aici țin lipite
// de cod: (1) verdictul de sus e neambiguu, (2) magazia moartă cade fail-CLOSED, (3) fereastra
// publică NU scurge soldul de credite Brevo.
//   node --test netlify/functions/_comun/stare-inimi.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrapMockModule, magazieFalsa, mockBlobs } from "./_harness.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("stare-inimi — sărită (mock.module indisponibil)", { skip: true }, () => {});
} else {
  const acum = () => new Date().toISOString();
  // Toate cele 8 inimi, bătute chiar acum (proaspete → niciuna întârziată).
  const proaspete = () => Object.fromEntries(Object.keys(INIMI).map((n) => ["inima/" + n, { la: acum() }]));

  const suport = { magazie: magazieFalsa({}) };
  mockBlobs({
    get: (...a) => suport.magazie.get(...a),
    getWithMetadata: (...a) => suport.magazie.getWithMetadata(...a),
    setJSON: (...a) => suport.magazie.setJSON(...a),
    set: (...a) => suport.magazie.set(...a),
    delete: (...a) => suport.magazie.delete(...a),
    list: (...a) => suport.magazie.list(...a),
  });
  // Import DINAMIC, după instalarea mock-ului, ca `getStore` din inima.mjs/stare-inimi.mjs
  // să lege magazia falsă, nu pe cea reală (importul static ar încărca @netlify/blobs prea devreme).
  const { INIMI } = await import("./inima.mjs");
  const handler = (await import("../stare-inimi.mjs")).default;
  const cere = async () => {
    const r = await handler();
    const text = await r.text();
    return { text, corp: JSON.parse(text) };
  };

  test("inimă moartă + poșta sănătoasă → top-level ok=false (substringul păcălește, parse-ul NU)", async () => {
    suport.magazie = magazieFalsa({
      ...proaspete(),
      "inima/registru-backup": { la: "2020-01-01T00:00:00.000Z" }, // moartă demult
      "posta-sanatate": { ok: true, detaliu: "cheia e validă · credite rămase: 300", verificatLa: acum() },
    });
    const { text, corp } = await cere();
    assert.equal(corp.ok, false, "verdictul de NIVEL SUPERIOR e nesănătos");
    assert.ok(corp.intarziate.some((x) => x.nume === "registru-backup"), "backup-ul apare ca întârziat");
    // Exact capcana veche: substringul `"ok":true` (din posta) EXISTĂ în răspuns…
    assert.ok(text.includes('"ok":true'), "substringul 'ok:true' există (din posta)");
    // …dar citit corect (jq/parse), `.ok` de sus e false. De-aceea paznicul folosește jq, nu grep.
    assert.equal(JSON.parse(text).ok, false, "citit ca .ok de sus, verdictul e false");
  });

  test("magazia acces moartă → fail-CLOSED (ok=false, magazie:false), nu liniște falsă", async () => {
    suport.magazie = {
      async get() { throw new Error("acces jos"); },
      async getWithMetadata() { throw new Error("acces jos"); },
      async setJSON() { throw new Error("acces jos"); },
      async set() { throw new Error("acces jos"); },
      async delete() { throw new Error("acces jos"); },
      async list() { throw new Error("acces jos"); },
    };
    const { corp } = await cere();
    assert.equal(corp.ok, false, "oarbă = NU sănătoasă");
    assert.equal(corp.magazie, false, "semnalează explicit magazia moartă");
  });

  test("fereastra publică NU scurge detaliul poștei (soldul de credite Brevo)", async () => {
    suport.magazie = magazieFalsa({
      ...proaspete(),
      "posta-sanatate": { ok: true, detaliu: "cheia e validă · credite rămase: 300", verificatLa: acum() },
    });
    const { text, corp } = await cere();
    assert.equal(corp.ok, true, "totul proaspăt → sănătos");
    assert.equal(corp.posta.ok, true);
    assert.ok(!("detaliu" in corp.posta), "detaliu NU mai iese pe fereastra publică");
    assert.ok(!text.includes("credite"), "soldul de credite nu apare nicăieri în răspuns");
  });

  test("o inimă nebătută (absentă) nu alarmează, dar una întârziată da", async () => {
    // O cheie absentă = nebătută (informativ), nu întârziată → nu strică ok-ul.
    suport.magazie = magazieFalsa({ "inima/monitor-flux": { la: acum() }, "posta-sanatate": { ok: true } });
    const { corp } = await cere();
    assert.equal(corp.ok, true, "restul nebătute (absente) nu alarmează");
    assert.ok(corp.nebatute.length > 0, "celelalte apar ca nebătute, informativ");
  });
}
