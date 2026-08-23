// buletin-orfan.test.mjs — abonarea orfană (cazul Nicula, 23.08.2026), pe handlerul REAL.
//
// Simptomul: platforma spunea „neabonată", dar abonarea răspundea „adresa este deja
// abonată de alt membru" — înregistrarea adresei purta o insignă MOARTĂ (cod regenerat
// sau abonare dinaintea refactorului identității). Legea de acum: orfanele se preiau;
// adresa unui stăpân ÎN VIAȚĂ rămâne de neatins.
//   node --test netlify/functions/_comun/buletin-orfan.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { bootstrapMockModule, magazieFalsa, mockBlobs, reqJSON } from "./_harness.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("abonarea orfană — sărită (mock.module indisponibil)", { skip: true }, () => {});
} else {
  const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

  const suport = { magazie: magazieFalsa({}) };
  mockBlobs({
    get: (...a) => suport.magazie.get(...a),
    getWithMetadata: (...a) => suport.magazie.getWithMetadata(...a),
    setJSON: (...a) => suport.magazie.setJSON(...a),
    set: (...a) => suport.magazie.set(...a),
    delete: (...a) => suport.magazie.delete(...a),
    list: (...a) => suport.magazie.list(...a),
  });
  const handler = (await import("../buletin-cursuri.mjs")).default;

  const COD_EA = "ARB-NICULA01";
  const INSIGNA_EA = sha256(COD_EA);
  const COD_ALTA = "ARB-COLEGA02";
  const INSIGNA_ALTA = sha256(COD_ALTA);
  const EMAIL = "maria@example.ro";
  const INSIGNA_MOARTA = "f".repeat(64);   // un cod vechi, regenerat — nu mai există nicăieri

  const post = async (body) => {
    const r = await handler(reqJSON(body));
    return { status: r.status, corp: await r.json() };
  };

  test("cazul Nicula: adresa legată de o insignă moartă se poate re-abona de omul ei", async () => {
    suport.magazie = magazieFalsa({
      ["candidat/" + INSIGNA_EA]: { nume: "Nicula Maria Alina" },
      // Abonarea veche, orfană: aceeași adresă, dar insigna unui candidat care nu mai există.
      ["abonat/" + sha256(EMAIL)]: { email: EMAIL, membruId: INSIGNA_MOARTA, nume: "Nicula Maria Alina", creat: "2026-07-01" },
    });
    // Double opt-in: abonarea creează o cerere în așteptare + trimite confirmarea; adresa
    // NU se rescrie încă (stăpânul MORT rămâne pe abonare până la confirmare).
    const r = await post({ actiune: "aboneaza", cid: COD_EA, email: EMAIL });
    assert.equal(r.status, 200, JSON.stringify(r.corp));
    assert.equal(r.corp.confirmare, true, "abonarea cere confirmare pe e-mail");
    assert.equal(suport.magazie._map.get("abonat/" + sha256(EMAIL)).membruId, INSIGNA_MOARTA,
      "până la confirmare, abonarea rămâne cum era");
    // Omul apasă linkul din e-mail (jetonul din cererea în așteptare).
    const jeton = [...suport.magazie._map.keys()].find((k) => k.startsWith("buletin-scoala-asteptare/"))
      ?.slice("buletin-scoala-asteptare/".length);
    assert.ok(jeton, "s-a creat o cerere în așteptare cu jeton");
    const conf = await post({ actiune: "confirma-abonare", jeton });
    assert.equal(conf.status, 200, JSON.stringify(conf.corp));
    const inreg = suport.magazie._map.get("abonat/" + sha256(EMAIL));
    assert.equal(inreg.membruId, INSIGNA_EA, "după confirmare, adresa e legată de insigna ei ACTUALĂ");
    assert.equal(inreg.creat, "2026-07-01", "vechimea abonării se păstrează");
    assert.ok(!suport.magazie._map.has("buletin-scoala-asteptare/" + jeton), "cererea în așteptare se stinge");
  });

  test("double opt-in: adresa unui terț NU intră pe listă fără confirmare", async () => {
    suport.magazie = magazieFalsa({ ["candidat/" + INSIGNA_EA]: { nume: "Candidat" } });
    const TERT = "sef@firma.ro";
    const r = await post({ actiune: "aboneaza", cid: COD_EA, email: TERT });
    assert.equal(r.status, 200);
    assert.equal(r.corp.confirmare, true);
    assert.ok(!suport.magazie._map.has("abonat/" + sha256(TERT)), "terțul NU e pe listă fără să fi confirmat");
    assert.ok([...suport.magazie._map.keys()].some((k) => k.startsWith("buletin-scoala-asteptare/")),
      "există doar o cerere în așteptare");
  });

  test("protecția rămâne: adresa unui stăpân ÎN VIAȚĂ nu se poate prelua și nici dezabona de altcineva", async () => {
    suport.magazie = magazieFalsa({
      ["candidat/" + INSIGNA_EA]: { nume: "Nicula Maria Alina" },
      ["candidat/" + INSIGNA_ALTA]: { nume: "Colega Vie" },
      ["abonat/" + sha256(EMAIL)]: { email: EMAIL, membruId: INSIGNA_ALTA, nume: "Colega Vie" },
    });
    const fura = await post({ actiune: "aboneaza", cid: COD_EA, email: EMAIL });
    assert.equal(fura.status, 409, "adresa altui membru viu rămâne de neatins");
    const scoate = await post({ actiune: "dezaboneaza", cid: COD_EA, email: EMAIL });
    assert.equal(scoate.status, 403, "nici dezabonarea adresei altuia nu trece");
    assert.ok(suport.magazie._map.has("abonat/" + sha256(EMAIL)), "abonarea colegei rămâne");
  });

  test("dezabonarea propriei adrese orfane trece (GDPR: ieșirea nu se blochează)", async () => {
    suport.magazie = magazieFalsa({
      ["candidat/" + INSIGNA_EA]: { nume: "Nicula Maria Alina" },
      ["abonat/" + sha256(EMAIL)]: { email: EMAIL, membruId: INSIGNA_MOARTA },
    });
    const r = await post({ actiune: "dezaboneaza", cid: COD_EA, email: EMAIL });
    assert.equal(r.status, 200, JSON.stringify(r.corp));
    assert.ok(!suport.magazie._map.has("abonat/" + sha256(EMAIL)));
  });
}
