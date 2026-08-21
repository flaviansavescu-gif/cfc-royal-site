// termene-reamintiri.test.mjs — termenele testelor, anunțate înainte, pe handlerul REAL.
//
// Drumul întreg: un termen în fereastră -> candidatul ABONAT din cont primește vestea
// direct, cel neabonat ajunge în rezumatul adminului; a doua rulare tace (marcaje);
// termenul mutat redeschide treptele; cine a promovat nu e bătut la cap.
//   node --test netlify/functions/_comun/termene-reamintiri.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { bootstrapMockModule, magazieFalsa, mockBlobs } from "./_harness.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("termenele — sărite (mock.module indisponibil)", { skip: true }, () => {});
} else {
  const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

  process.env.BREVO_API_KEY = "cheie-de-proba";
  const trimise = [];
  const fetchAdevarat = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("api.brevo.com")) {
      trimise.push(JSON.parse(opts.body));
      return new Response("{}", { status: 201 });
    }
    return fetchAdevarat(url, opts);
  };

  const suport = { magazie: magazieFalsa({}) };
  mockBlobs({
    get: (...a) => suport.magazie.get(...a),
    getWithMetadata: (...a) => suport.magazie.getWithMetadata(...a),
    setJSON: (...a) => suport.magazie.setJSON(...a),
    set: (...a) => suport.magazie.set(...a),
    delete: (...a) => suport.magazie.delete(...a),
    list: (...a) => suport.magazie.list(...a),
  });
  const ruleaza = (await import("../termene-reamintiri.mjs")).default;
  const { judecaTermenele } = await import("../termene-reamintiri.mjs");

  const zi = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
  const CID_ABONAT = "a".repeat(64);
  const CID_NEABONAT = "b".repeat(64);
  const CID_PROMOVAT = "c".repeat(64);

  const magazieCuScoala = () => magazieFalsa({
    "termene-module": {
      "modul-3": { pana: zi(5), penalizare: 0 },     // în fereastra de 7 zile
      "modul-9": { pana: zi(60), penalizare: 0 },    // departe — tăcere
    },
    ["candidat/" + CID_ABONAT]: { nume: "Ana Abonata" },
    ["candidat/" + CID_NEABONAT]: { nume: "Nicu Neabonatu" },
    ["candidat/" + CID_PROMOVAT]: { nume: "Petra Promovata" },
    // Abonarea din cont poartă insigna candidatului — legătura candidat -> e-mail.
    ["abonat/" + sha256("ana@example.ro")]: { email: "ana@example.ro", membruId: CID_ABONAT },
    ["abonat/" + sha256("petra@example.ro")]: { email: "petra@example.ro", membruId: CID_PROMOVAT },
    ["progres/" + CID_PROMOVAT + "/modul-3"]: { promovat: true, procent: 90 },
  });

  test("judecata pură: ferestrele de 7 și 2 zile, o treaptă pe zi", () => {
    const acum = Date.now();
    const t = judecaTermenele({
      aproape: { pana: zi(5) }, foarteAproape: { pana: zi(1) },
      departe: { pana: zi(30) }, trecut: { pana: zi(-2) }, faraTermen: { pana: null },
    }, acum);
    assert.deepEqual(t.map((x) => x.slug + ":" + x.treapta.cheia).sort(), ["aproape:p7", "foarteAproape:p2"]);
  });

  test("abonatul e anunțat direct, neabonatul ajunge la admin, promovatul e lăsat în pace", async () => {
    suport.magazie = magazieCuScoala();
    trimise.length = 0;

    const r1 = await ruleaza();
    assert.equal(r1.status, 200);

    const directe = trimise.filter((e) => e.to[0].email === "ana@example.ro");
    assert.equal(directe.length, 1, "abonatul primește vestea direct");
    assert.match(directe[0].subject, /Modulul 3/);
    assert.ok(!trimise.some((e) => e.to[0].email === "petra@example.ro"), "cine a promovat nu e bătut la cap");
    const rezumate = trimise.filter((e) => /alt canal/.test(e.subject));
    assert.equal(rezumate.length, 1, "adminul primește un singur rezumat");
    assert.match(rezumate[0].htmlContent, /Nicu Neabonatu/);
    assert.ok(!/Ana Abonata/.test(rezumate[0].htmlContent), "cel anunțat direct nu mai apare la admin");

    // A doua rulare, aceleași termene: tăcere totală.
    trimise.length = 0;
    await ruleaza();
    assert.equal(trimise.length, 0, "marcajele opresc dublurile");

    // Termenul mutat redeschide treapta — pentru noul termen.
    const termene = suport.magazie._map.get("termene-module");
    suport.magazie._map.set("termene-module", { ...termene, "modul-3": { pana: zi(6), penalizare: 0 } });
    trimise.length = 0;
    await ruleaza();
    assert.equal(trimise.filter((e) => e.to[0].email === "ana@example.ro").length, 1, "termen nou = veste nouă");
  });

  test("inima funcției e în registrul INIMI (altfel paznicul n-ar ști de ea)", async () => {
    const { INIMI } = await import("./inima.mjs");
    assert.ok(INIMI["termene-reamintiri"], "inima termene-reamintiri lipsește");
    assert.ok(INIMI["cotizatie-reamintiri"], "inima cotizatie-reamintiri lipsește");
  });
}
