// acte-scoala.test.mjs — actele Școlii de Arbitraj, cap-coadă, pe handlerele REALE.
//
// Drumul întreg: adminul emite diploma și legitimația (doar când faptele există) ->
// candidatul își ia actul cu codul lui -> codul QR din act trece prin verifica-act și
// primește verdictul „autentic". Tot aici: seria rămâne stabilă la re-apăsare, reemiterea
// dă serie nouă, iar o semnătură umblată pică cinstit.
//   node --test netlify/functions/_comun/acte-scoala.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, scryptSync } from "node:crypto";
import { bootstrapMockModule, magazieFalsa, mockBlobs, reqJSON } from "./_harness.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("actele Școlii — sărite (mock.module indisponibil)", { skip: true }, () => {});
} else {
  const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

  // Mediul, ÎNAINTE de a importa handlerele (cheile se citesc la încărcarea modulului):
  // cheia de semnătură a actelor + amprenta adminului (scrypt sărat, ca în roluri.mjs).
  process.env.VERIFICARE_SECRET = "cheie-de-semnatura-de-proba";
  process.env.EXPO_SYNC_SECRET = "puntea-de-proba";   // puntea Managerului (POST revocari)
  const COD_ADMIN = "cod-admin-de-proba";
  process.env.ADMIN_HASH = scryptSync(sha256(COD_ADMIN), "5bc690c359954798d5149721d0f7cada", 32).toString("hex");
  // BREVO_API_KEY rămâne NEpusă: al doilea factor e neoperațional, deci nu cere dispozitiv
  // (exact ca pe un mediu fără poștă) — aici probăm actele, nu 2FA.
  delete process.env.BREVO_API_KEY;

  const suport = { magazie: magazieFalsa({}) };
  mockBlobs({
    get: (...a) => suport.magazie.get(...a),
    getWithMetadata: (...a) => suport.magazie.getWithMetadata(...a),
    setJSON: (...a) => suport.magazie.setJSON(...a),
    set: (...a) => suport.magazie.set(...a),
    delete: (...a) => suport.magazie.delete(...a),
    list: (...a) => suport.magazie.list(...a),
  });
  const acte = (await import("../acte-scoala.mjs")).default;
  const verifica = (await import("../verifica-act.mjs")).default;

  const COD_CANDIDAT = "ARB-PROBA123";
  const CID = sha256(COD_CANDIDAT);

  function magazieCuScoala() {
    return magazieFalsa({
      ["candidat/" + CID]: { nume: "Elena Stagiar", creat: "2026-02-01" },
      ["examen/" + CID]: { promovat: true, incercari: [{ data: "2026-08-01", procent: 88, promovat: true }] },
      ["autorizare/" + CID]: { grupe: [1, 3], public: true, localitate: "Resita" },
    });
  }

  const post = async (body) => {
    const r = await acte(reqJSON(body));
    return { status: r.status, corp: await r.json() };
  };

  test("emiterea: porți de fond, serie stabilă, reemitere cu serie nouă", async () => {
    suport.magazie = magazieCuScoala();

    // Fără examen promovat, diploma nu se emite.
    suport.magazie._map.set("examen/" + CID, { promovat: false, incercari: [] });
    const refuz = await post({ cod: COD_ADMIN, actiune: "emite", candidatId: CID, fel: "diploma" });
    assert.equal(refuz.status, 409);

    suport.magazie._map.set("examen/" + CID, { promovat: true, incercari: [] });
    const dip = await post({ cod: COD_ADMIN, actiune: "emite", candidatId: CID, fel: "diploma" });
    assert.equal(dip.status, 200, JSON.stringify(dip.corp));
    assert.match(dip.corp.serie, /^DIP-\d{4}-001$/);

    // A doua apăsare NU dublează: aceeași serie.
    const din2 = await post({ cod: COD_ADMIN, actiune: "emite", candidatId: CID, fel: "diploma" });
    assert.equal(din2.corp.serie, dip.corp.serie);
    assert.equal(din2.corp.dejaEmis, true);

    const leg = await post({ cod: COD_ADMIN, actiune: "emite", candidatId: CID, fel: "legitimatie" });
    assert.match(leg.corp.serie, /^LEG-\d{4}-001$/, JSON.stringify(leg.corp));

    // Grupele se extind -> reemitere cu serie NOUĂ, cu urma celei vechi.
    suport.magazie._map.set("autorizare/" + CID, { grupe: [1, 3, 7], public: true });
    const leg2 = await post({ cod: COD_ADMIN, actiune: "emite", candidatId: CID, fel: "legitimatie", reemite: true });
    assert.match(leg2.corp.serie, /^LEG-\d{4}-002$/);
    const inreg = suport.magazie._map.get("act-scoala/" + CID + "/legitimatie");
    assert.equal(inreg.inlocuieste, leg.corp.serie);
    assert.deepEqual(inreg.grupe, [1, 3, 7]);

    // Fără grupe, legitimația nu se emite.
    suport.magazie._map.set("autorizare/" + CID, { grupe: [] });
    const farag = await post({ cod: COD_ADMIN, actiune: "emite", candidatId: CID, fel: "legitimatie", reemite: true });
    assert.equal(farag.status, 409);
  });

  test("candidatul își ia actul cu codul lui, iar QR-ul trece prin verifica-act", async () => {
    suport.magazie = magazieCuScoala();
    await post({ cod: COD_ADMIN, actiune: "emite", candidatId: CID, fel: "legitimatie" });

    // Cod greșit => 401; codul bun => actul lui, cu adresa de verificare.
    const strain = await post({ id: "alt-cod", actiune: "act", fel: "legitimatie" });
    assert.equal(strain.status, 401);
    const al = await post({ id: COD_CANDIDAT, actiune: "act", fel: "legitimatie" });
    assert.equal(al.status, 200, JSON.stringify(al.corp));
    assert.equal(al.corp.act.nume, "Elena Stagiar");
    assert.deepEqual(al.corp.act.grupe, [1, 3]);
    assert.ok(al.corp.qr && al.corp.qr.startsWith("data:image/"), "QR-ul se face pe server");

    // Codul din QR, prin verificarea publică: autentic, cu titularul și grupele pe act.
    const c = new URL(al.corp.adresaVerificare).searchParams.get("c");
    const rv = await verifica(new Request("https://cfc-royal.ro/.netlify/functions/verifica-act?c=" + encodeURIComponent(c)));
    const v = await rv.json();
    assert.equal(v.valid, true, JSON.stringify(v));
    assert.equal(v.act.fel, "legitimatie");
    assert.equal(v.act.titular, "Elena Stagiar");
    assert.equal(v.act.grupe, "1, 3");
    assert.match(v.stareText, /Legitimație autentică/);

    // O semnătură umblată pică — exact rostul verificării.
    const stricat = c.slice(0, -1) + (c.endsWith("a") ? "b" : "a");
    const rf = await verifica(new Request("https://cfc-royal.ro/.netlify/functions/verifica-act?c=" + encodeURIComponent(stricat)));
    const f = await rf.json();
    assert.equal(f.valid, false);

    // Actul neemis se spune cinstit.
    const fara = await post({ id: COD_CANDIDAT, actiune: "act", fel: "diploma" });
    assert.equal(fara.status, 404);
  });

  test("revocarea: actul Școlii pică la verificare, pe cheia LUI (Managerul nu i-o șterge)", async () => {
    suport.magazie = magazieCuScoala();
    await post({ cod: COD_ADMIN, actiune: "emite", candidatId: CID, fel: "diploma" });
    const al = await post({ id: COD_CANDIDAT, actiune: "act", fel: "diploma" });
    const c = new URL(al.corp.adresaVerificare).searchParams.get("c");

    const rev = await post({ cod: COD_ADMIN, actiune: "revoca", candidatId: CID, fel: "diploma" });
    assert.equal(rev.status, 200, JSON.stringify(rev.corp));

    // Semnătura rămâne validă, dar lista revocărilor spune ANULATĂ.
    const rv = await verifica(new Request("https://cfc-royal.ro/.netlify/functions/verifica-act?c=" + encodeURIComponent(c)));
    const v = await rv.json();
    assert.equal(v.valid, false);
    assert.equal(v.anulat, true);
    assert.match(v.stareText, /ANULATĂ/);

    // Managerul își publică lista LUI (înlocuire integrală) — revocarea Școlii supraviețuiește.
    const pub = await verifica(new Request("https://cfc-royal.ro/.netlify/functions/verifica-act", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: "puntea-de-proba", actiune: "revocari", serii: ["003/01.11.2026"] }),
    }));
    assert.equal(pub.status, 200, JSON.stringify(await pub.json()));
    const rv2 = await verifica(new Request("https://cfc-royal.ro/.netlify/functions/verifica-act?c=" + encodeURIComponent(c)));
    const v2 = await rv2.json();
    assert.equal(v2.anulat, true, "publicarea Managerului NU șterge revocările Școlii");
  });

  test("mentorul (Art. 14): salvare, citire în parcurs, scoatere", async () => {
    suport.magazie = magazieCuScoala();
    const candidati = (await import("../candidati-cursuri.mjs")).default;
    const asistente = (await import("../asistente-cursuri.mjs")).default;
    const postC = async (b) => { const r = await candidati(reqJSON(b)); return { status: r.status, corp: await r.json() }; };
    const postA = async (b) => { const r = await asistente(reqJSON(b)); return { status: r.status, corp: await r.json() }; };

    const pus = await postC({ cod: COD_ADMIN, actiune: "mentor-salveaza", candidatId: CID, nume: "Arbitru Mentor", din: "2026-03-01" });
    assert.equal(pus.status, 200, JSON.stringify(pus.corp));

    // Candidatul îl vede pe parcursul lui, împreună cu actele emise.
    await post({ cod: COD_ADMIN, actiune: "emite", candidatId: CID, fel: "diploma" });
    const parcurs = await postA({ actiune: "parcursul-meu", id: COD_CANDIDAT });
    assert.equal(parcurs.status, 200, JSON.stringify(parcurs.corp));
    assert.equal(parcurs.corp.mentor.nume, "Arbitru Mentor");
    assert.equal(parcurs.corp.examen.promovat, true);
    assert.deepEqual(parcurs.corp.autorizare.grupe, [1, 3]);
    assert.match(parcurs.corp.acte.diploma.serie, /^DIP-/);

    // Nume gol = scoaterea mentorului.
    await postC({ cod: COD_ADMIN, actiune: "mentor-salveaza", candidatId: CID, nume: "" });
    const dupa = await postA({ actiune: "parcursul-meu", id: COD_CANDIDAT });
    assert.equal(dupa.corp.mentor, null);
  });
}
