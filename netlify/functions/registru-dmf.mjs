// registru-dmf.mjs — Declarația de Montă și Fătare: depunere, dosar, verificare.
//
// Reproduce actul pe hârtie (4 pagini: statistica cuibului, cei doi părinți, blocurile
// de pui), cu trei deosebiri asumate:
//
//   1. UN SINGUR formular în loc de patru. Pe hârtie există variante pentru 1–2, 3–6,
//      7–10 și 10–14 pui, fiindcă rândurile sunt tipărite. Aici rândurile se adaugă
//      câte e nevoie, deci varianta nu se mai alege — și nu se mai poate greși.
//   2. MICROCIPUL PĂRINȚILOR e obligatoriu, deși actul tipărit nu-l cere. Identifică
//      reproducătorii fără echivoc; la pui rămâne opțional, fiindcă la vârsta declarării
//      de multe ori nu sunt încă cipați (actul prevede „Tatuaj sau Microcip").
//   3. NUMĂRUL DE ÎNREGISTRARE se dă pe loc, la depunere. Pe hârtie îl scria asociația
//      la primire; aici e dovada crescătorului că a depus în termen, deci trebuie să
//      plece odată cu confirmarea. Numărul WDF de cuib îl completează registratura.
//
// TERMENUL de 90 de zile de la fătare NU blochează depunerea. Peste termen dosarul se
// marchează „peste termen" și decide registratura. A bloca ar lăsa crescătorul întârziat
// fără nicio cale de a-și declara cuibul — exact invers față de scopul registrului.
//
// Stocare (store „registru"):
//   ciorna/<id>              -> { membruId, creat }        cât timp se încarcă fișierele
//   dmf/<id>                 -> declarația completă
//   dmf-membru/<mId>/<id>    -> rezumat, pentru lista membrului fără citirea tuturor
//   dmf-fisier/<id>/<fel>    -> fișierul încărcat (binar + metadate)
//   contor/dmf-<an>          -> { ultim }
//   serie/<serie>            -> marcaj de unicitate a numărului
//
// POST { cod, actiune:"ciorna-noua" }                                    (membru)
// POST { cod, actiune:"fisier", ciornaId, fel, nume, tip, continut }     (membru)
// POST { cod, actiune:"depune", ciornaId, … }                            (membru, cotizație la zi)
// POST { cod, actiune:"mele" }                                           (membru)
// POST { cod, actiune:"dosare" | "dosar" }                               (registratură/admin)
// POST { cod, actiune:"vezi-fisier", id, fel }        -> binar           (proprietar / registratură)
import { getStore } from "@netlify/blobs";
import { actorDinCod, sha256 } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";
import { membruDinCod, registratorDinCod, chinotehnistDinCod } from "./registru-acces.mjs";
import {
  jurnalizeaza, jurnalizeazaObligatoriu, actorJurnal, actorExtern, ipCerere,
} from "./_comun/registru-jurnal.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";
import { cheileCitirii } from "./_comun/citire-documente.mjs";
import { START_PORTI, PRAG, luniIntre, portiCrestere, mesajOpriri } from "./_comun/porti-crestere.mjs";

// CITIRE TARE, ca la poarta de acces.
//
// Aici se lucrează dosarele și se EMIT acte. Cu citire obișnuită, un cod revocat ar
// mai fi recunoscut zeci de secunde din copia veche a magaziei — adică exact atât cât
// îi trebuie cuiva căruia tocmai i-ai luat dreptul ca să mai emită un certificat.
// O revocare care nu revocă imediat nu e o revocare.
const store = () => getStore({ name: "registru", consistency: "strong" });

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;
const eData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const azi = () => new Date().toISOString().slice(0, 10);
const zileIntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Cele patru piese ale dosarului. Fără toate, declarația nu se poate depune. */
export const FELURI = {
  "pedigree-mascul": "Pedigree-ul masculului",
  "pedigree-femela": "Pedigree-ul femelei",
  "drept-monta": "Dovada dreptului de montă al femelei",
  "plata": "Dovada plății",
};

/** Piesă suplimentară, urcată de registratură: dovada semnată pe hârtie a montei. */
export const FEL_ALTERNATIV = "confirmare-alternativa";
const TOATE_FELURILE = { ...FELURI, [FEL_ALTERNATIV]: "Dovada semnată a montei" };

export const TERMEN_ZILE = 90;
/** Cât timp e valabil linkul trimis proprietarului masculului. */
export const CONFIRMARE_ZILE = 60;
/**
 * MĂRIMEA FIȘIERELOR — și de ce a fost minciună până azi.
 *
 * Fișierul se trimite codificat base64, care îl umflă cu o treime. Netlify taie cererile
 * peste 6 MB. Măsurat pe viu: un fișier de 4 MB trece (corp 5,33 MB), unul de 4,5 MB e
 * respins cu 413 (corp 6,00 MB) — la marginea rețelei, ÎNAINTE ca funcția asta să apuce
 * să răspundă.
 *
 * Deci mesajul „Fișierul depășește 5 MB" nu se vedea niciodată la fișierele de 4,5–5 MB:
 * omul primea o eroare seacă de rețea și nu afla ce a greșit. Iar un scan de pedigree de
 * 5,72 MB — cum e cel al mamei din cuibul 26 — pur și simplu nu putea fi depus.
 *
 * De aceea fișierele mari vin acum pe bucăți (`fisier-parte` + `fisier-gata`), fiecare
 * bucată bine sub plafonul platformei. Limita de mai jos nu mai e impusă de codificare:
 * e o hotărâre a noastră despre cât de mare are voie să fie un act depus la dosar.
 */
const MAX_FISIER = 20 * 1024 * 1024;         // cât se păstrează, după lipirea bucăților
const MAX_PARTE = 3 * 1024 * 1024;           // cât încape într-o singură cerere, cu loc de întors
const MAX_PARTI = 12;                        // 12 × 3 MB = 36 MB; plafonul rămâne MAX_FISIER
const TIPURI_OK = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_PUI = 24;

/** Microcip ISO (15 cifre) sau cip vechi de 10. Spațiile și liniuțele se ignoră. */
export function microcipValid(v) {
  const c = String(v || "").replace(/[\s-]/g, "");
  return /^\d{15}$/.test(c) || /^\d{10}$/.test(c);
}

const octetiHex = (n) => {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
};
const idNou = () => octetiHex(12);
/** 32 de octeți: linkul de confirmare e singura cheie, deci trebuie să fie neghicibil. */
const jetonNou = () => octetiHex(32);

/**
 * Deschide (sau reînnoiește) invitația de confirmare pentru proprietarul masculului.
 * În registru se păstrează doar AMPRENTA jetonului — cine ar citi stocarea nu poate
 * confirma monta în locul omului.
 */
async function deschideConfirmarea(dmfId, email) {
  const jeton = jetonNou();
  const expira = new Date(Date.now() + CONFIRMARE_ZILE * 86400000).toISOString();
  await store().setJSON("confirmare/" + sha256(jeton), { dmfId, email, expira, creat: new Date().toISOString() });
  return { jeton, expira };
}

/**
 * Număr de înregistrare unic: CFCR-DMF-<an>-<0001>.
 *
 * Contorul singur n-ar ajunge — două depuneri simultane l-ar citi la fel. Dar nici
 * „citesc, văd că-i liber, apoi scriu" nu ajunge: între citire și scriere încape
 * cealaltă depunere, care vede tot liber. Amândouă ies cu ACELAȘI număr de
 * înregistrare, iar a doua o suprascrie pe prima în registru.
 *
 * Rezervarea se face acum cu `onlyIfNew`: magazia însăși hotărâne cine a fost primul, iar
 * cine pierde primește `modified:false` și trece la numărul următor. Nu mai există
 * fereastră între verificare și scriere, fiindcă sunt aceeași faptă.
 */
async function serieNoua(an) {
  const s = store();
  for (let i = 0; i < 30; i++) {
    const c = await s.get("contor/dmf-" + an, { type: "json" }).catch(() => null);
    const urm = (c?.ultim || 0) + 1;
    const serie = `CFCR-DMF-${an}-${String(urm).padStart(4, "0")}`;
    // Contorul se avansează oricum: dacă numărul e luat, nu-l mai încercăm.
    await s.setJSON("contor/dmf-" + an, { ultim: urm });
    let alMeu = false;
    try {
      const r = await s.setJSON("serie/" + serie, { rezervat: new Date().toISOString() }, { onlyIfNew: true });
      alMeu = r?.modified !== false; // magazii vechi fără răspuns => tratăm ca reușită
    } catch (err) {
      console.error("Rezervarea seriei a eșuat:", serie, err);
    }
    if (alMeu) return serie;
  }
  return null;
}

/** Cine cere: membru, registratură sau administrator. */
async function cine(cod) {
  if (actorDinCod(cod)?.rol === "admin") return { rol: "admin" };
  const m = await membruDinCod(cod);
  if (m) return { rol: "membru", membru: m };
  const r = await registratorDinCod(cod);
  if (r) return { rol: "registratura", registrator: r };
  // Chinotehnistul asociației afiliate: depune declarații ÎN NUMELE crescătorilor ei.
  // Aceeași coadă, aceeași verificare — doar poarta de intrare diferă.
  const k = await chinotehnistDinCod(cod);
  if (k) return { rol: "chinotehnist", chinotehnist: k };
  return null;
}

/**
 * Culege din magazie ce le trebuie porților de creștere (Art. 22): fătările
 * NEREspinse ale femelei, ascendențele părinților din fișele registrului și, la
 * masculul de 12–14 luni, profilul ADN verificat din registrul de sănătate.
 *
 * COSTUL: o listare a dosarelor plus câte o citire de dosar. La sutele de DMF-uri
 * de azi încape lejer în cele 10 secunde ale funcției; când registrul va crește
 * spre mii, aici se pune un index pe microcipul femelei — nu se renunță la poartă.
 */
async function culegePentruPorti(s, d) {
  const fatariAnterioare = [];
  const { blobs } = await s.list({ prefix: "dmf/" });
  for (const b of blobs) {
    const x = await s.get(b.key, { type: "json" }).catch(() => null);
    if (!x || x.stare === "respins") continue;
    if (x.femela?.microcip !== d.femela.microcip) continue;
    fatariAnterioare.push({
      serie: x.serie, dataFatarii: x.dataFatarii,
      cezariana: x.fatareCezariana === true,
    });
  }

  // Fișa unui părinte: microcip -> serie -> certificat (cu ascendența lui).
  const asc = async (cip) => {
    const leg = await s.get("pedigree-caine/" + cip, { type: "json" }).catch(() => null);
    if (!leg?.serie) return null;
    const cert = await s.get("pedigree/" + leg.serie, { type: "json" }).catch(() => null);
    return cert?.ascendenta || null;
  };

  // ADN-ul se caută doar când poarta l-ar cere — o citire mai puțin la dosarele obișnuite.
  let adnMasculVerificat = false;
  const vM = luniIntre(d.mascul.dataNasterii, d.dataMontei);
  if (vM !== null && vM >= PRAG.MASCUL_MIN_LUNI && vM < PRAG.MASCUL_ADN_LUNI) {
    const dosar = await s.get("sanatate/" + d.mascul.microcip, { type: "json" }).catch(() => null);
    adnMasculVerificat = (dosar?.teste || []).some((t) => t.tip === "adn" && t.stare === "verificat");
  }

  return {
    fatariAnterioare,
    ascMascul: await asc(d.mascul.microcip),
    ascFemela: await asc(d.femela.microcip),
    adnMasculVerificat,
  };
}

/** Ciorna e a celui care a deschis-o — membru sau chinotehnist, nu se amestecă. */
function ciornaAMea(ciorna, eu) {
  if (!ciorna) return false;
  if (eu.rol === "membru") return ciorna.membruId === eu.membru.id;
  if (eu.rol === "chinotehnist") return ciorna.chinotehnistId === eu.chinotehnist.id;
  // Depunerea telefonică: registratura deschide ciorna în numele unui membru.
  if (eu.rol === "registratura") return ciorna.registratorId === eu.registrator.id;
  return false;
}

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * Cererea de confirmare către proprietarul masculului.
 *
 * Actul pe hârtie are rubrica „Semnătura" în coloana masculului: fără ea, declarația e
 * afirmația unilaterală a proprietarului femelei. Online nu putem cere nici semnătură,
 * nici cod de acces — masculul e adesea din altă asociație sau din străinătate, iar un
 * cod ar bloca exact montele externe. Rămâne linkul unic pe e-mail, cu răspunsul
 * înregistrat (cine, când, de unde), asumat ca echivalent al semnăturii.
 *
 * Bilingv: proprietarul poate fi din orice țară.
 */
async function trimiteCerereaCatreMascul(d, token) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) { console.error("BREVO_API_KEY lipsește — cererea de confirmare nu a plecat."); return false; }
  const link = "https://cfc-royal.ro/confirmare-monta/?t=" + token;
  const rand = (a, b) =>
    `<tr><td style="padding:3px 14px 3px 0;color:#666">${esc(a)}</td><td><strong>${esc(b)}</strong></td></tr>`;
  const html =
    `<h2 style="margin:0 0 4px;color:#1F4D3A">Confirmarea montei · Confirmation of mating</h2>` +
    `<p style="color:#666;margin:0 0 18px">Registrul genealogic — Asociația Club Federal Chinologic Royal</p>` +
    `<p style="font-size:15px">Sunteți indicat ca proprietar al masculului într-o Declarație de Montă și Fătare. ` +
    `Vă rugăm să confirmați că monta a avut loc.<br>` +
    `<span style="color:#666">You are named as the owner of the stud dog in a Mating and Whelping Declaration. ` +
    `Please confirm that the mating took place.</span></p>` +
    `<table style="border-collapse:collapse;font-size:14px;margin:16px 0">` +
    rand("Mascul · Stud dog", d.mascul.nume) +
    rand("Femelă · Dam", d.femela.nume) +
    rand("Data montei · Mating date", d.dataMontei) +
    rand("Crescător · Breeder", d.membruNume) +
    rand("Nr. înregistrare · Reference", d.serie) +
    `</table>` +
    `<p style="margin:22px 0"><a href="${link}" style="background:#1F4D3A;color:#fff;text-decoration:none;` +
    `padding:12px 22px;border-radius:6px;font-weight:600;display:inline-block">Deschide confirmarea · Open confirmation</a></p>` +
    `<p style="font-size:13px;color:#666">Nu aveți nevoie de cont sau de cod. Linkul e valabil 60 de zile și poate fi folosit o singură dată.<br>` +
    `No account or code needed. The link is valid for 60 days and can be used once.</p>` +
    `<p style="font-size:12px;color:#888;word-break:break-all">${esc(link)}</p>` +
    `<hr style="margin:20px 0;border:none;border-top:1px solid #ddd">` +
    `<p style="color:#888;font-size:12px">Dacă nu cunoașteți această montă, apăsați linkul și alegeți „Nu confirm" — ` +
    `sesizarea ajunge la registratură.<br>If you do not recognise this mating, open the link and choose “I do not confirm”.</p>`;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Registrul genealogic CFC-Royal", email: "newsletter@cfc-royal.ro" },
        to: [{ email: d.mascul.email }],
        subject: `[CFC-Royal] Confirmarea montei · Confirmation of mating — ${d.serie}`,
        htmlContent: html,
      }),
    });
    if (!res.ok) { console.error("Brevo (mascul):", res.status, await res.text()); return false; }
    return true;
  } catch (err) { console.error("Cererea de confirmare a eșuat:", err); return false; }
}

/** Confirmarea către crescător. Eșecul ei nu anulează depunerea deja înregistrată. */
async function trimiteConfirmarea(membru, d) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) { console.error("BREVO_API_KEY lipsește — confirmarea DMF nu a plecat."); return false; }
  const html =
    `<h2 style="margin:0 0 12px;color:#1F4D3A">Declarație de Montă și Fătare înregistrată</h2>` +
    `<p style="font-size:18px;margin:0 0 4px"><strong>${esc(d.serie)}</strong></p>` +
    `<p style="color:#666;margin:0 0 18px">Depusă la ${esc(d.creat.slice(0, 10))}. Păstrează acest număr: el dovedește depunerea în termen.</p>` +
    `<table style="border-collapse:collapse;font-size:14px">` +
    `<tr><td style="padding:3px 14px 3px 0;color:#666">Rasa</td><td><strong>${esc(d.rasa)}</strong></td></tr>` +
    `<tr><td style="padding:3px 14px 3px 0;color:#666">Fătare</td><td>${esc(d.dataFatarii)}</td></tr>` +
    `<tr><td style="padding:3px 14px 3px 0;color:#666">Pui declarați</td><td>${d.pui.length}</td></tr>` +
    `<tr><td style="padding:3px 14px 3px 0;color:#666">Mamă</td><td>${esc(d.femela.nume)}</td></tr>` +
    `<tr><td style="padding:3px 14px 3px 0;color:#666">Tată</td><td>${esc(d.mascul.nume)}</td></tr>` +
    `</table>` +
    (d.pesteTermen
      ? `<p style="margin:18px 0 0;padding:10px 14px;background:#f9efef;border:1px solid #8c1d2f;color:#8c1d2f;font-size:14px">` +
        `Depunerea a depășit termenul de ${TERMEN_ZILE} de zile de la fătare. Dosarul a fost înregistrat, ` +
        `dar registratura va decide dacă poate fi soluționat.</p>`
      : "") +
    `<p style="margin:18px 0 0;font-size:14px">Urmează confirmarea proprietarului masculului și verificarea dosarului de către registratură. ` +
    `Stadiul îl vezi oricând în <a href="https://cfc-royal.ro/crescatori/">spațiul tău</a>.</p>` +
    `<hr style="margin:20px 0;border:none;border-top:1px solid #ddd">` +
    `<p style="color:#888;font-size:12px">Registrul genealogic — Asociația Club Federal Chinologic Royal · membru World Dog Federation</p>`;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Registrul genealogic CFC-Royal", email: "newsletter@cfc-royal.ro" },
        to: [{ email: membru.email }],
        subject: `[Registru] ${d.serie} — declarație înregistrată`,
        htmlContent: html,
      }),
    });
    if (!res.ok) { console.error("Brevo:", res.status, await res.text()); return false; }
    return true;
  } catch (err) { console.error("Confirmarea DMF a eșuat:", err); return false; }
}

/**
 * Validează corpul declarației. Întoarce { d } sau { eroare }.
 * Exportată ca să poată fi verificată în teste fără Blobs — aici stau regulile care
 * decid dacă un cuib intră sau nu în cartea de origini.
 */
export function valideazaDeclaratia(body, membru) {
  const rasa = taie(body.rasa, 80);
  if (rasa.length < 2) return { eroare: "Scrie rasa." };
  const varietate = taie(body.varietate, 80);

  const dataMontei = taie(body.dataMontei, 10);
  const dataFatarii = taie(body.dataFatarii, 10);
  if (!eData(dataMontei)) return { eroare: "Data montei trebuie scrisă ca AAAA-LL-ZZ." };
  if (!eData(dataFatarii)) return { eroare: "Data fătării trebuie scrisă ca AAAA-LL-ZZ." };
  if (dataMontei > dataFatarii) return { eroare: "Data montei nu poate fi după data fătării." };
  if (dataFatarii > azi()) return { eroare: "Data fătării nu poate fi în viitor." };

  const nr = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 30 ? n : null; };
  const nascutiM = nr(body.nascutiM), nascutiF = nr(body.nascutiF);
  const ramasiM = nr(body.ramasiM), ramasiF = nr(body.ramasiF);
  if (nascutiM === null || nascutiF === null || ramasiM === null || ramasiF === null)
    return { eroare: "Statistica cuibului acceptă numere întregi între 0 și 30." };
  if (nascutiM + nascutiF === 0) return { eroare: "Cuibul nu poate avea zero pui născuți." };
  if (ramasiM > nascutiM || ramasiF > nascutiF)
    return { eroare: "Nu poți avea mai mulți pui rămași pentru creștere decât născuți." };

  const parinte = (p, eticheta, cerEmail) => {
    const nume = taie(p?.nume, 120);
    if (nume.length < 2) return { eroare: `Scrie numele ${eticheta}.` };
    const pedigree = taie(p?.pedigree, 60);
    if (pedigree.length < 2) return { eroare: `Scrie numărul/seria certificatului de pedigree ${eticheta}.` };
    const microcip = taie(p?.microcip, 30).replace(/[\s-]/g, "");
    if (!microcipValid(microcip))
      return { eroare: `Microcipul ${eticheta} trebuie să aibă 15 cifre (ISO) sau 10 cifre.` };
    const dataNasterii = taie(p?.dataNasterii, 10);
    if (!eData(dataNasterii)) return { eroare: `Data nașterii ${eticheta} trebuie scrisă ca AAAA-LL-ZZ.` };
    if (dataNasterii >= dataFatarii) return { eroare: `Data nașterii ${eticheta} este ulterioară fătării.` };
    const proprietar = taie(p?.proprietar, 120);
    if (proprietar.length < 2) return { eroare: `Scrie proprietarul ${eticheta}.` };
    const email = taie(p?.email, 200).toLowerCase();
    if (cerEmail && !EMAIL_RE.test(email))
      return { eroare: "E-mailul proprietarului masculului e obligatoriu: pe el pleacă cererea de confirmare a montei." };
    if (!cerEmail && email && !EMAIL_RE.test(email)) return { eroare: `Adresa de e-mail ${eticheta} nu este validă.` };
    return {
      p: {
        nume, pedigree, microcip, dataNasterii, proprietar, email,
        palmares: taie(p?.palmares, 400),
        membruAsociatiei: taie(p?.membruAsociatiei, 120),
        adresa: taie(p?.adresa, 200),
        telefon: taie(p?.telefon, 40),
      },
    };
  };

  // E-mailul proprietarului masculului e cerut: pe el pleacă linkul de confirmare a
  // montei (faza următoare), inclusiv pentru masculi din alte asociații sau străinătate.
  const m = parinte(body.mascul, "masculului", true);
  if (m.eroare) return m;
  const f = parinte(body.femela, "femelei", false);
  if (f.eroare) return f;

  const brut = Array.isArray(body.pui) ? body.pui.slice(0, MAX_PUI) : [];
  if (brut.length !== ramasiM + ramasiF)
    return { eroare: `Ai completat ${brut.length} pui, dar statistica arată ${ramasiM + ramasiF} rămași pentru creștere.` };
  const pui = [];
  for (let i = 0; i < brut.length; i++) {
    const x = brut[i];
    const nume = taie(x?.nume, 100);
    if (nume.length < 2) return { eroare: `Scrie numele puiului ${i + 1}.` };
    const sex = taie(x?.sex, 1).toUpperCase();
    if (sex !== "M" && sex !== "F") return { eroare: `Alege sexul puiului ${i + 1}.` };
    const cump = x?.cumparator || {};
    const emailCump = taie(cump.email, 200).toLowerCase();
    if (emailCump && !EMAIL_RE.test(emailCump))
      return { eroare: `Adresa de e-mail a cumpărătorului puiului ${i + 1} nu este validă.` };
    pui.push({
      nume, sex,
      culoare: taie(x?.culoare, 60),
      varietate: taie(x?.varietate, 60),
      tipPar: taie(x?.tipPar, 60),
      // La vârsta declarării puii sunt rareori cipați — actul cere „Tatuaj sau Microcip",
      // deci câmpul rămâne liber până la aplicare.
      identificare: taie(x?.identificare, 30),
      cumparator: {
        nume: taie(cump.nume, 120), adresa: taie(cump.adresa, 200),
        localitate: taie(cump.localitate, 120), judet: taie(cump.judet, 60),
        tara: taie(cump.tara, 60), codPostal: taie(cump.codPostal, 20),
        telefon: taie(cump.telefon, 40), email: emailCump,
      },
    });
  }
  const nM = pui.filter((p) => p.sex === "M").length;
  if (nM !== ramasiM || pui.length - nM !== ramasiF)
    return { eroare: `Rândurile de pui (${nM} masculi, ${pui.length - nM} femele) nu se potrivesc cu statistica (${ramasiM} / ${ramasiF}).` };
  // Actul cere ordinea: întâi masculii, apoi femelele. O impunem noi, ca omul să nu
  // fie respins pentru ordinea rândurilor.
  pui.sort((a, b) => (a.sex === b.sex ? 0 : a.sex === "M" ? -1 : 1));

  const c = body.consimtaminte || {};
  if (!c.adn || !c.predare60 || !c.gdpr)
    return { eroare: "Toate cele trei declarații pe propria răspundere trebuie bifate." };

  // CEZARIANA (Art. 9 alin. 2 din Regulamentul de creștere și sănătate): crescătorul
  // declară odată cu DMF dacă fătarea s-a făcut prin operație. Obligatoriu DOAR la
  // montele de după intrarea în vigoare (Art. 27) — un cuib vechi, depus târziu, nu
  // poate fi respins pentru o rubrică pe care formularul de atunci n-o avea.
  const cez = taie(body.fatareCezariana, 4).toLowerCase();
  let fatareCezariana = null;
  if (cez === "da") fatareCezariana = true;
  else if (cez === "nu") fatareCezariana = false;
  else if (dataMontei >= START_PORTI)
    return { eroare: "Spune dacă fătarea s-a făcut prin operație cezariană (da sau nu) — Regulamentul de creștere și sănătate, Art. 9 alin. (2)." };

  // Motivul de selecție (Art. 12) — cerut de poartă doar când părinții sunt rude de
  // gradul al doilea; aici doar se taie la lungime.
  const motivSelectie = taie(body.motivSelectie, 400);

  // SEMNĂTURA. Formularul tipărit are rubrica „Semnătura"; online îi ține locul numele
  // scris de om plus bifa explicită. Se cer amândouă — o bifă singură nu spune cine a
  // semnat, iar un nume fără bifă nu spune că și-a asumat.
  const semnatura = taie(body.semnatura, 120);
  if (!c.semnatura)
    return { eroare: "Bifează asumarea semnăturii: fără ea, declarația nu e semnată." };
  if (semnatura.length < 5 || !semnatura.includes(" "))
    return { eroare: "Scrie numele și prenumele complet la semnătură." };

  // AFIXUL se poate scrie pe declarație chiar dacă în fișa de membru nu există: cineva
  // se poate înscrie fără canisă și să-și înregistreze una un an mai târziu. Ce vine din
  // formular are întâietate; fișa de membru rămâne doar valoarea prestabilită.
  const afix = taie(body.afix, 120) || taie(membru.afix, 120);
  const nrAfix = taie(body.nrAfix, 40) || taie(membru.nrAfix, 40);

  const zile = zileIntre(dataFatarii, azi());
  return {
    d: {
      rasa, varietate, dataMontei, dataFatarii,
      nascutiM, nascutiF, ramasiM, ramasiF,
      mascul: m.p, femela: f.p, pui,
      fatareCezariana, motivSelectie,
      consimtaminte: { adn: true, predare60: true, gdpr: true, semnatura: true },
      semnatura,
      afix, nrAfix,
      zileDeLaFatare: zile,
      pesteTermen: zile > TERMEN_ZILE,
    },
  };
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const actiune = taie(body.actiune, 24);

  // —— Confirmarea montei: SINGURELE acțiuni fără cod ——
  // Proprietarul masculului poate fi din altă asociație sau din străinătate. Cheia lui e
  // jetonul din link, de 32 de octeți; în stocare stă doar amprenta lui.
  if (actiune === "confirmare-vezi" || actiune === "confirmare-raspuns") {
    const jeton = taie(body.jeton, 100);
    if (!jeton) return json({ eroare: "Link incomplet." }, 400);
    // Stocarea se deschide DUPĂ verificări, ca în restul funcțiilor: cererile fără cheie
    // nici n-o ating, iar funcția rămâne testabilă local, fără Blobs.
    const s0 = store();
    const cheie = "confirmare/" + sha256(jeton);
    const inv = await s0.get(cheie, { type: "json" }).catch(() => null);
    if (!inv) return json({ eroare: "Link invalid sau deja folosit." }, 404);
    if (inv.expira && inv.expira < new Date().toISOString())
      return json({ eroare: "Linkul a expirat. Cere crescătorului să-l retrimită." }, 410);

    const d = await s0.get("dmf/" + inv.dmfId, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosarul nu mai există." }, 404);

    if (actiune === "confirmare-vezi") {
      // Doar ce trebuie ca omul să recunoască monta. Datele cumpărătorilor, dovada plății
      // și pedigree-urile încărcate nu-l privesc.
      return json({
        dosar: {
          serie: d.serie, rasa: d.rasa, dataMontei: d.dataMontei, dataFatarii: d.dataFatarii,
          mascul: { nume: d.mascul.nume, pedigree: d.mascul.pedigree, microcip: d.mascul.microcip },
          femela: { nume: d.femela.nume, pedigree: d.femela.pedigree },
          crescator: d.membruNume, pui: (d.pui || []).length,
          stare: d.confirmare?.stare || "asteptare",
        },
      });
    }

    const raspuns = taie(body.raspuns, 10);
    if (raspuns !== "confirm" && raspuns !== "refuz") return json({ eroare: "Alege o variantă." }, 400);
    const nume = taie(body.nume, 120);
    if (nume.length < 3) return json({ eroare: "Scrie numele dumneavoastră." }, 400);
    const motiv = taie(body.motiv, 600);
    if (raspuns === "refuz" && motiv.length < 5)
      return json({ eroare: "Scrie pe scurt de ce nu confirmați." }, 400);

    const urma = {
      stare: raspuns === "confirm" ? "confirmat" : "refuzat",
      email: inv.email, nume, motiv,
      la: new Date().toISOString(),
      ip: req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "",
    };
    // Refuzul NU blochează dosarul: poate fi și o dispută între oameni, nu neapărat un fals.
    // Îl semnalăm registraturii, care decide.
    await s0.setJSON("dmf/" + inv.dmfId, { ...d, confirmare: { ...(d.confirmare || {}), ...urma } });
    await s0.delete(cheie).catch(() => {});   // jeton de unică folosință
    await jurnalizeaza(s0, {
      fapta: "confirmare-raspuns",
      actor: actorExtern(nume),
      obiect: d.serie,
      detalii: (urma.stare === "confirmat" ? "A confirmat monta" : "NU a confirmat monta") +
        ` (${inv.email})` + (motiv ? " — " + motiv : ""),
      ip: urma.ip,
    });
    return json({ ok: true, stare: urma.stare });
  }

  const cod = taie(body.cod, 60);
  const eu = await cine(cod);
  if (!eu) return json({ eroare: "Cod incorect." }, 401);

  const s = store();

  // A doua cheie, pentru rolurile grele. Membrul nu trece pe aici: el își vede doar
  // propriile dosare, iar un pas în plus la fiecare depunere l-ar alunga de la formular.
  if (ROLURI_PROTEJATE.includes(eu.rol) &&
      !(await dispozitivCunoscut(s, taie(body.dispozitiv, 80), eu.rol))) {
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403);
  }

  // —— Ciornă: deschide dosarul, ca fișierele să se încarce unul câte unul ——
  // Patru fotografii de telefon într-o singură cerere depășesc limita de mărime și
  // depunerea ar eșua exact la omul cu poze mari. Fiecare piesă merge separat.
  if (actiune === "ciorna-noua") {
    if (eu.rol === "membru") {
      if (!eu.membru.cotizatieLaZi)
        return json({ eroare: "Cotizația a expirat. Reînnoiește-o pentru a putea depune declarații." }, 403);
      const id = idNou();
      await s.setJSON("ciorna/" + id, { membruId: eu.membru.id, creat: new Date().toISOString() });
      return json({ ok: true, ciornaId: id });
    }
    if (eu.rol === "chinotehnist") {
      // Fără verificare de cotizație: crescătorul afiliat nu e membru direct, iar taxa
      // DMF o plătește el în contul CFCR — dovada plății e piesă obligatorie la dosar.
      const id = idNou();
      await s.setJSON("ciorna/" + id, {
        chinotehnistId: eu.chinotehnist.id,
        asociatieSlug: eu.chinotehnist.asociatieSlug,
        creat: new Date().toISOString(),
      });
      return json({ ok: true, ciornaId: id });
    }
    if (eu.rol === "registratura") {
      // Depunerea telefonică: registratura depune ÎN NUMELE unui membru care nu folosește
      // formularul online. Titularul dosarului rămâne membrul; registratura e doar mâna
      // care scrie — proveniența se consemnează pe dosar și în jurnal.
      const id = idNou();
      await s.setJSON("ciorna/" + id, { registratorId: eu.registrator.id, creat: new Date().toISOString() });
      return json({ ok: true, ciornaId: id });
    }
    return json({ eroare: "Doar membrii, chinotehniștii și registratura depun declarații." }, 403);
  }

  if (actiune === "fisier") {
    if (eu.rol !== "membru" && eu.rol !== "chinotehnist" && eu.rol !== "registratura")
      return json({ eroare: "Doar membrii, chinotehniștii și registratura încarcă piese la dosar." }, 403);
    const ciornaId = taie(body.ciornaId, 40);
    if (!segmentCheieValid(ciornaId)) return json({ eroare: "Referință invalidă." }, 400);
    const fel = taie(body.fel, 32);
    if (!FELURI[fel]) return json({ eroare: "Piesă necunoscută." }, 400);
    const ciorna = await s.get("ciorna/" + ciornaId, { type: "json" }).catch(() => null);
    if (!ciornaAMea(ciorna, eu)) return json({ eroare: "Dosar inexistent." }, 404);

    const tip = taie(body.tip, 60);
    if (!TIPURI_OK.includes(tip)) return json({ eroare: "Acceptăm doar JPEG, PNG, WEBP sau PDF." }, 400);
    let date;
    try { date = Buffer.from(String(body.continut || ""), "base64"); }
    catch { return json({ eroare: "Fișier ilizibil." }, 400); }
    if (!date.length) return json({ eroare: "Fișier gol." }, 400);
    if (date.length > MAX_PARTE) {
      return json({ eroare: "Fișierul e prea mare pentru o singură cerere. Se trimite pe bucăți." }, 400);
    }

    await s.set("dmf-fisier/" + ciornaId + "/" + fel, date, {
      metadata: { nume: taie(body.nume, 160), tip, marime: date.length },
    });
    return json({ ok: true, fel, marime: date.length });
  }

  // —— Fișiere mari, pe bucăți ——
  //
  // Fiecare bucată vine într-o cerere a ei, bine sub plafonul platformei. Bucățile stau
  // deoparte, sub `dmf-parte/`, până sosesc toate; abia atunci se lipesc și se scriu la
  // locul lor. Un dosar cu bucăți nelipite n-are piesa: nimic pe jumătate nu ajunge în
  // dosar, nici dacă omul închide pagina la mijloc.
  if (actiune === "fisier-parte" || actiune === "fisier-gata") {
    if (eu.rol !== "membru" && eu.rol !== "chinotehnist" && eu.rol !== "registratura")
      return json({ eroare: "Doar membrii, chinotehniștii și registratura încarcă piese la dosar." }, 403);
    const ciornaId = taie(body.ciornaId, 40);
    if (!segmentCheieValid(ciornaId)) return json({ eroare: "Referință invalidă." }, 400);
    const fel = taie(body.fel, 32);
    if (!FELURI[fel]) return json({ eroare: "Piesă necunoscută." }, 400);
    const ciorna = await s.get("ciorna/" + ciornaId, { type: "json" }).catch(() => null);
    if (!ciornaAMea(ciorna, eu)) return json({ eroare: "Dosar inexistent." }, 404);

    const tip = taie(body.tip, 60);
    if (!TIPURI_OK.includes(tip)) return json({ eroare: "Acceptăm doar JPEG, PNG, WEBP sau PDF." }, 400);

    const total = Number(body.total);
    if (!Number.isInteger(total) || total < 1 || total > MAX_PARTI) {
      return json({ eroare: `Fișierul e prea mare: se trimite în cel mult ${MAX_PARTI} bucăți.` }, 400);
    }
    const cheieParte = (i) => "dmf-parte/" + ciornaId + "/" + fel + "/" + i;

    if (actiune === "fisier-parte") {
      const index = Number(body.index);
      if (!Number.isInteger(index) || index < 0 || index >= total) {
        return json({ eroare: "Bucată în afara șirului." }, 400);
      }
      let bucata;
      try { bucata = Buffer.from(String(body.continut || ""), "base64"); }
      catch { return json({ eroare: "Bucată ilizibilă." }, 400); }
      if (!bucata.length) return json({ eroare: "Bucată goală." }, 400);
      if (bucata.length > MAX_PARTE) return json({ eroare: "Bucată prea mare." }, 400);

      await s.set(cheieParte(index), bucata, { metadata: { total, tip } });
      return json({ ok: true, index, total, marime: bucata.length });
    }

    // —— Lipirea ——
    const bucati = [];
    let suma = 0;
    // Tipul fișierului e cel scris odată cu bucățile, nu cel din cererea de lipire:
    // altfel ultima cerere ar putea răsboteza fișierul deja urcat. Amândouă trec prin
    // aceeași listă albă, dar adevărul unei piese se ia de la piesă.
    let tipScris = "";
    for (let i = 0; i < total; i++) {
      const b = await s.getWithMetadata(cheieParte(i), { type: "arrayBuffer" }).catch(() => null);
      // O bucată lipsă înseamnă că trimiterea nu s-a terminat. Nu lipim ce avem: un act
      // de origine ciuntit e mai rău decât unul lipsă, fiindcă arată ca un act întreg.
      if (!b || !b.data) return json({ eroare: `Lipsește bucata ${i + 1} din ${total}. Încarcă fișierul din nou.` }, 409);
      if (i === 0) tipScris = String(b.metadata?.tip || "");
      const u = Buffer.from(b.data);
      suma += u.length;
      if (suma > MAX_FISIER) {
        return json({ eroare: `Fișierul depășește ${Math.round(MAX_FISIER / 1024 / 1024)} MB.` }, 400);
      }
      bucati.push(u);
    }

    const intreg = Buffer.concat(bucati);
    await s.set("dmf-fisier/" + ciornaId + "/" + fel, intreg, {
      metadata: { nume: taie(body.nume, 160), tip: TIPURI_OK.includes(tipScris) ? tipScris : tip, marime: intreg.length },
    });
    for (let i = 0; i < total; i++) await s.delete(cheieParte(i)).catch(() => {});
    return json({ ok: true, fel, marime: intreg.length, parti: total });
  }

  if (actiune === "depune") {
    if (eu.rol !== "membru" && eu.rol !== "chinotehnist" && eu.rol !== "registratura")
      return json({ eroare: "Doar membrii, chinotehniștii și registratura depun declarații." }, 403);
    // Cotizația se verifică ACUM, nu la deschiderea ciornei: între timp putea expira.
    if (eu.rol === "membru" && !eu.membru.cotizatieLaZi)
      return json({ eroare: "Cotizația a expirat. Reînnoiește-o pentru a putea depune declarații." }, 403);

    const ciornaId = taie(body.ciornaId, 40);
    if (!segmentCheieValid(ciornaId)) return json({ eroare: "Referință invalidă." }, 400);
    const ciorna = await s.get("ciorna/" + ciornaId, { type: "json" }).catch(() => null);
    if (!ciornaAMea(ciorna, eu)) return json({ eroare: "Dosar inexistent." }, 404);

    // Chinotehnistul depune ÎN NUMELE unui crescător al asociației lui — deci dosarul
    // trebuie să spună al cui e cuibul. Datele vin din declarația semnată pe hârtie,
    // pe care chinotehnistul a încărcat-o la dosar (piesa dreptului de montă o poartă).
    let crescator = null;
    if (eu.rol === "chinotehnist" || eu.rol === "registratura") {
      const cNume = taie(body.crescator?.nume, 120);
      const cTelefon = taie(body.crescator?.telefon, 30);
      const cEmail = taie(body.crescator?.email, 200).toLowerCase();
      const cLocalitate = taie(body.crescator?.localitate, 120);
      if (cNume.length < 3) return json({ eroare: "Scrie numele crescătorului pentru care depui." }, 400);
      if (cTelefon.replace(/\D/g, "").length < 10)
        return json({ eroare: "Scrie telefonul crescătorului — pe el se fac lămuririle registraturii." }, 400);
      if (cEmail && !EMAIL_RE.test(cEmail)) return json({ eroare: "Adresa de e-mail a crescătorului nu este validă." }, 400);
      crescator = { nume: cNume, telefon: cTelefon, email: cEmail, localitate: cLocalitate };
    }

    const v = valideazaDeclaratia(body, eu.rol === "membru" ? eu.membru : { nume: crescator.nume });
    if (v.eroare) return json({ eroare: v.eroare }, 400);

    // Toate cele patru piese trebuie să existe. Verificarea se face la depunere, nu la
    // încărcare: altfel un dosar incomplet ar primi număr de înregistrare.
    const lipsa = [];
    for (const fel of Object.keys(FELURI)) {
      const f = await s.getMetadata("dmf-fisier/" + ciornaId + "/" + fel).catch(() => null);
      if (!f) lipsa.push(FELURI[fel]);
    }
    if (lipsa.length) return json({ eroare: "Lipsesc de la dosar: " + lipsa.join(", ") + "." }, 400);

    // ——— Porțile de creștere (Art. 22 din Regulamentul de creștere și sănătate) ———
    // ÎNAINTE de alocarea seriei: un dosar care nu poate trece nu primește număr.
    // Opririle întorc motivul scris, cu articolul (Art. 22 alin. 2); semnalele nu
    // opresc, ci rămân pe dosar, pentru ochiul registraturii.
    const cules = await culegePentruPorti(s, v.d);
    const porti = portiCrestere({
      dataMontei: v.d.dataMontei, dataFatarii: v.d.dataFatarii,
      mascul: v.d.mascul, femela: v.d.femela,
      fatareCezariana: v.d.fatareCezariana, motivSelectie: v.d.motivSelectie,
      ...cules,
    });
    if (porti.opriri.length) return json({ eroare: mesajOpriri(porti.opriri) }, 400);

    const an = new Date().getFullYear();
    const serie = await serieNoua(an);
    if (!serie) return json({ eroare: "Nu am putut aloca un număr de înregistrare. Reîncearcă." }, 500);

    // Pe cine poartă dosarul: crescătorul. La membrul direct, el e și depunătorul; la
    // depunerea prin asociația afiliată, crescătorul e cel din declarația semnată, iar
    // e-mailul lui (dacă are) primește confirmările — altfel merg la chinotehnist.
    const eAfiliat = eu.rol === "chinotehnist";
    const eRegistratura = eu.rol === "registratura";
    const eAsistat = eAfiliat || eRegistratura;
    const d = {
      ...v.d,
      id: ciornaId, serie,
      numarWDF: null,                       // îl completează registratura la înregistrarea cuibului
      stare: "depus",
      // Ce au văzut porțile de creștere la depunere (Art. 22). Semnalele nu opresc
      // dosarul, dar registratura trebuie să le vadă înainte de validare.
      porti: { verificatLa: new Date().toISOString(), semnale: porti.semnale },
      membruId: eAsistat ? null : eu.membru.id,
      membruNume: eAsistat ? crescator.nume : eu.membru.nume,
      membruEmail: eAsistat ? (crescator.email || (eAfiliat ? eu.chinotehnist.email : "")) : eu.membru.email,
      ...(eAsistat
        ? {
            crescatorTelefon: crescator.telefon,
            crescatorLocalitate: crescator.localitate,
            depunere: eAfiliat
              ? {
                  fel: "chinotehnist",
                  chinotehnistId: eu.chinotehnist.id,
                  chinotehnistNume: eu.chinotehnist.nume,
                  asociatie: eu.chinotehnist.asociatie,
                  asociatieSlug: eu.chinotehnist.asociatieSlug,
                }
              : {
                  // Depunerea telefonică: membrul e titularul, registratura doar scrie.
                  fel: "registratura",
                  telefonic: true,
                  registratorId: eu.registrator.id,
                  registratorNume: eu.registrator.nume || "registratură",
                },
          }
        : {}),
      creat: new Date().toISOString(),
      // Urma semnăturii: numele scris de om, momentul și de unde. Asta transformă bifa
      // într-o asumare verificabilă, nu doar într-o casetă bifată de un cont.
      semnaturaUrma: {
        nume: v.d.semnatura,
        la: new Date().toISOString(),
        ip: req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "",
      },
      confirmare: {
        stare: "asteptare",
        email: v.d.mascul.email,
        trimisLa: new Date().toISOString(),
        trimiteri: 1,
        adresaCorectata: false,
      },
    };
    await s.setJSON("dmf/" + ciornaId, d);
    // Index descendenți (S1): microcipul fiecărui părinte -> această declarație, ca fișa
    // publică a câinelui să-și găsească urmașii FĂRĂ să scaneze tot registrul. Nefatal:
    // un index nescris înseamnă doar o căutare mai lentă, nu o declarație ruptă.
    try {
      for (const pc of [d.mascul?.microcip, d.femela?.microcip]) {
        const c = String(pc || "").replace(/[\s-]/g, "");
        if (c) await s.setJSON("descendent-cip/" + c + "/" + ciornaId, { dmfId: ciornaId });
      }
    } catch (err) { console.error("Index descendenți (scriere) eșuat:", err); }
    // Rezumatul pentru listă: al membrului sau al asociației afiliate — spațiul e al
    // asociației, deci toți chinotehniștii ei văd aceleași dosare.
    const rezumat = {
      id: ciornaId, serie, rasa: d.rasa, dataFatarii: d.dataFatarii,
      pui: d.pui.length, stare: d.stare, pesteTermen: d.pesteTermen, creat: d.creat,
      ...(eAsistat ? { crescator: crescator.nume, depusDe: eAfiliat ? eu.chinotehnist.nume : (eu.registrator.nume || "registratură") } : {}),
    };
    await s.setJSON(
      eAfiliat
        ? "dmf-afiliat/" + eu.chinotehnist.asociatieSlug + "/" + ciornaId
        : eRegistratura
          ? "dmf-registratura/" + ciornaId
          : "dmf-membru/" + eu.membru.id + "/" + ciornaId,
      rezumat,
    );
    await s.delete("ciorna/" + ciornaId).catch(() => {});

    // Afixul scris pe declarație completează fișa de membru dacă acolo nu era niciunul
    // (canisă înregistrată după înscriere). Nu suprascrie niciodată un afix existent —
    // acela e dat de asociație, nu de formular. La depunerea prin asociația afiliată nu
    // există fișă de membru, deci nu e nimic de completat.
    if (eu.rol === "membru" && v.d.afix && !eu.membru.afix) {
      try {
        const fisa = await s.get("membru/" + eu.membru.id, { type: "json" });
        if (fisa && !fisa.afix) {
          await s.setJSON("membru/" + eu.membru.id, { ...fisa, afix: v.d.afix, nrAfix: v.d.nrAfix || fisa.nrAfix || "" });
        }
      } catch (err) { console.error("Completarea afixului în fișa de membru a eșuat:", err); }
    }

    const emailTrimis = await trimiteConfirmarea(
      eAsistat ? { nume: crescator.nume, email: d.membruEmail } : eu.membru, d);
    const { jeton } = await deschideConfirmarea(ciornaId, d.mascul.email);
    const cerereTrimisa = await trimiteCerereaCatreMascul(d, jeton);
    await jurnalizeaza(s, {
      fapta: "dmf-depus",
      actor: actorJurnal(eu),
      obiect: serie,
      detalii: `${d.rasa}, fătare ${d.dataFatarii}, ${d.pui.length} pui` +
        (eAfiliat ? ` — pentru ${crescator.nume}, prin ${eu.chinotehnist.asociatie}` : "") +
        (eRegistratura ? ` — pentru ${crescator.nume}, depus telefonic prin registratură` : "") +
        (d.pesteTermen ? ` — PESTE TERMEN (${d.zileDeLaFatare} zile)` : ""),
      ip: d.semnaturaUrma.ip,
    });
    return json({ ok: true, serie, id: ciornaId, pesteTermen: d.pesteTermen, emailTrimis, cerereTrimisa });
  }

  if (actiune === "mele") {
    if (eu.rol !== "membru" && eu.rol !== "chinotehnist" && eu.rol !== "registratura") return json({ eroare: "Nepermis." }, 403);
    const lista = [];
    try {
      // Membrul își vede dosarele lui; chinotehnistul — TOATE dosarele asociației,
      // inclusiv ale colegilor: spațiul e al asociației, nu al persoanei.
      const prefixListei = eu.rol === "chinotehnist"
        ? "dmf-afiliat/" + eu.chinotehnist.asociatieSlug + "/"
        : eu.rol === "registratura"
          ? "dmf-registratura/"
          : "dmf-membru/" + eu.membru.id + "/";
      const { blobs } = await s.list({ prefix: prefixListei });
      for (const b of blobs) {
        const x = await s.get(b.key, { type: "json" });
        if (!x) continue;
        // Starea confirmării se citește din dosarul propriu-zis, nu din rezumat: rezumatul
        // e scris o singură dată, la depunere, iar confirmarea vine mai târziu.
        const d = await s.get("dmf/" + x.id, { type: "json" }).catch(() => null);
        lista.push({
          ...x,
          confirmare: d?.confirmare?.stare || "asteptare",
          confirmareEmail: d?.confirmare?.email || null,
          adresaCorectata: !!d?.confirmare?.adresaCorectata,
        });
      }
    } catch (err) { console.error("Listare declarații eșuată:", err); }
    lista.sort((a, b) => String(b.creat).localeCompare(String(a.creat)));
    return json({ declaratii: lista });
  }

  // —— Retrimiterea cererii, cu o singură corectare de adresă ——
  // Adresa greșită a masculului e cel mai probabil punct de blocaj: fără ea, dosarul
  // așteaptă la nesfârșit. Corectarea e permisă O SINGURĂ dată și numai cât timp nimeni
  // n-a răspuns — altfel s-ar putea căuta o adresă complezentă până iese un „da".
  if (actiune === "confirmare-retrimite") {
    if (eu.rol !== "membru" && eu.rol !== "chinotehnist") return json({ eroare: "Nepermis." }, 403);
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);
    const alMeuRetrimite = eu.rol === "membru"
      ? d.membruId === eu.membru.id
      : d.depunere?.asociatieSlug === eu.chinotehnist.asociatieSlug;
    if (!alMeuRetrimite) return json({ eroare: "Nepermis." }, 403);
    const c = d.confirmare || {};
    if (c.stare === "confirmat" || c.stare === "refuzat" || c.stare === "alternativ")
      return json({ eroare: "Dosarul are deja un răspuns; adresa nu mai poate fi schimbată." }, 409);

    let email = c.email || d.mascul.email;
    const emailVechi = email;
    const emailNou = taie(body.emailNou, 200).toLowerCase();
    let corectat = !!c.adresaCorectata;
    let schimbataAcum = false;
    if (emailNou && emailNou !== email) {
      if (corectat) return json({ eroare: "Adresa a fost deja corectată o dată. Scrie secretariatului." }, 409);
      if (!EMAIL_RE.test(emailNou)) return json({ eroare: "Adresa de e-mail nu este validă." }, 400);
      email = emailNou;
      corectat = true;
      schimbataAcum = true;
    }

    const { jeton } = await deschideConfirmarea(id, email);
    const trimis = await trimiteCerereaCatreMascul({ ...d, mascul: { ...d.mascul, email } }, jeton);
    await s.setJSON("dmf/" + id, {
      ...d,
      mascul: { ...d.mascul, email },
      confirmare: { ...c, stare: "asteptare", email, trimisLa: new Date().toISOString(),
        trimiteri: (c.trimiteri || 0) + 1, adresaCorectata: corectat },
    });
    await jurnalizeaza(s, {
      fapta: schimbataAcum ? "confirmare-adresa" : "confirmare-trimisa",
      actor: actorJurnal(eu),
      obiect: d.serie,
      detalii: `Cerere trimisă către ${email} (trimiterea ${(c.trimiteri || 0) + 1})` +
        (schimbataAcum ? ` — adresă corectată, era ${emailVechi}` : ""),
      ip: ipCerere(req),
    });
    return json({ ok: true, email, trimis, adresaCorectata: corectat });
  }

  // —— Registratura și administratorul ——
  //
  // ARHIVAREA nu înseamnă ștergere: un dosar cu certificate emise e dovada din spatele
  // actelor și rămâne pentru totdeauna. Înseamnă doar că iese din lista de lucru — altfel,
  // după cincizeci de cuiburi, cel care caută dosarul de azi derulează printr-un zid.
  // „În lucru" = depus sau verificat; „Arhivă" = emis sau respins.
  if (actiune === "dosare") {
    if (eu.rol !== "registratura" && eu.rol !== "admin") return json({ eroare: "Nepermis." }, 403);
    const filtru = taie(body.filtru, 12) || "lucru";
    const cauta = taie(body.cauta, 80).toLowerCase();
    const eArhivat = (st) => st === "emis" || st === "respins";
    const lista = [];
    let inLucru = 0, arhivate = 0;
    try {
      const { blobs } = await s.list({ prefix: "dmf/" });
      for (const b of blobs) {
        const x = await s.get(b.key, { type: "json" });
        if (!x) continue;
        const arhivat = eArhivat(x.stare);
        if (arhivat) arhivate++; else inLucru++;

        if (filtru === "lucru" && arhivat) continue;
        if (filtru === "arhiva" && !arhivat) continue;
        // Căutarea merge peste serie, rasă și numele crescătorului: astea trei sunt ce
        // ține omul minte când revine la un dosar vechi.
        if (cauta) {
          const paie = [x.serie, x.rasa, x.membruNume, x.numarWDF,
            x.depunere?.asociatie, x.depunere?.chinotehnistNume].filter(Boolean).join(" ").toLowerCase();
          if (!paie.includes(cauta)) continue;
        }
        lista.push({
          id: x.id, serie: x.serie, numarWDF: x.numarWDF || null, rasa: x.rasa,
          dataFatarii: x.dataFatarii, pui: (x.pui || []).length, stare: x.stare,
          pesteTermen: x.pesteTermen, membruNume: x.membruNume, creat: x.creat,
          confirmare: x.confirmare?.stare || "asteptare", arhivat,
          // Proveniența: dosarul depus prin asociația afiliată se vede dintr-o privire.
          depunere: x.depunere
            ? { asociatie: x.depunere.asociatie || "", chinotehnist: x.depunere.chinotehnistNume || "" }
            : null,
        });
      }
    } catch (err) { console.error("Listare dosare eșuată:", err); }
    lista.sort((a, b) => String(b.creat).localeCompare(String(a.creat)));
    // Dreptul curent pleacă odată cu lista, citit ACUM din fișă — nu din ce a memorat
    // browserul la intrare. Fără el, registratorul căruia i s-a dat dreptul după
    // autentificare nu vedea secțiunea extraselor până la o nouă intrare.
    return json({
      dosare: lista, inLucru, arhivate,
      poateDaAcces: eu.rol === "admin" || eu.registrator?.poateDaAcces === true,
    });
  }

  // Închiderea unui dosar fără emitere: cererea se respinge motivat și trece în arhivă.
  // Fără asta, un dosar nesoluționabil ar rămâne veșnic în lista de lucru.
  if (actiune === "dosar-respinge") {
    if (eu.rol !== "registratura" && eu.rol !== "admin") return json({ eroare: "Nepermis." }, 403);
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const motiv = taie(body.motiv, 600);
    if (motiv.length < 5) return json({ eroare: "Scrie motivul respingerii." }, 400);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);
    if (d.stare === "emis")
      return json({ eroare: "Dosarul are certificate emise și nu mai poate fi respins." }, 409);
    await s.setJSON("dmf/" + id, {
      ...d, stare: "respins",
      respingere: {
        motiv, la: new Date().toISOString(),
        deCatre: eu.rol === "admin" ? "administrator" : (eu.registrator?.nume || "registratură"),
      },
    });
    await jurnalizeaza(s, {
      fapta: "dmf-respins",
      actor: actorJurnal(eu),
      obiect: d.serie,
      detalii: `Crescător: ${d.membruNume} — motiv: ${motiv}`,
      ip: ipCerere(req),
    });
    return json({ ok: true });
  }

  if (actiune === "dosar") {
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);
    const alMeu =
      (eu.rol === "membru" && d.membruId === eu.membru.id) ||
      // Dosarul depus prin asociația afiliată e al asociației: orice chinotehnist al ei
      // îl vede — colegii răspund crescătorilor și când depunătorul e în concediu.
      (eu.rol === "chinotehnist" && d.depunere?.asociatieSlug === eu.chinotehnist.asociatieSlug);
    if (!alMeu && eu.rol !== "registratura" && eu.rol !== "admin") return json({ eroare: "Nepermis." }, 403);
    return json({ dosar: d });
  }

  // —— Dovada alternativă: pagina semnată pe hârtie ——
  // La masculii din străinătate e-mailul se pierde des, iar dosarul ar rămâne blocat
  // pentru totdeauna. Registratura poate încărca dovada semnată și trece dosarul mai
  // departe, pe răspunderea ei — cine a făcut-o și când rămâne scris.
  if (actiune === "confirmare-alternativa") {
    if (eu.rol !== "registratura" && eu.rol !== "admin") return json({ eroare: "Nepermis." }, 403);
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);

    const tip = taie(body.tip, 60);
    if (!TIPURI_OK.includes(tip)) return json({ eroare: "Acceptăm doar JPEG, PNG, WEBP sau PDF." }, 400);
    let date;
    try { date = Buffer.from(String(body.continut || ""), "base64"); }
    catch { return json({ eroare: "Fișier ilizibil." }, 400); }
    if (!date.length) return json({ eroare: "Fișier gol." }, 400);
    if (date.length > MAX_PARTE) {
      return json({ eroare: "Fișierul depășește 3 MB. Scanează la o rezoluție mai mică sau trimite-l ca fotografie." }, 400);
    }

    await s.set("dmf-fisier/" + id + "/" + FEL_ALTERNATIV, date, {
      metadata: { nume: taie(body.nume, 160), tip, marime: date.length },
    });
    await s.setJSON("dmf/" + id, {
      ...d,
      confirmare: {
        ...(d.confirmare || {}), stare: "alternativ",
        la: new Date().toISOString(),
        deCatre: eu.rol === "admin" ? "administrator" : (eu.registrator?.nume || "registratură"),
        observatie: taie(body.observatie, 400),
      },
    });
    await jurnalizeaza(s, {
      fapta: "confirmare-alternativa",
      actor: actorJurnal(eu),
      obiect: d.serie,
      detalii: `Dovadă semnată acceptată în locul confirmării pe link` +
        (taie(body.observatie, 400) ? " — " + taie(body.observatie, 400) : ""),
      ip: ipCerere(req),
    });
    return json({ ok: true });
  }

  // Fișierele nu stau public: ies doar prin funcție, pentru proprietarul dosarului
  // sau pentru registratură. Pedigree-urile și dovada plății sunt date personale.
  if (actiune === "vezi-fisier") {
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const fel = taie(body.fel, 32);
    if (!TOATE_FELURILE[fel]) return json({ eroare: "Piesă necunoscută." }, 400);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);
    const alMeu =
      (eu.rol === "membru" && d.membruId === eu.membru.id) ||
      // Dosarul depus prin asociația afiliată e al asociației: orice chinotehnist al ei
      // îl vede — colegii răspund crescătorilor și când depunătorul e în concediu.
      (eu.rol === "chinotehnist" && d.depunere?.asociatieSlug === eu.chinotehnist.asociatieSlug);
    if (!alMeu && eu.rol !== "registratura" && eu.rol !== "admin") return json({ eroare: "Nepermis." }, 403);
    const f = await s.getWithMetadata("dmf-fisier/" + id + "/" + fel, { type: "arrayBuffer" }).catch(() => null);
    if (!f) return json({ eroare: "Piesa lipsește de la dosar." }, 404);
    return new Response(f.data, {
      headers: {
        "Content-Type": f.metadata?.tip || "application/octet-stream",
        "Cache-Control": "no-store",
        "Content-Disposition": "inline",
      },
    });
  }

  // —— Ștergerea unui dosar (doar administratorul) ——
  //
  // NUMĂRUL nu se reciclează niciodată: un număr de înregistrare dat altcuiva ar
  // însemna două acte cu aceeași referință. Singura excepție e ULTIMUL număr dat în anul
  // curent — acela poate fi luat înapoi, fiindcă nimic nu s-a construit peste el. Așa se
  // pot șterge curat declarațiile de probă, fără ca registrul real să înceapă de la 2.
  if (actiune === "dmf-sterge") {
    if (eu.rol !== "admin") return json({ eroare: "Doar administratorul poate șterge un dosar." }, 403);
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);

    // Un dosar cu certificate EMISE nu se șterge: pedigree-urile, indecșii după microcip
    // și fișa publică /caine/ ar rămâne orfane (arătând acte ale unui dosar inexistent).
    // Corecția unui dosar emis are calea ei dedicată (registru-corectie), cu invariante.
    if (d.stare === "emis")
      return json({ eroare: "Dosarul are certificate emise — nu se șterge. Pentru îndreptări folosește calea de corecție." }, 409);

    // Urma se scrie ÎNAINTE de ștergere și, dacă nu se poate scrie, nu ștergem nimic.
    // Un dosar care dispare fără urmă e mai rău decât un dosar rămas în plus.
    try {
      await jurnalizeazaObligatoriu(s, {
        fapta: "dmf-sters",
        actor: actorJurnal(eu),
        obiect: d.serie,
        detalii: `Crescător: ${d.membruNume}; ${d.rasa}, fătare ${d.dataFatarii}, ` +
          `${(d.pui || []).length} pui; stare la ștergere: ${d.stare}`,
        ip: ipCerere(req),
      });
    } catch (err) {
      console.error("Jurnalul nu a putut fi scris; ștergerea a fost oprită:", err);
      return json({ eroare: "Nu am putut consemna ștergerea în jurnal, deci nu am șters nimic. Reîncearcă." }, 503);
    }

    for (const fel of Object.keys(TOATE_FELURILE)) {
      await s.delete("dmf-fisier/" + id + "/" + fel).catch(() => {});
    }
    await s.delete("dmf-membru/" + d.membruId + "/" + id).catch(() => {});
    // Urma citirii automate, starea ei și jetonul de fundal. Rămase în urmă, ar fi trăit
    // veșnic — și, fiindcă arhiva ia TOT ce e în magazie, ar fi călătorit în fiecare
    // copie de siguranță, la nesfârșit, pentru un dosar care nu mai există.
    for (const cheie of cheileCitirii(id)) await s.delete(cheie).catch(() => {});
    await s.delete("dmf/" + id).catch(() => {});

    let numarEliberat = false;
    const m = /^CFCR-DMF-(\d{4})-(\d{4})$/.exec(d.serie || "");
    if (m) {
      const an = m[1], nr = Number(m[2]);
      const c = await s.get("contor/dmf-" + an, { type: "json" }).catch(() => null);
      if (c && c.ultim === nr) {
        await s.setJSON("contor/dmf-" + an, { ultim: nr - 1 });
        await s.delete("serie/" + d.serie).catch(() => {});
        numarEliberat = true;
      }
    }
    return json({ ok: true, serie: d.serie, numarEliberat });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
