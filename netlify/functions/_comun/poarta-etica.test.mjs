// poarta-etica.test.mjs — poarta Codului Etic, cap-coadă, pe handlerele REALE.
//
// Legea (23.08.2026): fără versiunea curentă a Codului asumată, formarea e închisă —
// dar drumul spre asumare, starea examenului și contestația rămân libere (fără cerc
// vicios), iar avaria magaziei NU închide școala (fail-open).
//   node --test netlify/functions/_comun/poarta-etica.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { bootstrapMockModule, magazieFalsa, mockBlobs, reqJSON } from "./_harness.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("poarta etică — sărită (mock.module indisponibil)", { skip: true }, () => {});
} else {
  const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

  delete process.env.BREVO_API_KEY;   // poșta tace; testele corectate se salvează oricum

  const suport = { magazie: magazieFalsa({}) };
  mockBlobs({
    get: (...a) => suport.magazie.get(...a),
    getWithMetadata: (...a) => suport.magazie.getWithMetadata(...a),
    setJSON: (...a) => suport.magazie.setJSON(...a),
    set: (...a) => suport.magazie.set(...a),
    delete: (...a) => suport.magazie.delete(...a),
    list: (...a) => suport.magazie.list(...a),
  });
  const asistente = (await import("../asistente-cursuri.mjs")).default;
  const examen = (await import("../examen-final.mjs")).default;
  const testModul = (await import("../test-modul.mjs")).default;
  const formare = (await import("../formare-arbitri.mjs")).default;
  const codEtic = (await import("../cod-etic.mjs")).default;
  const { refuzaFaraCodEtic } = await import("./poarta-etica.mjs");
  const { VERSIUNE } = await import("../cod-etic.mjs");

  const COD_CANDIDAT = "ARB-ETICPROBA";
  const INSIGNA = sha256(COD_CANDIDAT);
  const COD_ARBITRU = "COL-ETICPROBA";

  const magazieCuScoala = () => magazieFalsa({
    ["candidat/" + INSIGNA]: { nume: "Elena Proba" },
    ["arbitru/" + sha256(COD_ARBITRU)]: { nume: "Arbitru Proba" },
  });

  const post = async (fn, body) => {
    const r = await fn(reqJSON(body));
    return { status: r.status, corp: await r.json() };
  };

  test("fără asumare: formarea refuză peste tot, cu semnalul trebuieAsumat", async () => {
    suport.magazie = magazieCuScoala();

    const parcurs = await post(asistente, { actiune: "parcursul-meu", id: COD_CANDIDAT });
    assert.equal(parcurs.status, 403, JSON.stringify(parcurs.corp));
    assert.equal(parcurs.corp.trebuieAsumat, true);
    assert.equal(parcurs.corp.versiune, VERSIUNE);

    const eu = await post(asistente, { actiune: "eu", id: COD_CANDIDAT });
    assert.equal(eu.status, 403);

    const corectare = await post(testModul, { cod: COD_CANDIDAT, modul: "modul-1", nume: "Elena Proba", raspunsuri: new Array(12).fill(0) });
    assert.equal(corectare.status, 403, "testul nu se corectează fără Codul asumat");
    assert.equal(corectare.corp.trebuieAsumat, true);

    const formareArb = await post(formare, { cod: COD_ARBITRU, actiune: "stare" });
    assert.equal(formareArb.status, 403, "formarea continuă a arbitrilor e tot formare");
  });

  test("ușile libere: starea examenului și contestația NU cer asumarea (fără cerc vicios)", async () => {
    suport.magazie = magazieCuScoala();
    const stare = await post(examen, { cod: COD_CANDIDAT, actiune: "stare" });
    assert.equal(stare.status, 200, JSON.stringify(stare.corp));
    // Contestația e judecată pe fond (nu există încercare de contestat), nu de poarta etică.
    const contesta = await post(examen, { cod: COD_CANDIDAT, actiune: "contesta", motiv: "Motiv de proba suficient de lung." });
    assert.notEqual(contesta.status, 403, "contestația nu e închisă de poarta etică");
    assert.ok(!contesta.corp.trebuieAsumat, "refuzul (dacă e) are alt motiv decât Codul Etic");
  });

  test("drumul spre asumare e liber, iar după asumare totul se deschide", async () => {
    suport.magazie = magazieCuScoala();

    // Starea și asumarea trec FĂRĂ asumare prealabilă — altfel nimeni n-ar mai intra.
    const stare = await post(codEtic, { cid: COD_CANDIDAT, actiune: "stare" });
    assert.equal(stare.status, 200);
    assert.equal(stare.corp.asumat, false);
    const asuma = await post(codEtic, { cid: COD_CANDIDAT, actiune: "asuma" });
    assert.equal(asuma.status, 200, JSON.stringify(asuma.corp));

    const parcurs = await post(asistente, { actiune: "parcursul-meu", id: COD_CANDIDAT });
    assert.equal(parcurs.status, 200, "după asumare, parcursul se deschide");
    const corectare = await post(testModul, { cod: COD_CANDIDAT, modul: "modul-1", nume: "Elena Proba", raspunsuri: new Array(12).fill(0) });
    assert.equal(corectare.status, 200, "după asumare, testele se corectează");

    // Arbitrul își asumă cu codul lui și formarea continuă se deschide.
    await post(codEtic, { cod: COD_ARBITRU, actiune: "asuma" });
    const formareArb = await post(formare, { cod: COD_ARBITRU, actiune: "stare" });
    assert.equal(formareArb.status, 200);
  });

  test("fail-open pe avarie + fără identitate personală poarta nu se aplică", async () => {
    const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s });
    const magazieMoarta = { get: async () => { throw new Error("magazia nu răspunde"); } };
    assert.equal(await refuzaFaraCodEtic(magazieMoarta, INSIGNA, json), null,
      "un sughiț de magazie nu închide școala — poarta refuză doar pe NU citit");
    assert.equal(await refuzaFaraCodEtic(magazieMoarta, null, json), null,
      "fără identitate personală (admin, cod comun), alte porți decid");
  });
}
