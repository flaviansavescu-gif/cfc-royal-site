// registru-transfer.test.mjs — transferul de proprietate, cap-coadă, pe handlerul REAL.
//
// Drumul întreg: membrul inițiază -> invitația pleacă pe e-mail (Brevo e prefăcut, dar
// jetonul din link e cel adevărat) -> noul proprietar vede și confirmă -> registratura
// vede coada și operează -> certificatul poartă noul proprietar, vechiul rămâne în istoric.
//   node --test netlify/functions/_comun/registru-transfer.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { bootstrapMockModule, magazieFalsa, mockBlobs, reqJSON } from "./_harness.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("transferul de proprietate — sărit (mock.module indisponibil)", { skip: true }, () => {});
} else {
  const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

  // Poșta „configurată": trimite() chiar încearcă, iar al doilea factor e activ —
  // exact ca în producție. Brevo e prefăcut și păstrează fiecare e-mail trimis.
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

  // mock.module se instalează O SINGURĂ dată — delegăm către un suport mutabil.
  const suport = { magazie: magazieFalsa({}) };
  mockBlobs({
    get: (...a) => suport.magazie.get(...a),
    getWithMetadata: (...a) => suport.magazie.getWithMetadata(...a),
    setJSON: (...a) => suport.magazie.setJSON(...a),
    set: (...a) => suport.magazie.set(...a),
    delete: (...a) => suport.magazie.delete(...a),
    list: (...a) => suport.magazie.list(...a),
  });
  const handler = (await import("../registru-transfer.mjs")).default;

  const COD_MEMBRU = "cod-membru-de-proba";
  const COD_REG = "cod-registrator-de-proba";
  const JETON_DISP = "jeton-dispozitiv-de-proba";
  const SERIE = "CFCR-P-2026-0001";

  function magazieCuLumea() {
    return magazieFalsa({
      ["membru/" + sha256(COD_MEMBRU)]: { nume: "Ion Crescator", email: "ion@example.ro", cotizatiePana: "2099-01-01" },
      ["registrator/" + sha256(COD_REG)]: { nume: "Maria Registrator", email: "registratura@example.ro" },
      ["dispozitiv/" + sha256(JETON_DISP)]: { rol: "registratura", expira: new Date(Date.now() + 3600e3).toISOString() },
      "dmf/d1": { membruId: sha256(COD_MEMBRU), stare: "emis" },
      ["pedigree/" + SERIE]: {
        dmfId: "d1",
        caine: { nume: "Rex de Proba", rasa: "Ciobanesc German", microcip: "642000000000001" },
        proprietar: { nume: "Ion Crescator", localitate: "Resita" },
      },
    });
  }

  const post = async (body) => {
    const r = await handler(reqJSON(body));
    return { status: r.status, corp: await r.json() };
  };

  test("drumul întreg: inițiere -> confirmare pe jeton -> operare la registratură", async () => {
    suport.magazie = magazieCuLumea();
    trimise.length = 0;

    // 1) Membrul inițiază.
    const ini = await post({
      cod: COD_MEMBRU, actiune: "initiaza", serie: SERIE,
      nou: { nume: "Vasile Cumparator", email: "vasile@example.com", localitate: "Timisoara", judet: "Timis" },
    });
    assert.equal(ini.status, 200, JSON.stringify(ini.corp));
    assert.ok(trimise.length >= 1, "invitația trebuia să plece pe e-mail");
    assert.equal(trimise[0].to[0].email, "vasile@example.com");

    // Jetonul e DOAR în e-mail; în magazie stă amprenta lui.
    const jeton = (trimise[0].htmlContent.match(/\?t=([0-9a-f]{64})/) || [])[1];
    assert.ok(jeton, "linkul din e-mail trebuie să poarte jetonul");
    assert.ok(suport.magazie._map.has("transfer/" + sha256(jeton)), "în magazie stă amprenta jetonului");
    assert.ok(suport.magazie._map.has("transfer-serie/" + SERIE), "lacătul pe serie e pus");

    // Al doilea transfer pe același câine e refuzat de lacăt.
    const dublu = await post({
      cod: COD_MEMBRU, actiune: "initiaza", serie: SERIE,
      nou: { nume: "Altcineva", email: "alt@example.com", localitate: "Arad" },
    });
    assert.equal(dublu.status, 409);

    // 2) Noul proprietar vede dosarul (public, doar cu jetonul)…
    const vezi = await post({ actiune: "vezi", jeton });
    assert.equal(vezi.status, 200, JSON.stringify(vezi.corp));
    assert.equal(vezi.corp.transfer.serie, SERIE);
    assert.equal(vezi.corp.transfer.caine.nume, "Rex de Proba");

    // …și confirmă.
    const conf = await post({ actiune: "raspuns", jeton, raspuns: "confirm", nume: "Vasile Cumparator" });
    assert.equal(conf.status, 200, JSON.stringify(conf.corp));
    assert.equal(conf.corp.stare, "confirmat");

    // Jetonul e de unică folosință.
    const refolosit = await post({ actiune: "vezi", jeton });
    assert.equal(refolosit.status, 404);

    // 3) Registratura vede coada (cod + dispozitiv)…
    const coada = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "de-operat" });
    assert.equal(coada.status, 200, JSON.stringify(coada.corp));
    assert.equal(coada.corp.transferuri.length, 1);
    assert.equal(coada.corp.transferuri[0].stare, "confirmat");
    const id = coada.corp.transferuri[0].id;

    // …fără dispozitiv, ușa e închisă.
    const faraDisp = await post({ cod: COD_REG, actiune: "de-operat" });
    assert.equal(faraDisp.status, 403);

    // …și operează.
    trimise.length = 0;
    const op = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "opereaza", id });
    assert.equal(op.status, 200, JSON.stringify(op.corp));

    const cert = suport.magazie._map.get("pedigree/" + SERIE);
    assert.equal(cert.proprietar.nume, "Vasile Cumparator");
    assert.equal(cert.proprietar.email, undefined, "e-mailul NU intră pe certificat");
    assert.equal(cert.istoricProprietari.length, 1);
    assert.equal(cert.istoricProprietari[0].nume, "Ion Crescator", "vechiul proprietar rămâne în istoric");
    assert.ok(!suport.magazie._map.has("transfer-serie/" + SERIE), "lacătul pe serie e ridicat");
    assert.equal(suport.magazie._map.get("transfer-dosar/" + id).stare, "operat");
    assert.ok(trimise.some((e) => e.to[0].email === "vasile@example.com"), "noul proprietar află pe e-mail");
    assert.ok(trimise.some((e) => e.to[0].email === "ion@example.ro"), "vânzătorul află pe e-mail");
  });

  test("refuzul: motiv obligatoriu, lacătul pe serie se ridică, dosarul nu se poate opera", async () => {
    suport.magazie = magazieCuLumea();
    trimise.length = 0;
    await post({
      cod: COD_MEMBRU, actiune: "initiaza", serie: SERIE,
      nou: { nume: "Vasile Cumparator", email: "vasile@example.com", localitate: "Timisoara" },
    });
    const jeton = (trimise[0].htmlContent.match(/\?t=([0-9a-f]{64})/) || [])[1];

    const faraMotiv = await post({ actiune: "raspuns", jeton, raspuns: "refuz", nume: "Vasile Cumparator" });
    assert.equal(faraMotiv.status, 400, "refuzul fără motiv nu trece");

    const ref = await post({ actiune: "raspuns", jeton, raspuns: "refuz", nume: "Vasile Cumparator", motiv: "Nu am cumparat acest caine." });
    assert.equal(ref.status, 200);
    assert.equal(ref.corp.stare, "refuzat");
    assert.ok(!suport.magazie._map.has("transfer-serie/" + SERIE), "refuzul eliberează seria pentru un nou transfer");

    // Un transfer refuzat NU se operează.
    const coada = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "de-operat" });
    const id = coada.corp.transferuri[0].id;
    const op = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "opereaza", id });
    assert.equal(op.status, 409);
    const cert = suport.magazie._map.get("pedigree/" + SERIE);
    assert.equal(cert.proprietar.nume, "Ion Crescator", "certificatul rămâne neschimbat");
  });

  test("gardurile: doar câinii cuiburilor tale; anularea doar cât e în așteptare", async () => {
    suport.magazie = magazieCuLumea();
    suport.magazie._map.set("dmf/d1", { membruId: "altcineva", stare: "emis" });
    const strain = await post({
      cod: COD_MEMBRU, actiune: "initiaza", serie: SERIE,
      nou: { nume: "Vasile Cumparator", email: "vasile@example.com", localitate: "Timisoara" },
    });
    assert.equal(strain.status, 403, "câinele altui crescător nu se transferă");

    suport.magazie = magazieCuLumea();
    trimise.length = 0;
    await post({
      cod: COD_MEMBRU, actiune: "initiaza", serie: SERIE,
      nou: { nume: "Vasile Cumparator", email: "vasile@example.com", localitate: "Timisoara" },
    });
    const aleMele = await post({ cod: COD_MEMBRU, actiune: "ale-mele" });
    assert.equal(aleMele.corp.transferuri.length, 1);
    const id = aleMele.corp.transferuri[0].id;
    const anulat = await post({ cod: COD_MEMBRU, actiune: "anuleaza", id });
    assert.equal(anulat.status, 200, JSON.stringify(anulat.corp));
    assert.ok(!suport.magazie._map.has("transfer-serie/" + SERIE), "anularea eliberează seria");
    const jeton = (trimise[0].htmlContent.match(/\?t=([0-9a-f]{64})/) || [])[1];
    const mort = await post({ actiune: "vezi", jeton });
    assert.ok(mort.status === 404 || mort.status === 410, "linkul unui transfer anulat e mort");
  });

  test("clasarea: refuzul se închide, confirmatul se clasează DOAR cu motiv și eliberează seria", async () => {
    suport.magazie = magazieCuLumea();
    trimise.length = 0;
    await post({
      cod: COD_MEMBRU, actiune: "initiaza", serie: SERIE,
      nou: { nume: "Vasile Cumparator", email: "vasile@example.com", localitate: "Timisoara" },
    });
    const jeton = (trimise[0].htmlContent.match(/\?t=([0-9a-f]{64})/) || [])[1];
    await post({ actiune: "raspuns", jeton, raspuns: "confirm", nume: "Vasile Cumparator" });

    // Clasarea unei CONFIRMĂRI fără motiv nu trece; cu motiv, seria se eliberează.
    const coada = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "de-operat" });
    const id = coada.corp.transferuri[0].id;
    const faraMotiv = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "claseaza", id });
    assert.equal(faraMotiv.status, 400);
    trimise.length = 0;
    const cls = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "claseaza", id, motiv: "Vanzarea nu s-a incheiat." });
    assert.equal(cls.status, 200, JSON.stringify(cls.corp));
    assert.equal(suport.magazie._map.get("transfer-dosar/" + id).stare, "clasat");
    assert.ok(!suport.magazie._map.has("transfer-serie/" + SERIE), "clasarea eliberează seria");
    assert.ok(trimise.some((e) => e.to[0].email === "vasile@example.com"), "noul proprietar află de clasare");
    const cert = suport.magazie._map.get("pedigree/" + SERIE);
    assert.equal(cert.proprietar.nume, "Ion Crescator", "certificatul rămâne neschimbat");

    // După clasare, un transfer NOU pentru aceeași serie pornește (lacătul nu blochează).
    trimise.length = 0;
    const iar = await post({
      cod: COD_MEMBRU, actiune: "initiaza", serie: SERIE,
      nou: { nume: "Alt Cumparator", email: "alt@example.com", localitate: "Arad" },
    });
    assert.equal(iar.status, 200, JSON.stringify(iar.corp));
  });

  test("operarea e idempotentă și refuză certificatul anulat între timp", async () => {
    suport.magazie = magazieCuLumea();
    trimise.length = 0;
    await post({
      cod: COD_MEMBRU, actiune: "initiaza", serie: SERIE,
      nou: { nume: "Vasile Cumparator", email: "vasile@example.com", localitate: "Timisoara" },
    });
    const jeton = (trimise[0].htmlContent.match(/\?t=([0-9a-f]{64})/) || [])[1];
    await post({ actiune: "raspuns", jeton, raspuns: "confirm", nume: "Vasile Cumparator" });
    const coada = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "de-operat" });
    const id = coada.corp.transferuri[0].id;

    // Simulăm o operare căzută la mijloc: certificatul poartă DEJA noul proprietar,
    // dar dosarul a rămas „confirmat". Reluarea NU are voie să mintă istoricul.
    const cert = suport.magazie._map.get("pedigree/" + SERIE);
    suport.magazie._map.set("pedigree/" + SERIE, { ...cert, proprietar: { nume: "Vasile Cumparator", localitate: "Timisoara" } });
    const op = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "opereaza", id });
    assert.equal(op.status, 200, JSON.stringify(op.corp));
    const dupa = suport.magazie._map.get("pedigree/" + SERIE);
    assert.equal((dupa.istoricProprietari || []).length, 0,
      "noul proprietar NU intră în istoric ca „fost” la reluarea operării");

    // Un certificat anulat între confirmare și operare nu se mai rescrie.
    suport.magazie = magazieCuLumea();
    trimise.length = 0;
    await post({
      cod: COD_MEMBRU, actiune: "initiaza", serie: SERIE,
      nou: { nume: "Vasile Cumparator", email: "vasile@example.com", localitate: "Timisoara" },
    });
    const j2 = (trimise[0].htmlContent.match(/\?t=([0-9a-f]{64})/) || [])[1];
    await post({ actiune: "raspuns", jeton: j2, raspuns: "confirm", nume: "Vasile Cumparator" });
    const c2 = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "de-operat" });
    suport.magazie._map.set("pedigree/" + SERIE, { ...suport.magazie._map.get("pedigree/" + SERIE), anulat: true });
    const opAnulat = await post({ cod: COD_REG, dispozitiv: JETON_DISP, actiune: "opereaza", id: c2.corp.transferuri[0].id });
    assert.equal(opAnulat.status, 409);
  });

  test("faptele transferului și adeziunii sunt în registrul FAPTE (altfel jurnalul le-ar arunca)", async () => {
    const { FAPTE, FAPTE_DE_ANUNTAT } = await import("./registru-jurnal.mjs");
    for (const f of ["transfer-initiat", "transfer-raspuns", "transfer-operat", "transfer-anulat", "transfer-clasat", "adeziune-depusa", "adeziune-hotarare"])
      assert.ok(FAPTE[f], "fapta " + f + " lipsește din FAPTE");
    for (const f of ["transfer-raspuns", "adeziune-depusa"])
      assert.ok(FAPTE_DE_ANUNTAT.has ? FAPTE_DE_ANUNTAT.has(f) : FAPTE_DE_ANUNTAT.includes(f),
        "fapta " + f + " nu se anunță registraturii");
  });
}
