// curse-registratura.test.mjs — cursele de corectitudine din auditul registraturii (23.08),
// pe handlerele REALE: confirmarea montei nu se răstoarnă târziu, iar un pui nu primește
// două certificate.
//   node --test netlify/functions/_comun/curse-registratura.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { bootstrapMockModule, magazieFalsa, mockBlobs, reqJSON } from "./_harness.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("cursele registraturii — sărite (mock.module indisponibil)", { skip: true }, () => {});
} else {
  const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
  // Fără poștă → al doilea factor neoperațional → nu cere dispozitiv (probăm cursele, nu 2FA).
  delete process.env.BREVO_API_KEY;
  // Admin: amprentă scrypt sărat, ca în roluri.mjs.
  const COD_ADMIN = "cod-admin-de-proba";
  const { scryptSync } = await import("node:crypto");
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
  const dmf = (await import("../registru-dmf.mjs")).default;
  const pedigree = (await import("../registru-pedigree.mjs")).default;

  const postDmf = async (b) => { const r = await dmf(reqJSON(b)); return { status: r.status, corp: await r.json() }; };
  const postPed = async (b) => { const r = await pedigree(reqJSON(b)); return { status: r.status, corp: await r.json() }; };

  test("confirmarea montei NU se poate răsturna după acceptarea pe dovadă alternativă", async () => {
    const JETON = "jeton-confirmare-de-proba";
    suport.magazie = magazieFalsa({
      "dmf/D1": {
        serie: "CFCR-DMF-2026-0001", rasa: "Ciobănesc German",
        mascul: { nume: "Rex", pedigree: "CFCR 100", microcip: "941000000000001" },
        femela: { nume: "Luna", pedigree: "CFCR 200" },
        membruNume: "Ion", pui: [{ nume: "P1", sex: "M" }],
        // Registratura a acceptat deja pe dovadă semnată:
        confirmare: { stare: "alternativ", la: "2026-08-20T10:00:00Z", deCatre: "registratură" },
      },
      // Jetonul original, încă valabil (60 de zile), în mâna proprietarului masculului:
      ["confirmare/" + sha256(JETON)]: { dmfId: "D1", email: "mascul@example.ro", expira: "2099-01-01T00:00:00Z" },
    });

    // Proprietarul masculului deschide târziu linkul și apasă „Nu confirm".
    const r = await postDmf({ actiune: "confirmare-raspuns", jeton: JETON, raspuns: "refuz", nume: "Vasile Proprietar", motiv: "Nu recunosc monta." });
    assert.equal(r.status, 409, JSON.stringify(r.corp));

    // Starea rămâne „alternativ" — acceptarea registraturii NU a fost răsturnată.
    assert.equal(suport.magazie._map.get("dmf/D1").confirmare.stare, "alternativ");
    // Jetonul rămas s-a stins, ca linkul să nu mai poată fi folosit.
    assert.ok(!suport.magazie._map.has("confirmare/" + sha256(JETON)));
  });

  test("un pui nu primește două certificate: a doua emitere întoarce aceeași serie, fără orfan", async () => {
    suport.magazie = magazieFalsa({
      "dmf/D2": {
        serie: "CFCR-DMF-2026-0002", rasa: "Ciobănesc German", dataFatarii: "2026-05-01",
        membruNume: "Ion Crescator", afix: "de Proba", nrAfix: "AFX/1",
        numarWDF: 77,
        ascendenta: { T: { nume: "Tata", nr: "CFCR 1" }, M: { nume: "Mama", nr: "CFCR 2" } },
        pui: [{ nume: "Pui Unic", sex: "M", identificare: "941000000000009" }],
      },
    });
    const emitere = { cod: COD_ADMIN, actiune: "emite", id: "D2", pui: [{ index: 0 }] };

    const prima = await postPed(emitere);
    assert.equal(prima.status, 200, JSON.stringify(prima.corp));
    const serie1 = prima.corp.emise[0].serie;
    assert.ok(serie1, "prima emitere dă o serie");

    const aDoua = await postPed(emitere);
    assert.equal(aDoua.status, 200, JSON.stringify(aDoua.corp));
    assert.equal(aDoua.corp.emise[0].serie, serie1, "a doua emitere întoarce ACEEAȘI serie");
    assert.equal(aDoua.corp.emise[0].deja, true);

    // Un singur certificat în magazie pentru acest pui — niciun act orfan.
    const serii = [...suport.magazie._map.keys()].filter((k) => k.startsWith("pedigree/"));
    assert.equal(serii.length, 1, "un singur pedigree/<serie> scris, fără dublură");
    assert.equal(suport.magazie._map.get("pedigree-cuib/D2/0").serie, serie1);
  });
}
