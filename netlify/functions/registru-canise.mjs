// registru-canise.mjs — înregistrarea canisei și rezervarea afixului, online.
//
// Ultima ușă de hârtie a registrului: până acum, cererea de afix era un PDF trimis pe
// e-mail, iar verificarea unicității se făcea din memorie. De aici înainte, drumul e
// cel al întregului registru: membrul depune online, registratura verifică și hotărăște,
// totul lasă urmă în jurnal.
//
// CINE CE FACE.
//   • MEMBRUL (cod MBR-) propune până la trei variante de afix, în ordinea preferinței —
//     întocmai cum cere Regulamentul de înregistrare a caniselor. O singură cerere în
//     lucru per membru; cine are deja afix în fișă nu depune alta.
//   • REGISTRATURA vede cererile cu verdictul fiecărei variante (liber/ocupat/invalid,
//     cu numele purtătorului la „ocupat") și hotărăște: aprobă o variantă — cu numărul
//     de afix scris DE OM, din evidența oficială, nu născocit de sistem — sau respinge
//     cu motiv. Amândouă pleacă pe e-mail către membru.
//
// LA APROBARE, afixul intră în fișa membrului (afix + nrAfix) — de acolo îl preia singur
// formularul declarației de montă și fătare, care până azi îl primea scris de mână.
//
// Stocare (store „registru"):
//   canisa-cerere/<id> -> { membruId, nume, email, variante[], stare, creat, ... }
//   canisa/<afixNorm>  -> { afix, nrAfix, membruId, nume, creat, deCatre }
import { getStore } from "@netlify/blobs";
import { actorDinCod, sha256 } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { membruDinCod, registratorDinCod } from "./registru-acces.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";
import { jurnalizeaza, jurnalizeazaObligatoriu, actorJurnal, ipCerere } from "./_comun/registru-jurnal.mjs";
import { trimite, pagina, escapeHtml } from "./_comun/posta.mjs";
import {
  normalizeazaAfix, afixValid, verdictAfix, poateDepuneDinNou, cheiaCererii, cheiaCanisei, PREFIX_CERERI, PREFIX_CANISE,
} from "./_comun/canise.mjs";
import { poateCereExtras, numarDinText, intervalulCerut, inInterval, inValuri } from "./_comun/extrase.mjs";
import { AFIXE_OFICIALE } from "./_comun/afixe-oficiale.mjs";

// Citire tare, ca peste tot în registru: o cerere hotărâtă trebuie văzută hotărâtă imediat.
const store = () => getStore({ name: "registru", consistency: "strong" });

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const idNou = () => Date.now() + "-" + Math.random().toString(36).slice(2, 8);

async function cine(cod) {
  if (actorDinCod(cod)?.rol === "admin") return { rol: "admin" };
  const m = await membruDinCod(cod);
  if (m) return { rol: "membru", membru: m };
  const r = await registratorDinCod(cod);
  if (r) return { rol: "registratura", registrator: r };
  return null;
}

/**
 * Harta afixelor deja luate: normalizat -> cine îl poartă.
 *
 * Se adună din TREI locuri, dinadins: evidența oficială publicată (AFX001–…, canisele
 * înregistrate înaintea drumului online — generată din pagina publică a caniselor),
 * canisele aprobate prin acest drum ȘI afixele din fișele membrilor. Fără prima sursă,
 * sistemul ar declara „liber" un afix pe care îl poartă de luni de zile o canisă cu
 * certificat oficial.
 */
async function afixeleLuate(s) {
  const luate = new Map();
  for (const a of AFIXE_OFICIALE) {
    luate.set(normalizeazaAfix(a.afix), `canisa „${a.afix}” (nr. ${a.nrAfix}, evidența oficială)`);
  }
  try {
    const { blobs } = await s.list({ prefix: PREFIX_CANISE });
    for (const b of blobs) {
      const c = await s.get(b.key, { type: "json" }).catch(() => null);
      if (c?.afix) luate.set(normalizeazaAfix(c.afix), `canisa „${c.afix}”`);
    }
  } catch (err) { console.error("Listare canise eșuată:", err); }
  try {
    const { blobs } = await s.list({ prefix: "membru/" });
    for (const b of blobs) {
      const m = await s.get(b.key, { type: "json" }).catch(() => null);
      if (m?.afix) {
        const n = normalizeazaAfix(m.afix);
        if (!luate.has(n)) luate.set(n, `afixul „${m.afix}” (membru ${m.nume || "existent"})`);
      }
    }
  } catch (err) { console.error("Listare membri eșuată:", err); }
  return luate;
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const actiune = taie(body.actiune, 24);
  const eu = await cine(taie(body.cod, 60));
  if (!eu) return json({ eroare: "Cod incorect." }, 401);

  const s = store();

  // A doua cheie pentru rolurile grele, ca la dosare: aici se rezervă nume și se scrie
  // în fișele membrilor. Membrul nu trece pe aici — el doar depune și își vede starea.
  if (ROLURI_PROTEJATE.includes(eu.rol) &&
      !(await dispozitivCunoscut(s, taie(body.dispozitiv, 80), eu.rol))) {
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403);
  }

  // ——— MEMBRUL: starea mea (canisă + cerere în lucru) ———
  if (actiune === "starea-mea") {
    if (eu.rol !== "membru") return json({ eroare: "Doar membrii au canise." }, 403);
    const m = eu.membru;
    let cerere = null;
    try {
      const { blobs } = await s.list({ prefix: PREFIX_CERERI });
      for (const b of blobs) {
        const c = await s.get(b.key, { type: "json" }).catch(() => null);
        if (c && c.membruId === m.id) {
          // Cea mai nouă cerere a lui spune starea; cele vechi rămân istorie.
          if (!cerere || String(c.creat) > String(cerere.creat)) cerere = { ...c, id: b.key.slice(PREFIX_CERERI.length) };
        }
      }
    } catch (err) { console.error(err); }
    return json({
      canisa: m.afix ? { afix: m.afix, nrAfix: m.nrAfix || null } : null,
      cerere: cerere ? {
        id: cerere.id, stare: cerere.stare, variante: cerere.variante,
        creat: cerere.creat, motiv: cerere.motiv || null, afixAcordat: cerere.afixAcordat || null,
      } : null,
    });
  }

  // ——— MEMBRUL: depune cererea ———
  if (actiune === "cerere") {
    if (eu.rol !== "membru") return json({ eroare: "Doar membrii pot cere înregistrarea unei canise." }, 403);
    const m = eu.membru;
    if (!m.cotizatieLaZi)
      return json({ eroare: "Cotizația a expirat. Reînnoiește-o pentru a putea depune cererea." }, 403);
    if (m.afix)
      return json({ eroare: `În fișa ta e deja afixul „${m.afix}”. Pentru schimbări, scrie asociației.` }, 409);

    // Variantele, în ordinea preferinței. Prima e obligatorie; golurile se sar.
    const variante = [body.afix1, body.afix2, body.afix3].map((v) => taie(v, 80)).filter(Boolean);
    if (!variante.length) return json({ eroare: "Scrie cel puțin o variantă de afix." }, 400);
    for (const v of variante) {
      const ok = afixValid(v);
      if (!ok.ok) return json({ eroare: `Afixul „${v}” nu poate fi folosit: ${ok.motiv}.` }, 400);
    }
    // Două variante care sunt „la fel scrise altfel" ar irosi o preferință degeaba.
    const norme = variante.map(normalizeazaAfix);
    if (new Set(norme).size !== norme.length)
      return json({ eroare: "Două dintre variante sunt același afix, scris altfel. Propune variante deosebite." }, 400);

    // O singură cerere în lucru: a doua ar pune registratura să judece de două ori același
    // om. Și frâna de după respingere: cererea nouă se primește abia după 24 de ore.
    let ceaMaiNoua = null;
    try {
      const { blobs } = await s.list({ prefix: PREFIX_CERERI });
      for (const b of blobs) {
        const c = await s.get(b.key, { type: "json" }).catch(() => null);
        if (!c || c.membruId !== m.id) continue;
        if (c.stare === "in-asteptare")
          return json({ eroare: "Ai deja o cerere în lucru. Așteaptă hotărârea registraturii." }, 409);
        if (!ceaMaiNoua || String(c.creat) > String(ceaMaiNoua.creat)) ceaMaiNoua = c;
      }
    } catch (err) { console.error(err); }
    const racire = poateDepuneDinNou(ceaMaiNoua);
    if (!racire.ok)
      return json({ eroare: `Ultima cerere a fost respinsă de curând. Poți depune una nouă peste aproximativ ${racire.oreRamase} ore — folosește răgazul ca să alegi variante noi.` }, 429);

    const id = idNou();
    // Urma înaintea faptei, ca peste tot în registru.
    await jurnalizeazaObligatoriu(s, {
      fapta: "canisa-cerere",
      actor: actorJurnal(eu),
      obiect: variante[0],
      detalii: "variante propuse: " + variante.join(" · "),
      ip: ipCerere(req),
    });
    await s.setJSON(cheiaCererii(id), {
      membruId: m.id, nume: m.nume || "", email: m.email || "",
      variante, stare: "in-asteptare", creat: new Date().toISOString(),
    });

    // Confirmarea către membru — același obicei ca la înscrieri: omul nu rămâne cu „oare a ajuns?".
    if (m.email) {
      await trimite({
        catre: m.email,
        subiect: "Cererea de înregistrare a canisei a fost primită",
        html: pagina("Cerere primită", "#1F4D3A",
          `<p>Bună ziua${m.nume ? ", " + escapeHtml(m.nume) : ""},</p>` +
          `<p>Cererea de înregistrare a canisei a fost primită, cu variantele de afix, în ordinea preferinței:</p>` +
          `<ol>${variante.map((v) => `<li><b>${escapeHtml(v)}</b></li>`).join("")}</ol>` +
          `<p>Registratura verifică unicitatea afixului și revine pe e-mail cu hotărârea. ` +
          `Stadiul cererii se vede oricând în spațiul tău de crescător, pe cfc-royal.ro.</p>`),
      }).catch((e) => console.error("Confirmarea cererii nu a plecat:", e?.message || e));
    }
    return json({ ok: true, id });
  }

  // ——— De aici încolo: registratura și administratorul ———
  if (eu.rol !== "registratura" && eu.rol !== "admin")
    return json({ eroare: "Doar registratura hotărăște asupra cererilor." }, 403);

  // ——— Lista cererilor, cu verdictul fiecărei variante ———
  if (actiune === "cereri") {
    const luate = await afixeleLuate(s);
    const cereri = [];
    try {
      const { blobs } = await s.list({ prefix: PREFIX_CERERI });
      for (const b of blobs) {
        const c = await s.get(b.key, { type: "json" }).catch(() => null);
        if (!c) continue;
        const id = b.key.slice(PREFIX_CERERI.length);
        cereri.push({
          id, stare: c.stare, creat: c.creat, nume: c.nume, email: c.email,
          variante: (c.variante || []).map((v) => ({ afix: v, ...verdictAfix(v, luate) })),
          afixAcordat: c.afixAcordat || null, nrAfix: c.nrAfix || null,
          motiv: c.motiv || null, hotarata: c.hotarata || null, deCatre: c.deCatre || null,
        });
      }
    } catch (err) { console.error(err); }
    // Cele în așteptare primele, apoi istoria, cele noi deasupra.
    cereri.sort((a, b) => (a.stare === "in-asteptare" ? 0 : 1) - (b.stare === "in-asteptare" ? 0 : 1) ||
      String(b.creat).localeCompare(String(a.creat)));
    return json({ cereri });
  }

  // ——— Aprobarea ———
  if (actiune === "aproba") {
    const id = taie(body.id, 40);
    const afixAles = taie(body.afixAles, 80);
    // Numărul de afix e un NUMĂR OFICIAL: îl scrie omul, din evidența asociației.
    // Sistemul nu născocește numere de acte — regulă de casă, plătită o dată scump.
    const nrAfix = taie(body.nrAfix, 20);
    if (!nrAfix) return json({ eroare: "Scrie numărul de afix din evidența oficială." }, 400);

    const c = await s.get(cheiaCererii(id), { type: "json" }).catch(() => null);
    if (!c) return json({ eroare: "Cerere inexistentă." }, 404);
    if (c.stare !== "in-asteptare") return json({ eroare: "Cererea a fost deja hotărâtă." }, 409);
    if (!(c.variante || []).includes(afixAles))
      return json({ eroare: "Afixul ales nu e printre variantele cerute." }, 400);

    // Verificarea unicității se REFACE la aprobare, pe starea de acum: între depunere și
    // hotărâre putea fi aprobată altă cerere cu același afix.
    const luate = await afixeleLuate(s);
    const verdict = verdictAfix(afixAles, luate);
    if (verdict.stare !== "liber")
      return json({ eroare: `Afixul „${afixAles}” nu mai e liber: ${verdict.deCine || verdict.motiv}.` }, 409);

    const membru = await s.get("membru/" + c.membruId, { type: "json" }).catch(() => null);
    if (!membru) return json({ eroare: "Fișa membrului nu mai există în registru." }, 404);
    if (membru.afix)
      return json({ eroare: `Membrul are deja afixul „${membru.afix}” în fișă.` }, 409);

    // LACĂTUL. Verificarea de mai sus poate fi păcălită de două aprobări în aceeași
    // secundă: fiecare verifică înainte ca cealaltă să scrie, și ambii membri ar rămâne
    // cu același afix. De aceea scrierea canisei se face cu `onlyIfNew`: magazia însăși
    // primește un singur câștigător, iar al doilea află pe loc că a pierdut — indiferent
    // cât de strâns a fost întrecutul.
    const acum = new Date().toISOString();
    const lacat = await s.setJSON(cheiaCanisei(normalizeazaAfix(afixAles)), {
      afix: afixAles, nrAfix, membruId: c.membruId, nume: c.nume || "", creat: acum,
      deCatre: actorJurnal(eu),
    }, { onlyIfNew: true });
    if (!lacat?.modified)
      return json({ eroare: `Afixul „${afixAles}” tocmai a fost rezervat de o altă aprobare.` }, 409);

    // Urma se scrie imediat după lacăt. Dacă jurnalul nu poate scrie, lacătul se dă
    // înapoi și aprobarea se refuză: o canisă fără urmă în jurnal nu are voie să existe.
    try {
      await jurnalizeazaObligatoriu(s, {
        fapta: "canisa-aprobata",
        actor: actorJurnal(eu),
        obiect: afixAles,
        detalii: `nr. afix ${nrAfix}, membru ${c.nume || c.membruId.slice(0, 8)}`,
        ip: ipCerere(req),
      });
    } catch (err) {
      await s.delete(cheiaCanisei(normalizeazaAfix(afixAles))).catch(() => {});
      console.error("Jurnalul aprobării a eșuat — lacătul dat înapoi:", err?.message || err);
      return json({ eroare: "Aprobarea nu s-a putut consemna în jurnal. Încearcă din nou." }, 503);
    }
    await s.setJSON("membru/" + c.membruId, { ...membru, afix: afixAles, nrAfix });
    await s.setJSON(cheiaCererii(id), {
      ...c, stare: "aprobata", afixAcordat: afixAles, nrAfix, hotarata: acum, deCatre: actorJurnal(eu),
    });

    if (c.email) {
      await trimite({
        catre: c.email,
        subiect: `Canisa „${afixAles}” a fost înregistrată`,
        html: pagina("Canisă înregistrată", "#1F4D3A",
          `<p>Bună ziua${c.nume ? ", " + escapeHtml(c.nume) : ""},</p>` +
          `<p>Cererea a fost aprobată. Afixul canisei tale este:</p>` +
          `<p style="font-size:22px;font-weight:bold;color:#1F4D3A">${escapeHtml(afixAles)}</p>` +
          `<p>Număr de afix: <b>${escapeHtml(nrAfix)}</b>.</p>` +
          `<p>Afixul a intrat în fișa ta de membru: la următoarea declarație de montă și ` +
          `fătare se completează singur, iar exemplarele canisei îl vor purta pe certificate.</p>`),
      }).catch((e) => console.error("Vestea aprobării nu a plecat:", e?.message || e));
    }
    return json({ ok: true, afix: afixAles, nrAfix });
  }

  // ——— Respingerea ———
  if (actiune === "respinge") {
    const id = taie(body.id, 40);
    const motiv = taie(body.motiv, 500);
    if (motiv.length < 5) return json({ eroare: "Scrie motivul respingerii — el pleacă pe e-mail către membru." }, 400);

    const c = await s.get(cheiaCererii(id), { type: "json" }).catch(() => null);
    if (!c) return json({ eroare: "Cerere inexistentă." }, 404);
    if (c.stare !== "in-asteptare") return json({ eroare: "Cererea a fost deja hotărâtă." }, 409);

    await jurnalizeazaObligatoriu(s, {
      fapta: "canisa-respinsa",
      actor: actorJurnal(eu),
      obiect: (c.variante || [])[0] || id,
      detalii: "motiv: " + motiv,
      ip: ipCerere(req),
    });
    await s.setJSON(cheiaCererii(id), {
      ...c, stare: "respinsa", motiv, hotarata: new Date().toISOString(), deCatre: actorJurnal(eu),
    });

    if (c.email) {
      await trimite({
        catre: c.email,
        subiect: "Cererea de înregistrare a canisei nu a putut fi aprobată",
        html: pagina("Cerere respinsă", "#8a1d1d",
          `<p>Bună ziua${c.nume ? ", " + escapeHtml(c.nume) : ""},</p>` +
          `<p>Cererea de înregistrare a canisei nu a putut fi aprobată.</p>` +
          `<p><b>Motivul:</b> ${escapeHtml(motiv)}</p>` +
          `<p>Poți depune o cerere nouă, cu alte variante de afix, din spațiul tău de crescător.</p>`),
      }).catch((e) => console.error("Vestea respingerii nu a plecat:", e?.message || e));
    }
    return json({ ok: true });
  }

  // ——— Extrasul din Registrul afixelor ———
  //
  // Ca extrasul din Cartea de Origine: întregul registru sau doar afixele dintre două
  // numere. Afixele se adună din AMBELE locuri — canisele înregistrate online și cele
  // din fișele membrilor, date pe hârtie înainte — fiindcă registrul e unul singur,
  // indiferent pe ce drum a intrat fiecare afix în el.
  if (actiune === "extras-afixe") {
    if (!poateCereExtras(eu))
      return json({ eroare: "Extrasul îl pot cere doar administratorul și registratorul desemnat." }, 403);
    const iv = intervalulCerut(body.deLa, body.panaLa);
    if (iv.eroare) return json({ eroare: iv.eroare }, 400);

    const dupaNorm = new Map();
    // Temelia: evidența oficială publicată (AFX001–…), cu numerele ei de certificat.
    for (const a of AFIXE_OFICIALE) {
      dupaNorm.set(normalizeazaAfix(a.afix), {
        afix: a.afix, nrAfix: a.nrAfix || "", titular: a.titular || "", inregistrat: "",
      });
    }
    try {
      const chei = (await s.list({ prefix: PREFIX_CANISE })).blobs.map((b) => b.key);
      for (const c of await inValuri(chei, 12, (k) => s.get(k, { type: "json" }).catch(() => null))) {
        if (c?.afix && !dupaNorm.has(normalizeazaAfix(c.afix))) dupaNorm.set(normalizeazaAfix(c.afix), {
          afix: c.afix, nrAfix: c.nrAfix || "", titular: c.nume || "", inregistrat: c.creat || "",
        });
      }
    } catch (err) { console.error("registru-canise:", err); return json({ eroare: "Nu am putut citi registrul caniselor. Încearcă din nou." }, 500); }
    try {
      const chei = (await s.list({ prefix: "membru/" })).blobs.map((b) => b.key);
      for (const m of await inValuri(chei, 12, (k) => s.get(k, { type: "json" }).catch(() => null))) {
        if (!m?.afix) continue;
        const n = normalizeazaAfix(m.afix);
        // Fișa membrului completează ce lipsește, dar nu bate canisa înregistrată online.
        if (!dupaNorm.has(n)) dupaNorm.set(n, {
          afix: m.afix, nrAfix: m.nrAfix || "", titular: m.nume || "", inregistrat: "",
        });
      }
    } catch (err) { console.error("Listare membri la extras eșuată:", err); }

    // În interval intră afixele cu număr citibil; cele fără număr (evidență veche,
    // încă necompletată) apar DOAR la extrasul întregului registru, la coadă, pe față —
    // ascunse, ar face extrasul să mintă prin omisiune.
    const toate = [...dupaNorm.values()].map((x) => ({ ...x, nr: numarDinText(x.nrAfix) }));
    const totRegistrul = iv.deLa == null && iv.panaLa == null;
    const afixe = toate
      .filter((x) => totRegistrul || inInterval(x.nr, iv.deLa, iv.panaLa))
      .sort((a, b) => (a.nr ?? 1e9) - (b.nr ?? 1e9) || a.afix.localeCompare(b.afix, "ro"));

    await jurnalizeaza(s, {
      fapta: "extras-afixe",
      actor: actorJurnal(eu),
      obiect: totRegistrul ? "întregul Registru al afixelor"
        : `afixele ${iv.deLa ?? "început"}–${iv.panaLa ?? "sfârșit"}`,
      detalii: `${afixe.length} afixe în extras`,
      ip: ipCerere(req),
    });
    return json({
      afixe, interval: { deLa: iv.deLa, panaLa: iv.panaLa },
      generat: new Date().toISOString(),
      deCatre: eu.rol === "admin" ? "administrator" : (eu.registrator?.nume || "registratură"),
    });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
