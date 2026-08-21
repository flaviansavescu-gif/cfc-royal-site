// registru-cotizatie.test.mjs — plata cotizației, cap-coadă, pe handlerele REALE.
//
// Membrul declară (cu dovadă), registratura confirmă -> termenul se prelungește AUTOMAT
// pe fișa membrului, cu jurnalul scris ÎNTÂI. Tot aici: regula termenului (+12 luni de la
// scadența viitoare, nu de la zi), o singură declarație în așteptare, respingerea cu motiv
// și judecata pură a reamintirilor (-30/-7/expirat, fără dubluri).
//   node --test netlify/functions/_comun/registru-cotizatie.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { bootstrapMockModule, magazieFalsa, mockBlobs, reqJSON } from "./_harness.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("cotizația — sărită (mock.module indisponibil)", { skip: true }, () => {});
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
  const handler = (await import("../registru-cotizatie.mjs")).default;
  const { termenNou } = await import("../registru-cotizatie.mjs");
  const { cineDeAmintit } = await import("../cotizatie-reamintiri.mjs");

  const COD_MEMBRU = "cod-membru-de-proba";
  const MID = sha256(COD_MEMBRU);
  const COD_REG = "cod-registrator-de-proba";
  const JETON_DISP = "jeton-dispozitiv-de-proba";

  const magazieCuLumea = () => magazieFalsa({
    ["membru/" + MID]: { nume: "Ion Crescator", email: "ion@example.ro", cotizatiePana: "2026-10-01" },
    ["registrator/" + sha256(COD_REG)]: { nume: "Maria Registrator", email: "registratura@example.ro" },
    ["dispozitiv/" + sha256(JETON_DISP)]: { rol: "registratura", expira: new Date(Date.now() + 3600e3).toISOString() },
  });

  const post = async (body) => {
    const r = await handler(reqJSON(body));
    return { status: r.status, corp: await r.json() };
  };

  test("regula termenului: +12 luni de la scadența viitoare, altfel de la zi", () => {
    const azi = new Date("2026-08-21T12:00:00Z");
    assert.equal(termenNou("2026-10-01", azi), "2027-10-01", "plata înainte de termen nu pierde nimic");
    assert.equal(termenNou("2026-05-01", azi), "2027-08-21", "după expirare, anul curge de la zi");
    assert.equal(termenNou(null, azi), "2027-08-21", "fără termen în fișă, de la zi");
  });

  test("declară -> coada registraturii -> confirmă: termenul se prelungește pe fișă", async () => {
    suport.magazie = magazieCuLumea();
    trimise.length = 0;

    const dec = await post({ cod: COD_MEMBRU, actiune: "declara", dovada: "AAAA", dovadaTip: "image/jpeg", nota: "transfer BT, 21.08" });
    assert.equal(dec.status, 200, JSON.stringify(dec.corp));
    assert.ok(trimise.some((e) => e.to[0].email === "ion@example.ro"), "membrul primește confirmarea declarării");

    // A doua declarație în așteptare e refuzată.
    const dubla = await post({ cod: COD_MEMBRU, actiune: "declara" });
    assert.equal(dubla.status, 409);

    const coada = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "de-confirmat" });
    assert.equal(coada.corp.plati.length, 1);
    assert.equal(coada.corp.plati[0].areDovada, true);
    const id = coada.corp.plati[0].id;

    const dovada = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "dovada", id });
    assert.equal(dovada.corp.dovada, "AAAA");

    trimise.length = 0;
    const conf = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "confirma", id });
    assert.equal(conf.status, 200, JSON.stringify(conf.corp));
    assert.equal(conf.corp.panaLaNoua, "2027-10-01", "+12 luni de la scadența viitoare");
    assert.equal(suport.magazie._map.get("membru/" + MID).cotizatiePana, "2027-10-01", "fișa membrului e prelungită");
    assert.ok(trimise.some((e) => e.to[0].email === "ion@example.ro"), "membrul află noul termen pe e-mail");

    // Aceeași plată nu se confirmă de două ori; membrul își vede starea.
    const iar = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "confirma", id });
    assert.equal(iar.status, 409);
    const aMea = await post({ cod: COD_MEMBRU, actiune: "a-mea" });
    assert.equal(aMea.corp.ultima.stare, "confirmata");
    assert.equal(aMea.corp.ultima.panaLaNoua, "2027-10-01");
  });

  test("respingerea cere motiv; data anume scrisă de registratură trece", async () => {
    suport.magazie = magazieCuLumea();
    await post({ cod: COD_MEMBRU, actiune: "declara" });
    const coada = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "de-confirmat" });
    const id = coada.corp.plati[0].id;

    const faraMotiv = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "respinge", id });
    assert.equal(faraMotiv.status, 400);
    const gresita = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "confirma", id, panaLa: "mâine" });
    assert.equal(gresita.status, 400, "data strâmbă nu trece");
    const cuData = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "confirma", id, panaLa: "2027-01-15" });
    assert.equal(cuData.corp.panaLaNoua, "2027-01-15");
    assert.equal(suport.magazie._map.get("membru/" + MID).cotizatiePana, "2027-01-15");
  });

  test("reamintirile: ferestre -30/-7/expirat, o veste per treaptă și per termen", () => {
    const acum = Date.parse("2026-08-21T06:00:00Z");
    const zi = (n) => new Date(acum + n * 86400e3).toISOString().slice(0, 10);
    const membri = [
      { id: "a", nume: "A", email: "a@x.ro", cotizatiePana: zi(25) },   // fereastra -30
      { id: "b", nume: "B", email: "b@x.ro", cotizatiePana: zi(5) },    // fereastra -7
      { id: "c", nume: "C", email: "c@x.ro", cotizatiePana: zi(-3) },   // expirat
      { id: "d", nume: "D", email: "d@x.ro", cotizatiePana: zi(200) },  // departe — nimic
      { id: "e", nume: "E", email: "", cotizatiePana: zi(5) },          // fără e-mail — nimic
    ];
    const runda1 = cineDeAmintit(membri, {}, acum);
    assert.deepEqual(runda1.map((x) => x.membru.id + ":" + x.treapta.cheia).sort(), ["a:p30", "b:p7", "c:p0"]);

    // A doua rulare, cu marcajele scrise: tăcere — nicio dublură.
    const marcaje = {};
    for (const { membru, treapta } of runda1) marcaje[membru.id] = { [treapta.cheia]: membru.cotizatiePana };
    assert.equal(cineDeAmintit(membri, marcaje, acum).length, 0);

    // Termenul prelungit redeschide treptele — pentru noul termen.
    const prelungit = [{ id: "a", nume: "A", email: "a@x.ro", cotizatiePana: zi(20) }];
    assert.equal(cineDeAmintit(prelungit, { a: { p30: zi(25) } }, acum).length, 1, "alt termen = altă veste");
  });

  test("faptele lotului D sunt în registrul FAPTE (altfel jurnalul le-ar arunca)", async () => {
    const { FAPTE, FAPTE_DE_ANUNTAT } = await import("./registru-jurnal.mjs");
    for (const f of ["cotizatie-declarata", "cotizatie-confirmata", "cotizatie-plata-respinsa",
      "omologare-ceruta", "omologare-operata", "omologare-respinsa",
      "comanda-depusa", "comanda-finalizata", "comanda-respinsa"])
      assert.ok(FAPTE[f], "fapta " + f + " lipsește din FAPTE");
    for (const f of ["cotizatie-declarata", "omologare-ceruta", "comanda-depusa"])
      assert.ok(FAPTE_DE_ANUNTAT.has(f), "fapta " + f + " nu se anunță registraturii");
  });
}
