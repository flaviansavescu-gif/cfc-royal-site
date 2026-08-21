// omologare-comenzi.test.mjs — cererea de omologare și comenzile de servicii, pe handlerele REALE.
//
// Omologarea: publicul cere (fără cod), serverul găsește câinele pe oricare din cele trei
// uși și spune cinstit ce vede în registrul de campionate; registratura operează sau
// respinge cu motiv. Comenzile: membrul comandă cu dovada, registratura finalizează.
// Tot aici: serviciile comandabile EXISTĂ în tarife.ts (sursa unică a sumelor).
//   node --test netlify/functions/_comun/omologare-comenzi.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { bootstrapMockModule, magazieFalsa, mockBlobs, reqJSON } from "./_harness.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("omologarea și comenzile — sărite (mock.module indisponibil)", { skip: true }, () => {});
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
  const omologare = (await import("../omologare.mjs")).default;
  const comenzi = (await import("../comenzi.mjs")).default;
  const { SERVICII } = await import("../comenzi.mjs");

  const COD_MEMBRU = "cod-membru-de-proba";
  const COD_REG = "cod-registrator-de-proba";
  const JETON_DISP = "jeton-dispozitiv-de-proba";
  const SERIE = "CFCR-P-2026-0001";
  const CIP = "642000000000001";

  const magazieCuLumea = () => magazieFalsa({
    ["membru/" + sha256(COD_MEMBRU)]: { nume: "Ion Crescator", email: "ion@example.ro", cotizatiePana: "2099-01-01" },
    ["registrator/" + sha256(COD_REG)]: { nume: "Maria Registrator", email: "registratura@example.ro" },
    ["dispozitiv/" + sha256(JETON_DISP)]: { rol: "registratura", expira: new Date(Date.now() + 3600e3).toISOString() },
    ["pedigree/" + SERIE]: { serie: SERIE, caine: { nume: "Rex de Proba", rasa: "Ciobanesc German", microcip: CIP } },
    ["pedigree-caine/" + CIP]: { serie: SERIE },
    // Registrul de campionate, publicat de Manager: un titlu îndeplinit, unul omologat.
    ["titluri/" + CIP]: { campionate: [
      { cod: "campion_national", eticheta: "Campion Național", indeplinit: true, detaliu: "6/6 CAC, 4 arbitri", omologari: [] },
      { cod: "junior_champion", eticheta: "Campion Junior", indeplinit: true, detaliu: "", omologari: [2025] },
    ] },
  });

  const postO = async (b) => { const r = await omologare(reqJSON(b)); return { status: r.status, corp: await r.json() }; };
  const postC = async (b) => { const r = await comenzi(reqJSON(b)); return { status: r.status, corp: await r.json() }; };

  test("omologarea: cererea publică -> coada -> operarea; dublurile și titlul deja omologat pică", async () => {
    suport.magazie = magazieCuLumea();
    trimise.length = 0;

    // Robotul primește succes prefăcut și nu scrie nimic.
    const robot = await postO({ actiune: "cere", cautat: SERIE, titlu: "campion_national", nume: "Robot", email: "r@x.ro", website: "spam" });
    assert.equal(robot.status, 200);
    assert.ok(![...suport.magazie._map.keys()].some((k) => k.startsWith("omologare/")));

    // Titlul deja omologat nu se mai cere.
    const deja = await postO({ actiune: "cere", cautat: SERIE, titlu: "junior_champion", nume: "Ion Crescator", email: "ion@example.ro" });
    assert.equal(deja.status, 409);

    // Cererea bună — căutată pe MICROCIP (a doua ușă), nu pe serie.
    const cerere = await postO({ actiune: "cere", cautat: CIP, titlu: "campion_national", nume: "Ion Crescator", email: "ion@example.ro" });
    assert.equal(cerere.status, 200, JSON.stringify(cerere.corp));
    assert.ok(trimise.some((e) => e.to[0].email === "ion@example.ro"), "solicitantul primește confirmarea");

    // A doua cerere pentru același titlu, cât e în lucru: refuzată.
    const dubla = await postO({ actiune: "cere", cautat: SERIE, titlu: "campion_national", nume: "Ion Crescator", email: "ion@example.ro" });
    assert.equal(dubla.status, 409);

    const coada = await postO({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "de-lucru" });
    assert.equal(coada.corp.cereri.length, 1);
    assert.equal(coada.corp.cereri[0].indeplinitInRegistru, true, "registrul spune cinstit ce vede");
    const id = coada.corp.cereri[0].id;

    trimise.length = 0;
    const op = await postO({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "opereaza", id });
    assert.equal(op.status, 200, JSON.stringify(op.corp));
    assert.equal(suport.magazie._map.get("omologare/" + id).stare, "operata");
    assert.ok(trimise.some((e) => /omologat/.test(e.subject)), "felicitarea pleacă pe e-mail");

    // Judecata nu se repetă.
    const iar = await postO({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "opereaza", id });
    assert.equal(iar.status, 409);
  });

  test("comenzile: membrul comandă cu dovadă -> registratura finalizează; serviciul necunoscut pică", async () => {
    suport.magazie = magazieCuLumea();
    trimise.length = 0;

    const aiurea = await postC({ cod: COD_MEMBRU, actiune: "comanda", serviciu: "ceva-inventat" });
    assert.equal(aiurea.status, 400);

    const com = await postC({ cod: COD_MEMBRU, actiune: "comanda", serviciu: "carnet-palmares",
      detalii: "CFCR-P-2026-0001", dovada: "AAAA", dovadaTip: "application/pdf" });
    assert.equal(com.status, 200, JSON.stringify(com.corp));
    assert.ok(trimise.some((e) => e.to[0].email === "ion@example.ro"));

    const coada = await postC({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "de-lucru" });
    assert.equal(coada.corp.comenzi.length, 1);
    const id = coada.corp.comenzi[0].id;
    const dovada = await postC({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "dovada", id });
    assert.equal(dovada.corp.tip, "application/pdf");

    trimise.length = 0;
    const fin = await postC({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "finalizeaza", id, nota: "Actele au plecat azi." });
    assert.equal(fin.status, 200);
    assert.equal(suport.magazie._map.get("comanda/" + id).stare, "finalizata");
    assert.ok(trimise.some((e) => /gata/.test(e.subject)));

    // Membrul își vede comanda; respingerea altei comenzi cere motiv.
    const ale = await postC({ cod: COD_MEMBRU, actiune: "ale-mele" });
    assert.equal(ale.corp.comenzi[0].stare, "finalizata");
  });

  test("serviciile comandabile există în tarife.ts (sursa unică a sumelor)", () => {
    const sursa = readFileSync(new URL("../../../src/data/tarife.ts", import.meta.url), "utf8");
    for (const id of Object.keys(SERVICII))
      assert.ok(sursa.includes(`id: "${id}"`), `serviciul „${id}" nu există în tarife.ts`);
  });
}
