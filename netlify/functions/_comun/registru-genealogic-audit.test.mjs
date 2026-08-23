// registru-genealogic-audit.test.mjs — reparațiile din auditul registrului genealogic (23.08),
// pe handlerele REALE: emiterea nu-și corupe dosarul, iar un microcip nu leagă două certificate.
//   node --test netlify/functions/_comun/registru-genealogic-audit.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, scryptSync } from "node:crypto";
import { bootstrapMockModule, magazieFalsa, mockBlobs, reqJSON } from "./_harness.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("auditul genealogic — sărit (mock.module indisponibil)", { skip: true }, () => {});
} else {
  const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
  delete process.env.BREVO_API_KEY;   // fără poștă → 2FA neoperațional → nu cere dispozitiv
  const COD_ADMIN = "cod-admin-de-proba";
  process.env.ADMIN_HASH = scryptSync(sha256(COD_ADMIN), "5bc690c359954798d5149721d0f7cada", 32).toString("hex");

  const suport = { magazie: magazieFalsa({}) };
  mockBlobs({
    get: (...a) => suport.magazie.get(...a),
    getWithMetadata: (...a) => suport.magazie.getWithMetadata(...a),
    setJSON: (...a) => suport.magazie.setJSON(...a),
    set: (...a) => suport.magazie.set(...a),
    delete: (...a) => suport.magazie.delete(...a),
    list: (...a) => suport.magazie.list(...a),
  });
  const pedigree = (await import("../registru-pedigree.mjs")).default;
  const post = async (b) => { const r = await pedigree(reqJSON(b)); return { status: r.status, corp: await r.json() }; };

  const dosarGata = (id, serie, cip) => ({
    ["dmf/" + id]: {
      serie, rasa: "Ciobănesc German", dataFatarii: "2026-05-01",
      membruNume: "Ion Crescator", afix: "de Proba", nrAfix: "AFX/1", numarWDF: 77,
      ascendenta: { T: { nume: "Tata", nr: "CFCR 1" }, M: { nume: "Mama", nr: "CFCR 2" } },
      pui: [{ nume: "Pui", sex: "M", identificare: cip }],
      stare: "verificat",
    },
  });

  test("emiterea nu-și corupe dosarul dacă e șters concurent (folosește `d`, nu recitirea)", async () => {
    suport.magazie = magazieFalsa(dosarGata("D1", "CFCR-DMF-2026-0001", "941000000000001"));
    const r = await post({ cod: COD_ADMIN, actiune: "emite", id: "D1", pui: [{ index: 0 }] });
    assert.equal(r.status, 200, JSON.stringify(r.corp));
    const dosar = suport.magazie._map.get("dmf/D1");
    // Dosarul rămâne ÎNTREG (nu {stare:"emis"} gol): datele care ancorează certificatul sunt acolo.
    assert.equal(dosar.stare, "emis");
    assert.equal(dosar.serie, "CFCR-DMF-2026-0001");
    assert.ok(Array.isArray(dosar.pui) && dosar.pui.length === 1, "puii NU s-au pierdut");
    assert.ok(dosar.ascendenta?.T, "ascendența NU s-a pierdut");
  });

  test("un microcip nu leagă două certificate: al doilea NU suprascrie indexul, se consemnează coliziunea", async () => {
    const CIP = "941000000000009";
    suport.magazie = magazieFalsa({
      ...dosarGata("A", "CFCR-DMF-2026-0010", CIP),
      ...dosarGata("B", "CFCR-DMF-2026-0011", CIP),   // alt cuib, ACELAȘI cip (eroare de introducere)
    });

    const prima = await post({ cod: COD_ADMIN, actiune: "emite", id: "A", pui: [{ index: 0 }] });
    const serieA = prima.corp.emise[0].serie;
    const indexInitial = suport.magazie._map.get("pedigree-caine/" + CIP).serie;
    assert.equal(indexInitial, serieA, "indexul cipului arată spre primul certificat");

    const aDoua = await post({ cod: COD_ADMIN, actiune: "emite", id: "B", pui: [{ index: 0 }] });
    assert.equal(aDoua.status, 200, JSON.stringify(aDoua.corp));
    // Certificatul B se emite, DAR indexul cipului rămâne la A (nu se ascunde primul câine).
    assert.equal(suport.magazie._map.get("pedigree-caine/" + CIP).serie, serieA,
      "indexul cipului NU a fost suprascris de al doilea certificat");
    assert.ok(aDoua.corp.coliziuniCip?.length >= 1, "coliziunea e raportată registraturii");
    // Fapta e în jurnal.
    const jurnal = [...suport.magazie._map.keys()].some((k) => k.startsWith("jurnal/"));
    assert.ok(jurnal, "coliziunea lasă urmă în jurnal");
  });

  test("faptele noi sunt în registrul FAPTE (altfel jurnalul le-ar arunca)", async () => {
    const { FAPTE } = await import("./registru-jurnal.mjs");
    assert.ok(FAPTE["microcip-coliziune"], "fapta microcip-coliziune lipsește din FAPTE");
  });
}
