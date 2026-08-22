// adeziune.test.mjs — cererea de membru pe site, pe handlerul REAL.
//
// Depunerea publică (cu acord GDPR consemnat), drumul statutar al stării (Art. 15) și
// gardurile: robotul primește succes prefăcut, respingerea cere motiv, dovada e păzită.
//   node --test netlify/functions/_comun/adeziune.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { bootstrapMockModule, magazieFalsa, mockBlobs, reqJSON } from "./_harness.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("adeziunea — sărită (mock.module indisponibil)", { skip: true }, () => {});
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
  const handler = (await import("../adeziune.mjs")).default;

  const COD_REG = "cod-registrator-de-proba";
  const JETON_DISP = "jeton-dispozitiv-de-proba";
  const magazieCuRegistrator = () => magazieFalsa({
    ["registrator/" + sha256(COD_REG)]: { nume: "Maria Registrator", email: "registratura@example.ro" },
    ["dispozitiv/" + sha256(JETON_DISP)]: { rol: "registratura", expira: new Date(Date.now() + 3600e3).toISOString() },
  });

  const post = async (body) => {
    const r = await handler(reqJSON(body));
    return { status: r.status, corp: await r.json() };
  };

  const CERERE = {
    actiune: "depune", nume: "Elena Candidat", email: "elena@example.com", telefon: "0712345678",
    localitate: "Caransebes", judet: "Caras-Severin", acordGdpr: true, amCititActele: true,
  };

  test("depunere -> lista registraturii -> drumul stării până la admitere", async () => {
    suport.magazie = magazieCuRegistrator();
    trimise.length = 0;

    const dep = await post(CERERE);
    assert.equal(dep.status, 200, JSON.stringify(dep.corp));
    assert.ok(trimise.some((e) => e.to[0].email === "elena@example.com"), "confirmarea pleacă pe e-mail");

    // Acordul GDPR se consemnează cu text și versiune, ca la buletin.
    const cheie = [...suport.magazie._map.keys()].find((k) => k.startsWith("adeziune/"));
    const c = suport.magazie._map.get(cheie);
    assert.equal(c.stare, "noua");
    assert.ok(c.acord && c.acord.text && c.acord.versiune, "acordul GDPR se consemnează cu text și versiune");

    const lista = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "lista" });
    assert.equal(lista.status, 200, JSON.stringify(lista.corp));
    assert.equal(lista.corp.cereri.length, 1);
    const id = lista.corp.cereri[0].id;

    for (const stare of ["verificata", "avizata"]) {
      const r = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "stare", id, stare });
      assert.equal(r.status, 200, stare + ": " + JSON.stringify(r.corp));
    }
    trimise.length = 0;
    const admisa = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "stare", id, stare: "admisa" });
    assert.equal(admisa.status, 200);
    assert.ok(trimise.some((e) => e.to[0].email === "elena@example.com"), "admiterea pleacă pe e-mail");
    assert.equal(suport.magazie._map.get("adeziune/" + id).istoric.length, 4, "fiecare pas rămâne în istoric");
  });

  test("gardurile: fără acord GDPR nu trece, robotul primește succes prefăcut, respingerea cere motiv", async () => {
    suport.magazie = magazieCuRegistrator();

    const faraAcord = await post({ ...CERERE, acordGdpr: false });
    assert.equal(faraAcord.status, 400);

    const robot = await post({ ...CERERE, website: "spam" });
    assert.equal(robot.status, 200, "robotul primește succes prefăcut, nu un indiciu");
    assert.ok(![...suport.magazie._map.keys()].some((k) => k.startsWith("adeziune/")), "dar nimic nu se scrie");

    await post(CERERE);
    const lista = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "lista" });
    const id = lista.corp.cereri[0].id;
    // Respingerea vine DUPĂ verificarea secretariatului (harta tranzițiilor).
    await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "stare", id, stare: "verificata" });
    const faraMotiv = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "stare", id, stare: "respinsa" });
    assert.equal(faraMotiv.status, 400, "respingerea fără motiv nu trece");
    const cu = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "stare", id, stare: "respinsa", motiv: "Lipsesc actele cerute." });
    assert.equal(cu.status, 200);

    // Lista și dovada NU se văd fără cod sau fără dispozitiv.
    const faraCod = await post({ actiune: "lista" });
    assert.equal(faraCod.status, 401);
    const faraDisp = await post({ cod: COD_REG, actiune: "lista" });
    assert.equal(faraDisp.status, 403);
  });

  test("drumul stării nu curge înapoi și nu se repetă: harta tranzițiilor + jurnalul hotărârii", async () => {
    suport.magazie = magazieCuRegistrator();
    await post(CERERE);
    const lista = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "lista" });
    const id = lista.corp.cereri[0].id;

    // Nu se sare peste secretariat: din „nouă" direct în „avizată" nu se poate.
    const saritura = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "stare", id, stare: "avizata" });
    assert.equal(saritura.status, 409);

    await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "stare", id, stare: "verificata" });
    trimise.length = 0;
    await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "stare", id, stare: "admisa" });
    // Dublu-clic pe „Admisă": a doua tranziție e refuzată, deci UN SINGUR bun venit.
    const dublura = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "stare", id, stare: "admisa" });
    assert.equal(dublura.status, 409);
    assert.equal(trimise.filter((e) => /admisă/.test(e.subject)).length, 1, "un singur e-mail de bun venit");
    // Din „admisă" nu se mai pleacă nicăieri.
    const inapoi = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "stare", id, stare: "verificata" });
    assert.equal(inapoi.status, 409);

    // Hotărârea lasă urmă: fapta există și jurnalul are intrări pentru tranziții.
    const { FAPTE } = await import("./registru-jurnal.mjs");
    assert.ok(FAPTE["adeziune-hotarare"], "fapta adeziune-hotarare lipsește din FAPTE");
    const intrari = [...suport.magazie._map.keys()].filter((k) => k.startsWith("jurnal/"));
    assert.ok(intrari.length >= 2, "tranzițiile trebuie să lase urme în jurnal");
  });
}
