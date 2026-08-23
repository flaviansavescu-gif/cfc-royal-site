// registru-cuiburi.mjs — anunțuri de cuiburi disponibile.
//
// DE CE. Un cuib declarat (DMF) e o realitate consemnată în registru; un anunț de cuib e
// invitația crescătorului de a-l face public — „am pui disponibili, iată părinții, iată cum
// mă găsești". Ca să nu devină un magazin: anunțul se leagă OBLIGATORIU de un DMF REAL al
// crescătorului, trece prin aprobarea registraturii, NU are prețuri și EXPIRĂ în 90 de zile.
// Publicul vede rasa, afixul, ambii părinți (cu fișă și sănătatea lor), puii disponibili și
// contactul — nimic despre bani.
//
// Stocare (store „registru", citire tare):
//   anunt-cuib/<id>              -> anunțul complet
//   anunt-cuib-membru/<mId>/<id> -> rezumat, pentru lista crescătorului
//   cuiburi/index                -> indexul public cachedat (doar aprobate, neexpirate)
//
// POST { cod, actiune:"depune", dmfId, disponibiliM, disponibiliF, nota, contactNume, contactTelefon, contactEmail }  (membru, cotizație la zi)
// POST { cod, actiune:"mele" }                                             (membru)
// POST { cod, actiune:"retrage", id }                                      (membru, al lui)
// POST { cod, dispozitiv, actiune:"de-aprobat" }                          (registratură/admin)
// POST { cod, dispozitiv, actiune:"aproba"|"respinge", id, motiv? }        (registratură/admin)
// POST {      actiune:"lista" }                        -> anunțuri publice (fără cod)
import { getStore } from "@netlify/blobs";
import { actorDinCod } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { membruDinCod, registratorDinCod, chinotehnistDinCod } from "./registru-acces.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";
import { jurnalizeazaObligatoriu, actorJurnal, ipCerere } from "./_comun/registru-jurnal.mjs";
import { recomandareDin, insignaTest, numeTest } from "./_comun/teste-sanatate.mjs";
import { normalizeazaAfix } from "./_comun/canise.mjs";
import { obtineIndexCachedat } from "./_comun/index-cachedat.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";
import { refuzaDacaInchis } from "./_comun/poarta-scrieri.mjs";
import { json } from "./_comun/raspuns.mjs";

const store = () => getStore({ name: "registru", consistency: "strong" });

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const normCip = (v) => String(v || "").replace(/[\s-]/g, "");
// Interzice și semnele care ar putea sparge un atribut HTML la afișarea publică pe /cuiburi/.
const EMAIL_RE = /^[^@\s'"<>&]+@[^@\s.'"<>&]+\.[^@\s'"<>&]+$/;
// Telefonul de contact: doar ce are sens într-un număr (cifre, +, spații, cratime, paranteze, punct).
const curataTelefon = (v) => taie(v, 40).replace(/[^\d+()\s.\-]/g, "");
const idNou = () => Date.now() + "-" + Math.random().toString(36).slice(2, 8);

const ZILE_VALABIL = 90;                          // un anunț ține 90 de zile de la aprobare
const TTL_INDEX_MS = 2 * 60e3;                    // reîmprospătarea indexului public
const CHEIE_INDEX = "cuiburi/index";
const MAX_PUI = 24;                               // ca la DMF

const cheiaAnunt = (id) => "anunt-cuib/" + id;
const cheiaMembru = (mId, id) => "anunt-cuib-membru/" + mId + "/" + id;

// Anunțul nu e un magazin: numere care sună a preț nu au ce căuta în notă. Nu ghicim
// intenția — oprim ce e limpede (monede, cuvântul „preț") și cerem să fie scos.
const PRET_RE = /(\bpre[țt]\b|\blei\b|\blej\b|\bron\b|\beur\b|\beuro\b|€|\$|£)/i;

/** Un întreg între 0 și MAX_PUI; orice altceva devine 0. */
export function nrPui(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 && n <= MAX_PUI ? n : 0;
}

/** Nota conține ceva ce sună a preț? Registrul nu e un magazin. */
export function continePret(nota) {
  return PRET_RE.test(String(nota || ""));
}

/**
 * Validează partea „liberă" a anunțului (ce scrie crescătorul), fără a atinge magazia.
 * Verificarea că DMF-ul e real și al lui rămâne în handler; aici doar disponibilitate,
 * notă fără prețuri și un contact bun. Întoarce {eroare} sau {ok, câmpuri curățate}.
 */
export function valideazaAnunt(body, numeImplicit = "") {
  const disponibiliM = nrPui(body.disponibiliM);
  const disponibiliF = nrPui(body.disponibiliF);
  if (disponibiliM + disponibiliF < 1) return { eroare: "Spune câți pui sunt disponibili (măcar unul)." };

  const nota = taie(body.nota, 280);
  if (continePret(nota)) return { eroare: "Anunțurile nu conțin prețuri. Scoate suma din notă — registrul nu e un magazin." };

  const contactNume = taie(body.contactNume, 120) || (numeImplicit || "");
  const contactTelefon = curataTelefon(body.contactTelefon);
  const contactEmail = taie(body.contactEmail, 160);
  if (contactEmail && !EMAIL_RE.test(contactEmail)) return { eroare: "Adresa de e-mail de contact nu e validă." };
  if (!contactTelefon && !contactEmail) return { eroare: "Lasă un contact — telefon sau e-mail — ca lumea să te poată găsi." };

  return { ok: true, disponibiliM, disponibiliF, nota, contactNume, contactTelefon, contactEmail };
}

async function cine(cod) {
  if (actorDinCod(cod)?.rol === "admin") return { rol: "admin" };
  const m = await membruDinCod(cod);
  if (m) return { rol: "membru", membru: m };
  const r = await registratorDinCod(cod);
  if (r) return { rol: "registratura", registrator: r };
  // Chinotehnistul publică anunțuri pentru cuiburile depuse prin asociația lui —
  // crescătorii afiliați nu au cod propriu, dar cuiburile lor sunt la fel de reale.
  const k = await chinotehnistDinCod(cod);
  if (k) return { rol: "chinotehnist", chinotehnist: k };
  return null;
}

/** Unde stă rezumatul anunțului pentru lista depunătorului: a membrului sau a asociației. */
const cheiaListei = (a) => a.depunere?.asociatieSlug
  ? "anunt-cuib-afiliat/" + a.depunere.asociatieSlug + "/" + a.id
  : cheiaMembru(a.membruId, a.id);

export const expirat = (a, acum = Date.now()) => {
  const t = Date.parse(a?.expiraLa || "");
  return Number.isFinite(t) && t < acum;
};

/** Sănătatea unui părinte, după microcip: recomandarea + insignele verificate. */
async function sanatateaParintelui(s, microcip) {
  const cip = normCip(microcip);
  const info = { recomandat: false, insigne: [] };
  if (!cip) return info;
  const dosar = await s.get("sanatate/" + cip, { type: "json" }).catch(() => null);
  if (!dosar) return info;
  const verificate = (dosar.teste || []).filter((t) => t.stare === "verificat");
  info.recomandat = recomandareDin(verificate).acordata;
  info.insigne = verificate.map((t) => insignaTest(t.tip, t.rezultat)).filter(Boolean);
  return info;
}

/** Un părinte, gata de afișat: nume, legătura la fișă (dacă e în registru) și sănătatea. */
async function parintePublic(s, p) {
  const cip = normCip(p?.microcip);
  let serie = null;
  if (cip) {
    const leg = await s.get("pedigree-caine/" + cip, { type: "json" }).catch(() => null);
    serie = leg?.serie || null;
  }
  const san = await sanatateaParintelui(s, cip);
  return { nume: p?.nume || "", serie, recomandat: san.recomandat, insigne: san.insigne };
}

/** Reconstruiește indexul public: anunțurile aprobate și neexpirate, îmbogățite cu părinți. */
async function construiesteIndex(s) {
  const anunturi = [];
  try {
    const { blobs } = await s.list({ prefix: "anunt-cuib/" });
    for (const b of blobs) {
      const a = await s.get(b.key, { type: "json" }).catch(() => null);
      if (!a || a.stare !== "aprobat" || expirat(a)) continue;
      const [tata, mama] = await Promise.all([
        parintePublic(s, a.tata), parintePublic(s, a.mama),
      ]);
      anunturi.push({
        id: a.id, rasa: a.rasa, varietate: a.varietate || "",
        afix: a.afix || "", afixNorm: a.afix ? normalizeazaAfix(a.afix) : "", nrAfix: a.nrAfix || "",
        dataFatarii: a.dataFatarii || "",
        disponibiliM: a.disponibiliM || 0, disponibiliF: a.disponibiliF || 0,
        nota: a.nota || "",
        contactNume: a.contactNume || "", contactTelefon: a.contactTelefon || "",
        contactEmail: a.contactEmail || "",
        expiraLa: a.expiraLa || null,
        tata, mama,
      });
    }
  } catch (err) { console.error("Index cuiburi eșuat:", err); }
  // Cele mai proaspete fătări întâi.
  anunturi.sort((a, b) => String(b.dataFatarii).localeCompare(String(a.dataFatarii)));
  return { generat: new Date().toISOString(), anunturi };
}

const rezumatMembru = (a) => ({
  id: a.id, dmfSerie: a.dmfSerie, rasa: a.rasa, dataFatarii: a.dataFatarii,
  disponibiliM: a.disponibiliM, disponibiliF: a.disponibiliF,
  stare: a.stare, creat: a.creat, expiraLa: a.expiraLa || null,
  motiv: a.respingere?.motiv || null,
});

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const actiune = taie(body.actiune, 24);
  const s = store();

  // —— Public: anunțurile de cuiburi (aprobate, neexpirate). Fără cod. ——
  if (actiune === "lista") {
    const idx = await obtineIndexCachedat(s, { cheie: CHEIE_INDEX, ttlMs: TTL_INDEX_MS, construieste: construiesteIndex });
    return json(idx);
  }

  // —— De aici încolo, orice acțiune cere cod. ——
  const eu = await cine(taie(body.cod, 60));
  if (!eu) return json({ eroare: "Cod incorect." }, 401);

  // A doua cheie pentru rolurile grele.
  if (ROLURI_PROTEJATE.includes(eu.rol) &&
      !(await dispozitivCunoscut(s, taie(body.dispozitiv, 80), eu.rol))) {
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403, { antete: { "x-refuz-drept": "1" } });
  }

  // —— Crescătorul depune un anunț, legat de un DMF real al lui. ——
  if (actiune === "depune") {
    { const oprit = await refuzaDacaInchis(json); if (oprit) return oprit; }
    if (eu.rol !== "membru" && eu.rol !== "chinotehnist")
      return json({ eroare: "Doar crescătorii și chinotehniștii publică anunțuri de cuiburi." }, 403);
    // Cotizația e a membrilor direcți; crescătorul afiliat plătește taxa DMF pe dosar.
    if (eu.rol === "membru" && !eu.membru.cotizatieLaZi)
      return json({ eroare: "Cotizația nu e la zi. Anunțurile de cuiburi sunt pentru membrii cu cotizația achitată." }, 403);
    const eAfil = eu.rol === "chinotehnist";

    const dmfId = taie(body.dmfId, 60);
    if (!dmfId || !segmentCheieValid(dmfId)) return json({ eroare: "Alege cuibul (declarația de montă și fătare)." }, 400);
    const d = await s.get("dmf/" + dmfId, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Declarația nu există." }, 404);
    const alMeuCuib = eAfil
      ? d.depunere?.asociatieSlug === eu.chinotehnist.asociatieSlug
      : d.membruId === eu.membru.id;
    if (!alMeuCuib) return json({ eroare: "Poți publica doar cuiburile tale." }, 403);
    if (d.stare === "respins") return json({ eroare: "Cuibul acestei declarații a fost respins — nu poate fi publicat." }, 409);

    // Un singur anunț activ per cuib: nu împânzim pagina cu același cuib de mai multe ori.
    try {
      const { blobs } = await s.list({
        prefix: eAfil
          ? "anunt-cuib-afiliat/" + eu.chinotehnist.asociatieSlug + "/"
          : "anunt-cuib-membru/" + eu.membru.id + "/",
      });
      for (const b of blobs) {
        const r = await s.get(b.key, { type: "json" }).catch(() => null);
        if (!r || r.dmfSerie !== d.serie) continue;
        const a = await s.get(cheiaAnunt(r.id), { type: "json" }).catch(() => null);
        if (a && (a.stare === "depus" || (a.stare === "aprobat" && !expirat(a))))
          return json({ eroare: "Acest cuib are deja un anunț activ. Retrage-l întâi dacă vrei să-l refaci." }, 409);
      }
    } catch { /* dacă listarea eșuează, lăsăm depunerea — dublura se prinde la aprobare */ }

    // Numele prestabilit de contact e al CRESCĂTORULUI: la membru e chiar el, la
    // depunerea prin asociație e cel de pe dosar (chinotehnistul poate scrie altul).
    const v = valideazaAnunt(body, (eAfil ? d.membruNume : eu.membru.nume) || "");
    if (v.eroare) return json({ eroare: v.eroare }, 400);
    const { disponibiliM, disponibiliF, nota, contactNume, contactTelefon, contactEmail } = v;

    const id = idNou();
    const acum = new Date().toISOString();
    const anunt = {
      id, creat: acum,
      dmfId, dmfSerie: d.serie,
      membruId: eAfil ? null : eu.membru.id,
      membruNume: (eAfil ? d.membruNume : eu.membru.nume) || "",
      ...(eAfil
        ? { depunere: {
            asociatie: eu.chinotehnist.asociatie || "",
            asociatieSlug: eu.chinotehnist.asociatieSlug || "",
            chinotehnistNume: eu.chinotehnist.nume || "",
          } }
        : {}),
      rasa: d.rasa || "", varietate: d.varietate || "",
      afix: d.afix || (eAfil ? "" : eu.membru.afix) || "", nrAfix: d.nrAfix || (eAfil ? "" : eu.membru.nrAfix) || "",
      dataFatarii: d.dataFatarii || "",
      tata: { nume: d.mascul?.nume || "", microcip: normCip(d.mascul?.microcip) },
      mama: { nume: d.femela?.nume || "", microcip: normCip(d.femela?.microcip) },
      disponibiliM, disponibiliF, nota,
      contactNume, contactTelefon, contactEmail,
      stare: "depus",
    };

    await jurnalizeazaObligatoriu(s, {
      fapta: "anunt-cuib-depus", actor: actorJurnal(eu), obiect: d.serie,
      detalii: `${d.rasa} — ${disponibiliM}M/${disponibiliF}F disponibili`, ip: ipCerere(req),
    });
    await s.setJSON(cheiaAnunt(id), anunt);
    await s.setJSON(cheiaListei(anunt), rezumatMembru(anunt));
    return json({ ok: true, id });
  }

  // —— Crescătorul: anunțurile lui. ——
  if (actiune === "mele") {
    if (eu.rol !== "membru" && eu.rol !== "chinotehnist") return json({ eroare: "Nepermis." }, 403);
    const lista = [];
    try {
      const { blobs } = await s.list({
        prefix: eu.rol === "chinotehnist"
          ? "anunt-cuib-afiliat/" + eu.chinotehnist.asociatieSlug + "/"
          : "anunt-cuib-membru/" + eu.membru.id + "/",
      });
      for (const b of blobs) {
        const r = await s.get(b.key, { type: "json" }).catch(() => null);
        if (r) lista.push(r);
      }
    } catch (err) { console.error("Listare anunțuri membru eșuată:", err); }
    lista.sort((a, b) => String(b.creat).localeCompare(String(a.creat)));
    return json({ anunturi: lista });
  }

  // —— Crescătorul retrage un anunț al lui. ——
  if (actiune === "retrage") {
    { const oprit = await refuzaDacaInchis(json); if (oprit) return oprit; }
    if (eu.rol !== "membru" && eu.rol !== "chinotehnist") return json({ eroare: "Nepermis." }, 403);
    const id = taie(body.id, 60);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const a = await s.get(cheiaAnunt(id), { type: "json" }).catch(() => null);
    if (!a) return json({ eroare: "Anunț inexistent." }, 404);
    const alMeuAnunt = eu.rol === "membru"
      ? a.membruId === eu.membru.id
      : a.depunere?.asociatieSlug === eu.chinotehnist.asociatieSlug;
    if (!alMeuAnunt) return json({ eroare: "Nu e anunțul tău." }, 403);
    if (a.stare === "retras") return json({ ok: true });
    await jurnalizeazaObligatoriu(s, {
      fapta: "anunt-cuib-retras", actor: actorJurnal(eu), obiect: a.dmfSerie,
      detalii: `${a.rasa}`, ip: ipCerere(req),
    });
    a.stare = "retras"; a.retrasLa = new Date().toISOString();
    await s.setJSON(cheiaAnunt(id), a);
    await s.setJSON(cheiaListei(a), rezumatMembru(a));
    await s.delete(CHEIE_INDEX).catch(() => {});     // reconstrucție la următoarea citire
    return json({ ok: true });
  }

  // —— Registratura: coada anunțurilor de aprobat. ——
  if (actiune === "de-aprobat") {
    if (eu.rol !== "registratura" && eu.rol !== "admin")
      return json({ eroare: "Doar registratura aprobă anunțuri." }, 403);
    const cereri = [];
    try {
      const { blobs } = await s.list({ prefix: "anunt-cuib/" });
      for (const b of blobs) {
        const a = await s.get(b.key, { type: "json" }).catch(() => null);
        if (a && a.stare === "depus") cereri.push(a);
      }
    } catch (err) { console.error("Listare coadă cuiburi eșuată:", err); }
    cereri.sort((a, b) => String(a.creat).localeCompare(String(b.creat)));
    return json({ cereri });
  }

  // —— Registratura: aprobă sau respinge un anunț. ——
  if (actiune === "aproba" || actiune === "respinge") {
    if (eu.rol !== "registratura" && eu.rol !== "admin")
      return json({ eroare: "Doar registratura hotărăște." }, 403);
    const id = taie(body.id, 60);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const a = await s.get(cheiaAnunt(id), { type: "json" }).catch(() => null);
    if (!a) return json({ eroare: "Anunț inexistent." }, 404);
    if (a.stare !== "depus") return json({ eroare: "Anunțul a fost deja hotărât." }, 409);

    const acum = new Date();
    if (actiune === "respinge") {
      const motiv = taie(body.motiv, 500);
      if (motiv.length < 5) return json({ eroare: "Scrie motivul respingerii." }, 400);
      await jurnalizeazaObligatoriu(s, {
        fapta: "anunt-cuib-respins", actor: actorJurnal(eu), obiect: a.dmfSerie,
        detalii: `${a.rasa} — motiv: ${motiv}`, ip: ipCerere(req),
      });
      a.stare = "respins";
      a.respingere = { motiv, la: acum.toISOString(), deCatre: actorJurnal(eu) };
    } else {
      await jurnalizeazaObligatoriu(s, {
        fapta: "anunt-cuib-aprobat", actor: actorJurnal(eu), obiect: a.dmfSerie,
        detalii: `${a.rasa} — ${a.disponibiliM}M/${a.disponibiliF}F`, ip: ipCerere(req),
      });
      a.stare = "aprobat";
      a.aprobatLa = acum.toISOString();
      a.aprobatDe = actorJurnal(eu);
      a.expiraLa = new Date(acum.getTime() + ZILE_VALABIL * 86400e3).toISOString();
    }
    await s.setJSON(cheiaAnunt(id), a);
    await s.setJSON(cheiaListei(a), rezumatMembru(a));
    await s.delete(CHEIE_INDEX).catch(() => {});     // publicul vede schimbarea la reconstrucție
    return json({ ok: true });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
