// registru-pedigree.mjs — ascendența cuibului și Certificatele de Origine (Pedigree).
//
// Continuă acolo unde se oprește declarația: dosarul verificat primește numărul de cuib
// WDF, i se completează ascendența pe patru generații, iar din el se emit certificatele
// individuale — câte unul pentru fiecare pui.
//
// CELE 30 DE POZIȚII. Ascendența unui câine pe patru generații înseamnă 2 părinți +
// 4 bunici + 8 străbunici + 16 stră-străbunici. Fiecare poziție are un cod format din
// litere „T" (tată) și „M" (mamă), citit de la câine în sus: „TM" e mama tatălui,
// „MTT" e tatăl tatălui mamei. Codul spune drumul, deci nu se poate încurca.
//
// TIPUL CERTIFICATULUI NU SE ALEGE, SE CALCULEAZĂ. Tip A dacă toate cele 30 de poziții
// au detalii de înregistrare (număr de pedigree), Tip B dacă lipsește oricare, pe oricare
// linie. Lăsat la alegerea omului, tipul ar deveni o chestiune de indulgență; calculat
// din date, e o constatare.
//
// Stocare (store „registru"):
//   dmf/<id>                    -> primește `numarWDF`, `ascendenta`, `stare`
//   pedigree/<serie>            -> certificatul emis (cu ascendența înghețată în el)
//   pedigree-cuib/<dmfId>/<i>   -> seria certificatului puiului i, pentru listare
//   pedigree-caine/<microcip>   -> seria, pentru căutarea după microcip
//   contor/pedigree-<an>        -> { ultim }
//   contor/wdf                  -> { ultim }   (pornește de la 76: primul cuib emis ia 77)
//
// POST { cod, actiune:"ascendenta", id }                       (registratură/admin)
// POST { cod, actiune:"ascendenta-salveaza", id, ascendenta }  (registratură/admin)
// POST { cod, actiune:"numar-wdf", id }                        (registratură/admin)
// POST { cod, actiune:"emite", id, pui:[{ index, proprietar }] } (registratură/admin)
// POST { cod, actiune:"certificat", serie }                    (registratură/admin/crescător)
// POST { actiune:"verifica", serie }                           PUBLIC — date minime
import { getStore } from "@netlify/blobs";
import { actorDinCod, sha256 } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";
import { membruDinCod, registratorDinCod, chinotehnistDinCod } from "./registru-acces.mjs";
import {
  jurnalizeaza, jurnalizeazaObligatoriu, actorJurnal, ipCerere,
} from "./_comun/registru-jurnal.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";
import { poateCereExtras, numarDinText, intervalulCerut, inInterval, inValuri } from "./_comun/extrase.mjs";
import { mascheazaCip } from "./_comun/microcip.mjs";
import { json } from "./_comun/raspuns.mjs";

// CITIRE TARE, ca la poarta de acces.
//
// Aici se lucrează dosarele și se EMIT acte. Cu citire obișnuită, un cod revocat ar
// mai fi recunoscut zeci de secunde din copia veche a magaziei — adică exact atât cât
// îi trebuie cuiva căruia tocmai i-ai luat dreptul ca să mai emită un certificat.
// O revocare care nu revocă imediat nu e o revocare.
const store = () => getStore({ name: "registru", consistency: "strong" });

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();

/** Primul cuib emis prin registrul digital ia numărul 77 — pe hârtie s-a ajuns la 76. */
export const WDF_ULTIMUL_PE_HARTIE = 76;

/**
 * Codurile celor 30 de poziții, în ordinea în care se citesc pe certificat:
 * întâi linia tatălui, apoi a mamei, de la părinți spre stră-străbunici.
 */
export function pozitiiAscendenta() {
  const out = [];
  for (let gen = 1; gen <= 4; gen++) {
    const n = Math.pow(2, gen);
    for (let i = 0; i < n; i++) {
      // Bitul cel mai semnificativ e cel mai apropiat de câine: 0 = tată, 1 = mamă.
      let cod = "";
      for (let b = gen - 1; b >= 0; b--) cod += ((i >> b) & 1) ? "M" : "T";
      out.push({ cod, generatie: gen });
    }
  }
  return out;
}

/**
 * Eticheta în română a unei poziții: „mama tatălui", „tatăl tatălui mamei"…
 *
 * Codul se citește de la câine în sus, deci ULTIMA literă e persoana descrisă, iar
 * cele dinaintea ei sunt posesorii, în ordine inversă: „TM" = mama (M) tatălui (T).
 * Construită invers, eticheta ar spune exact pe dos — iar registratura ar transcrie
 * ascendența încrucișată, fără să aibă cum să-și dea seama.
 */
export function etichetaPozitie(cod) {
  const l = [...cod];
  let s = l[l.length - 1] === "T" ? "tatăl" : "mama";
  for (let i = l.length - 2; i >= 0; i--) s += " " + (l[i] === "T" ? "tatălui" : "mamei");
  return s;
}

/**
 * Tipul certificatului, calculat din ascendență. Regula World Dog Federation:
 *
 *   Tip A — ascendența cunoscută în ÎNTREGIME (toate cele 30 de poziții);
 *   Tip B — ascendența cunoscută PARȚIAL (măcar o poziție, dar nu toate);
 *   Tip C — ascendența NU e cunoscută deloc: certificatul de tipicitate de rasă.
 *
 * TIPICITATEA E ALT TRASEU. Tip C se acordă în urma participării la o expoziție, unde
 * exemplarul e judecat după conformitatea cu standardul — fără declarație de montă și
 * fătare, fiindcă părinții nu se cunosc.
 *
 * De aici o regulă care NU se vede în ascendență, dar e adevărată: un pui provenit
 * dintr-o DMF nu poate fi niciodată Tip C. Declarația însăși numește tatăl și mama;
 * dacă există o DMF cu pui, părinții au măcar pedigree de tipicitate. Prin urmare
 * puii sunt cel puțin Tip B — chiar dacă registratura n-a apucat să scrie numerele de
 * înregistrare ale părinților. Fără `dinDeclaratie`, un dosar cu părinții completați
 * doar cu numele ieșea „Tip C": un certificat de tipicitate pentru un câine cu părinți
 * cunoscuți, adică exact actul care nu i se cuvine.
 *
 * @param ascendenta  pozițiile completate
 * @param optiuni.dinDeclaratie  true dacă certificatul se emite dintr-o DMF
 */
export function tipCertificat(ascendenta, optiuni = {}) {
  const pozitii = pozitiiAscendenta();
  const lipsa = [];
  for (const { cod } of pozitii) {
    const p = ascendenta?.[cod];
    if (!p || !taie(p.nume, 120) || !taie(p.nr, 60)) lipsa.push(cod);
  }
  let tip = lipsa.length === 0 ? "A" : lipsa.length === pozitii.length ? "C" : "B";
  if (tip === "C" && optiuni.dinDeclaratie) tip = "B";
  return { tip, lipsa };
}

/**
 * Codul public al unui proprietar (P-000115), în locul numelui.
 *
 * Pe fișa publică a câinelui, crescătorul apare cu numele și afixul — creșterea e o
 * activitate publică, asumată. Proprietarul unui câine de companie nu: el apare printr-un
 * cod stabil, care permite să vezi că mai multe exemplare au același stăpân, fără să
 * afli cine e. Aceeași alegere o face și baza World Dog Federation.
 */
async function codProprietar(nume, localitate) {
  const identitate = (taie(nume, 120) + "|" + taie(localitate, 120)).toLowerCase();
  if (!identitate.replace("|", "")) return null;
  const s = store();
  const cheie = "proprietar-cod/" + sha256(identitate);
  const existent = await s.get(cheie, { type: "json" }).catch(() => null);
  if (existent?.cod) return existent.cod;
  // Alocare ATOMICĂ a numărului (SEC-008): înainte, două prime-vizualizări simultane pentru
  // proprietari DIFERIȚI citeau același contor și ieșeau cu ACELAȘI cod P-. Rezervăm numărul
  // cu `onlyIfNew` (ca la `serieNoua`); cine pierde încearcă următorul. Formatul codului și
  // codurile deja emise rămân neatinse — marcajul de rezervare e o cheie internă nouă.
  for (let i = 0; i < 40; i++) {
    const c = await s.get("contor/proprietar", { type: "json" }).catch(() => null);
    const urm = (c?.ultim || 0) + 1;
    await s.setJSON("contor/proprietar", { ultim: urm });
    let alMeu = false;
    try {
      const r = await s.setJSON("cod-proprietar-luat/" + urm, { rezervat: new Date().toISOString() }, { onlyIfNew: true });
      alMeu = r?.modified !== false; // magazii vechi fără răspuns => tratăm ca reușită
    } catch (err) {
      console.error("Rezervarea codului de proprietar a eșuat:", urm, err);
    }
    if (!alMeu) continue;
    const cod = "P-" + String(urm).padStart(6, "0");
    await s.setJSON(cheie, { cod });
    return cod;
  }
  return null;
}

/** Cine cere. */
async function cine(cod) {
  if (actorDinCod(cod)?.rol === "admin") return { rol: "admin" };
  const r = await registratorDinCod(cod);
  if (r) return { rol: "registratura", registrator: r };
  const m = await membruDinCod(cod);
  if (m) return { rol: "membru", membru: m };
  // Chinotehnistul vede certificatele CUIBURILOR DEPUSE PRIN ASOCIAȚIA LUI — ca să le
  // poată tipări pentru crescători. Fără branșa asta, codul CHT- ar fi „cod greșit"
  // aici și ar fi numărat de limitator ca încercare de spargere.
  const k = await chinotehnistDinCod(cod);
  if (k) return { rol: "chinotehnist", chinotehnist: k };
  return null;
}

const potVerifica = (eu) => eu.rol === "registratura" || eu.rol === "admin";

/** Dosarul e „al meu" pentru crescătorul lui direct SAU pentru asociația prin care a fost depus. */
const dosarAlMeu = (d, eu) =>
  (eu.rol === "membru" && d && d.membruId === eu.membru.id) ||
  (eu.rol === "chinotehnist" && d && d.depunere?.asociatieSlug === eu.chinotehnist.asociatieSlug);

/** Motivul cel mai scurt acceptat la anulare. „Fals" nu e un motiv, e o etichetă. */
export const MOTIV_MINIM = 10;

/**
 * Schimbă valabilitatea unui certificat emis — regulile, fără magazie.
 *
 * Certificatul NU se șterge și NU se rescrie: actul există, e tipărit și e în mâna
 * cuiva. Se marchează, cu motiv, dată și autor, iar fiecare schimbare se adaugă la
 * istoric — inclusiv repunerile în vigoare. Cine caută mai târziu trebuie să vadă tot
 * drumul, nu doar ultima stare.
 *
 * @returns {{eroare: string} | {cert: object}}
 */
export function schimbaValabilitatea(cert, { anuleaza, motiv, deCatre, acum } = {}) {
  if (!cert) return { eroare: "Certificat inexistent." };
  const m = String(motiv == null ? "" : motiv).trim();
  if (m.length < MOTIV_MINIM)
    return { eroare: `Scrie motivul, pe scurt dar limpede (cel puțin ${MOTIV_MINIM} caractere).` };
  if (anuleaza && cert.anulat) return { eroare: "Certificatul e deja anulat." };
  if (!anuleaza && !cert.anulat) return { eroare: "Certificatul nu e anulat." };

  const la = acum || new Date().toISOString();
  const cine = String(deCatre || "").slice(0, 120) || "administrator";
  const istoric = Array.isArray(cert.anulariIstoric) ? [...cert.anulariIstoric] : [];
  istoric.push({ fapta: anuleaza ? "anulare" : "restabilire", motiv: m, la, deCatre: cine });

  return {
    cert: {
      ...cert,
      anulat: !!anuleaza,
      // Motivul rămâne în registru, dar NU se publică: verificarea publică spune doar
      // că actul e anulat. Motivul poate numi o persoană, iar o pagină deschisă de
      // oricine nu e locul unde se pun acuzații.
      anulare: anuleaza ? { motiv: m, la, deCatre: cine } : null,
      anulariIstoric: istoric,
    },
  };
}

/** Serie unică, cu același mecanism ca la declarații: marcaj înainte de returnare.
 *  Certificatul propriu-zis (`pedigree/<serie>`) se scrie mult mai târziu; între alocare
 *  și scriere, două emiteri simultane ar putea primi aceeași serie. De aceea REZERVĂM
 *  seria cu `serie-pedigree/<serie>` chiar acum — coliziunea se vede și se trece mai departe. */
async function serieNoua(an) {
  const s = store();
  for (let i = 0; i < 30; i++) {
    const c = await s.get("contor/pedigree-" + an, { type: "json" }).catch(() => null);
    const urm = (c?.ultim || 0) + 1;
    const serie = `CFCR-P-${an}-${String(urm).padStart(4, "0")}`;
    // Contorul se avansează oricum: dacă seria e luată, n-o mai încercăm.
    await s.setJSON("contor/pedigree-" + an, { ultim: urm });

    // Un certificat deja EMIS pe seria asta o ocupă la fel de bine ca o rezervare.
    const emis = await s.get("pedigree/" + serie, { type: "json" }).catch(() => null);
    if (emis) continue;

    // Rezervarea, cu `onlyIfNew`: verificarea și scrierea sunt aceeași faptă, deci
    // nu mai există fereastra în care două emiteri simultane văd amândouă „liber" și
    // ies cu aceeași serie de certificat. Cine pierde primește `modified:false`.
    let alMeu = false;
    try {
      const r = await s.setJSON("serie-pedigree/" + serie, { rezervat: new Date().toISOString() }, { onlyIfNew: true });
      alMeu = r?.modified !== false; // magazii vechi fără răspuns => tratăm ca reușită
    } catch (err) {
      console.error("Rezervarea seriei a eșuat:", serie, err);
    }
    if (alMeu) return serie;
  }
  return null;
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 24);

  // —— Verificarea publică a unui certificat (ținta codului QR) ——
  // Fără cod: oricine ține certificatul în mână trebuie să poată afla dacă e real.
  // Se arată doar identitatea câinelui și tipul certificatului — numele și adresele
  // proprietarului nu au ce căuta la o adresă publică.
  if (actiune === "verifica") {
    const serie = taie(body.serie, 40).toUpperCase();
    if (!segmentCheieValid(serie)) return json({ eroare: "Referință invalidă." }, 400);
    if (!serie) return json({ eroare: "Scrie seria certificatului." }, 400);
    const c = await store().get("pedigree/" + serie, { type: "json" }).catch(() => null);
    if (!c) return json({ eroare: "Nu există niciun certificat cu această serie." }, 404);
    return json({
      certificat: {
        serie: c.serie, tip: c.tip, emis: c.emis,
        caine: {
          nume: c.caine.nume, rasa: c.caine.rasa, varietate: c.caine.varietate,
          sex: c.caine.sex, dataNasterii: c.caine.dataNasterii,
          culoare: c.caine.culoare,
          // Mascat: cine ține certificatul în mână compară ultimele patru cifre și se
          // lămurește. Cine culege cipuri de la o adresă publică nu mai are ce culege.
          microcip: mascheazaCip(c.caine.microcip),
        },
        numarWDF: c.numarWDF, afixCrescator: c.crescator?.afix || null,
        anulat: !!c.anulat,
      },
    });
  }

  // —— Fișa publică a unui câine ——
  // Se caută după seria certificatului, numărul WDF individual sau microcip: numele se
  // repetă între canise, celelalte nu. Fără cod de acces — o carte de origini care nu
  // se poate consulta nu ajută pe nimeni.
  if (actiune === "caine") {
    const cautat = taie(body.cautat, 60).toUpperCase();
    if (!segmentCheieValid(cautat)) return json({ eroare: "Referință invalidă." }, 400);
    if (!cautat) return json({ eroare: "Scrie seria, numărul WDF sau microcipul." }, 400);
    const s0 = store();

    let cert = await s0.get("pedigree/" + cautat, { type: "json" }).catch(() => null);
    if (!cert) {
      const dupaCaine = await s0.get("pedigree-caine/" + cautat.replace(/[\s-]/g, ""), { type: "json" }).catch(() => null);
      if (dupaCaine?.serie) cert = await s0.get("pedigree/" + dupaCaine.serie, { type: "json" }).catch(() => null);
    }
    if (!cert) {
      const dupaWdf = await s0.get("pedigree-wdf/" + cautat, { type: "json" }).catch(() => null);
      if (dupaWdf?.serie) cert = await s0.get("pedigree/" + dupaWdf.serie, { type: "json" }).catch(() => null);
    }
    if (!cert)
      return json({
        eroare: "Niciun câine cu această referință în registrul CFC-Royal. " +
          "Dacă numărul aparține altui registru (COR, ROI, LOE, RKF…), exemplarul poate apărea " +
          "în ascendența câinilor noștri, dar fișa lui se ține la registrul care l-a emis.",
      }, 404);

    // Frații de cuib: ceilalți pui din aceeași declarație.
    const frati = [];
    try {
      const { blobs } = await s0.list({ prefix: "pedigree-cuib/" + cert.dmfId + "/" });
      for (const b of blobs) {
        const x = await s0.get(b.key, { type: "json" });
        if (x && x.serie !== cert.serie) frati.push(x);
      }
    } catch (err) { console.error("Listare frați eșuată:", err); }

    // Descendenții: declarațiile în care acest exemplar apare ca părinte. Legătura se
    // face pe MICROCIP, nu pe nume — numele se pot scrie în zece feluri, cipul nu.
    const descendenti = [];
    const cip = String(cert.caine.microcip || "").replace(/[\s-]/g, "");
    if (cip) {
      // Construiește o intrare de descendent dintr-o declarație (același format ca înainte).
      const dinDmf = async (d) => {
        const cipT = String(d.mascul?.microcip || "").replace(/[\s-]/g, "");
        const cipM = String(d.femela?.microcip || "").replace(/[\s-]/g, "");
        if (cipT !== cip && cipM !== cip) return null;
        const { blobs: ale } = await s0.list({ prefix: "pedigree-cuib/" + d.id + "/" });
        const pui = [];
        for (const x of ale) { const c2 = await s0.get(x.key, { type: "json" }); if (c2) pui.push(c2); }
        return {
          dmfSerie: d.serie, dataFatarii: d.dataFatarii, rasa: d.rasa,
          rol: cipT === cip ? "tată" : "mamă",
          celalaltParinte: cipT === cip ? d.femela?.nume : d.mascul?.nume,
          pui,
        };
      };
      try {
        // S1: căutarea descendenților NU mai scanează tot registrul la fiecare cerere
        // publică. Un index microcip->declarație (scris la crearea/importul declarației)
        // duce direct la cuiburile în care exemplarul e părinte. Prima cerere de după
        // publicare, când indexul nu e încă „gata", îl construiește o dată pentru toate
        // declarațiile existente și ridică steagul; de la a doua, merge pe calea rapidă.
        const gata = await s0.get("descendent-index-gata", { type: "json" }).catch(() => null);
        if (gata) {
          const pre = "descendent-cip/" + cip + "/";
          const { blobs } = await s0.list({ prefix: pre });
          for (const b of blobs) {
            const d = await s0.get("dmf/" + b.key.slice(pre.length), { type: "json" });
            if (!d) continue;
            const e = await dinDmf(d);
            if (e) descendenti.push(e);
          }
        } else {
          const { blobs } = await s0.list({ prefix: "dmf/" });
          for (const b of blobs) {
            const d = await s0.get(b.key, { type: "json" });
            if (!d) continue;
            for (const pc of [d.mascul?.microcip, d.femela?.microcip]) {
              const c = String(pc || "").replace(/[\s-]/g, "");
              if (c) await s0.setJSON("descendent-cip/" + c + "/" + d.id, { dmfId: d.id }).catch(() => {});
            }
            const e = await dinDmf(d);
            if (e) descendenti.push(e);
          }
          await s0.setJSON("descendent-index-gata", { creat: new Date().toISOString() }).catch(() => {});
        }
      } catch (err) { console.error("Căutare descendenți eșuată:", err); }
    }

    // Titlurile vin din Managerul de Expoziții, împinse pe microcip.
    let titluri = null;
    if (cip) {
      try { titluri = await getStore("expozitii").get("titluri/" + cip, { type: "json" }); }
      catch (err) { console.error("Citire titluri eșuată:", err); }
    }

    const codProp = await codProprietar(cert.proprietar?.nume, cert.proprietar?.localitate);
    return json({
      caine: {
        serie: cert.serie, tip: cert.tip, numarWDF: cert.numarWDFCaine || null,
        numarCuib: cert.numarWDF, dmfSerie: cert.dmfSerie,
        ...cert.caine,
        // …dar cipul iese mascat. Fișa e publică și fără poartă: întreg, el s-ar fi putut
        // culege pentru toți câinii din registru, iar cu un microcip se caută în bazele
        // veterinare și se revendică un exemplar. Ultimele patru cifre ajung ca stăpânul
        // să recunoască fișa propriului câine.
        microcip: mascheazaCip(cert.caine.microcip),
        crescator: cert.crescator,           // cu nume și afix: creșterea e publică
        proprietarCod: codProp,              // doar codul: deținerea nu e
        emis: cert.emis, anulat: !!cert.anulat,
      },
      ascendenta: cert.ascendenta || {},
      pozitii: pozitiiAscendenta().map((p) => ({ ...p, eticheta: etichetaPozitie(p.cod) })),
      frati, descendenti,
      titluri: titluri?.titluri || [],
      // Drumul spre Campion: progresul calculat de Manager la publicarea palmaresului.
      campionate: titluri?.campionate || [],
    });
  }

  const cod = taie(body.cod, 60);
  const eu = await cine(cod);
  if (!eu) return json({ eroare: "Cod incorect." }, 401);
  const s = store();

  // A doua cheie pentru registratură și administrator: aici se emit și se anulează acte.
  if (ROLURI_PROTEJATE.includes(eu.rol) &&
      !(await dispozitivCunoscut(s, taie(body.dispozitiv, 80), eu.rol))) {
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403);
  }

  // —— Reconstrucția indexului de descendenți (PERF-001) ——
  //
  // Indexul microcip->declarație se scrie INCREMENTAL la fiecare depunere de DMF și la
  // import, deci se ține singur la zi. Backfill-ul pentru declarațiile istorice (de
  // dinainte de index) se putea face doar din prima cerere PUBLICĂ de fișă — adică un
  // vizitator plătea o scanare a întregului registru. Acțiunea de aici mută acel cost pe
  // registratură/admin: se rulează o dată, ridică steagul, iar fișa publică merge de atunci
  // mereu pe calea rapidă. Fallback-ul public rămâne neatins, ca plasă de siguranță.
  if (actiune === "reindex-descendenti") {
    if (!potVerifica(eu)) return json({ eroare: "Nepermis." }, 403);
    let legaturi = 0;
    try {
      const { blobs } = await s.list({ prefix: "dmf/" });
      for (const b of blobs) {
        const d = await s.get(b.key, { type: "json" }).catch(() => null);
        if (!d) continue;
        for (const pc of [d.mascul?.microcip, d.femela?.microcip]) {
          const c = String(pc || "").replace(/[\s-]/g, "");
          if (c) { await s.setJSON("descendent-cip/" + c + "/" + d.id, { dmfId: d.id }).catch(() => {}); legaturi++; }
        }
      }
      await s.setJSON("descendent-index-gata", { creat: new Date().toISOString(), reindexatDe: eu.rol }).catch(() => {});
    } catch (err) {
      console.error("Reindexare descendenți eșuată:", err);
      return json({ eroare: "Nu am putut reconstrui indexul. Încearcă din nou." }, 500);
    }
    return json({ ok: true, legaturi });
  }

  // —— Anularea unui certificat emis ——
  //
  // Formularul de declarație și pagina registrului spun, amândouă, că declararea de date
  // false atrage anularea documentelor eliberate. Până acum era o promisiune fără
  // mecanism: steagul `anulat` se scria `false` la emitere și nu-l mai schimba nimic.
  //
  // Certificatul NU se șterge și NU se rescrie. Un act eliberat există: e tipărit, e în
  // mâna cuiva, poate fi arătat oricând. Se marchează anulat, cu motiv, dată și autor —
  // iar fișa publică și verificarea prin cod QR arată asta pe loc. Cine scanează codul
  // de pe hârtie trebuie să afle adevărul, nu să nu găsească nimic.
  //
  // Doar administratorul: e cea mai grea faptă din registru după ștergere.
  if (actiune === "certificat-anuleaza" || actiune === "certificat-restabileste") {
    if (eu.rol !== "admin")
      return json({ eroare: "Doar administratorul poate anula sau repune în vigoare un certificat." }, 403);
    const serie = taie(body.serie, 40).toUpperCase();
    if (!segmentCheieValid(serie)) return json({ eroare: "Referință invalidă." }, 400);
    const motiv = taie(body.motiv, 600);
    const c = await s.get("pedigree/" + serie, { type: "json" }).catch(() => null);
    if (!c) return json({ eroare: "Certificat inexistent." }, 404);

    const anuleaza = actiune === "certificat-anuleaza";
    const cine = eu.rol === "admin" ? "administrator" : (eu.registrator?.nume || "registratură");
    const rez = schimbaValabilitatea(c, { anuleaza, motiv, deCatre: cine });
    if (rez.eroare) return json({ eroare: rez.eroare }, rez.eroare.startsWith("Scrie") ? 400 : 409);

    // Urma se scrie ÎNAINTE. Un act care își schimbă valabilitatea fără să se știe cine
    // a hotărât și de ce nu e mai bun decât unul fals.
    try {
      await jurnalizeazaObligatoriu(s, {
        fapta: anuleaza ? "certificat-anulat" : "certificat-restabilit",
        actor: actorJurnal(eu),
        obiect: serie,
        detalii: `${c.caine?.nume || ""} (${c.caine?.rasa || ""}), crescător ${c.crescator?.nume || ""}` +
          `, emis ${String(c.emis || "").slice(0, 10)} — motiv: ${motiv}`,
        ip: ipCerere(req),
      });
    } catch (err) {
      console.error("Jurnalul nu a putut fi scris; certificatul a rămas neschimbat:", err);
      return json({ eroare: "Nu am putut consemna fapta în jurnal, deci nu am schimbat nimic. Reîncearcă." }, 503);
    }

    await s.setJSON("pedigree/" + serie, rez.cert);
    return json({ ok: true, serie, anulat: anuleaza });
  }

  // Starea unui certificat, pentru panoul de administrare: cât să poți hotărî în
  // cunoștință de cauză înainte de a anula, fără să încarci tot certificatul cu QR.
  if (actiune === "certificat-stare") {
    if (!potVerifica(eu)) return json({ eroare: "Nepermis." }, 403);
    const serie = taie(body.serie, 40).toUpperCase();
    if (!segmentCheieValid(serie)) return json({ eroare: "Referință invalidă." }, 400);
    const c = await s.get("pedigree/" + serie, { type: "json" }).catch(() => null);
    if (!c) return json({ eroare: "Nu există niciun certificat cu această serie." }, 404);
    return json({
      certificat: {
        serie: c.serie, tip: c.tip, emis: c.emis, emisDe: c.emisDe || "",
        numarWDF: c.numarWDF, numarWDFCaine: c.numarWDFCaine || null,
        caine: { nume: c.caine?.nume, rasa: c.caine?.rasa, microcip: c.caine?.microcip },
        crescator: c.crescator?.nume || "",
        anulat: !!c.anulat,
        anulare: c.anulare || null,
      },
    });
  }

  // —— Numărul WDF individual al câinelui ——
  // Nu se generează: îl atribuie World Dog Federation la înregistrarea cuibului în baza
  // internațională (forma WDF.RO150640L26). Registratura îl trece aici când îl primește.
  if (actiune === "wdf-caine") {
    if (!potVerifica(eu)) return json({ eroare: "Nepermis." }, 403);
    const serie = taie(body.serie, 40).toUpperCase();
    if (!segmentCheieValid(serie)) return json({ eroare: "Referință invalidă." }, 400);
    const numar = taie(body.numarWDFCaine, 40).toUpperCase();
    const c = await s.get("pedigree/" + serie, { type: "json" }).catch(() => null);
    if (!c) return json({ eroare: "Certificat inexistent." }, 404);
    if (numar) {
      const ocupat = await s.get("pedigree-wdf/" + numar, { type: "json" }).catch(() => null);
      if (ocupat && ocupat.serie !== serie)
        return json({ eroare: "Numărul e deja folosit la certificatul " + ocupat.serie + "." }, 409);
      await s.setJSON("pedigree-wdf/" + numar, { serie });
    }
    if (c.numarWDFCaine && c.numarWDFCaine !== numar)
      await s.delete("pedigree-wdf/" + c.numarWDFCaine).catch(() => {});
    await s.setJSON("pedigree/" + serie, { ...c, numarWDFCaine: numar || null });
    await jurnalizeaza(s, {
      fapta: "numar-wdf-caine",
      actor: actorJurnal(eu),
      obiect: serie,
      detalii: numar
        ? `${c.caine?.nume || ""} — număr WDF individual: ${numar}` +
          (c.numarWDFCaine && c.numarWDFCaine !== numar ? ` (era ${c.numarWDFCaine})` : "")
        : `${c.caine?.nume || ""} — număr WDF individual șters` +
          (c.numarWDFCaine ? ` (era ${c.numarWDFCaine})` : ""),
      ip: ipCerere(req),
    });
    return json({ ok: true, numarWDFCaine: numar || null });
  }

  // —— Dosarul pregătit pentru ascendență ——
  if (actiune === "ascendenta") {
    if (!potVerifica(eu)) return json({ eroare: "Nepermis." }, 403);
    const idAsc = taie(body.id, 40);
    if (!segmentCheieValid(idAsc)) return json({ eroare: "Referință invalidă." }, 400);
    const d = await s.get("dmf/" + idAsc, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);
    // Părinții se completează singuri din declarație: sunt deja acolo, cu pedigree și
    // microcip, iar recopiatul lor cu mâna e doar o ocazie de greșeală.
    const asc = Object.assign({}, d.ascendenta || {});
    if (!asc.T) asc.T = { nume: d.mascul.nume, nr: d.mascul.pedigree, titluri: "" };
    if (!asc.M) asc.M = { nume: d.femela.nume, nr: d.femela.pedigree, titluri: "" };
    return json({
      dosar: {
        id: d.id, serie: d.serie, rasa: d.rasa, varietate: d.varietate || "",
        dataFatarii: d.dataFatarii, numarWDF: d.numarWDF || null,
        pui: d.pui, afix: d.afix, nrAfix: d.nrAfix,
        membruNume: d.membruNume, confirmare: d.confirmare?.stare || "asteptare",
      },
      ascendenta: asc,
      pozitii: pozitiiAscendenta().map((p) => ({ ...p, eticheta: etichetaPozitie(p.cod) })),
      // Tot dintr-o declarație: panoul trebuie să arate același tip pe care îl va purta
      // certificatul emis, altfel registratura vede „Tip C" și primește „Tip B".
      tip: tipCertificat(asc, { dinDeclaratie: true }),
    });
  }

  if (actiune === "ascendenta-salveaza") {
    if (!potVerifica(eu)) return json({ eroare: "Nepermis." }, 403);
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);

    const primit = body.ascendenta || {};
    const asc = {};
    for (const { cod } of pozitiiAscendenta()) {
      const p = primit[cod] || {};
      const nume = taie(p.nume, 120);
      if (!nume) continue;                       // pozițiile goale nu se păstrează
      asc[cod] = { nume, nr: taie(p.nr, 60), titluri: taie(p.titluri, 120) };
    }
    const t = tipCertificat(asc, { dinDeclaratie: true });
    // Câte poziții s-au schimbat față de ce era în dosar — o ascendență rescrisă după
    // emitere e exact genul de lucru pentru care există jurnalul.
    const inainte = d.ascendenta || {};
    const schimbate = pozitiiAscendenta().filter(({ cod }) => {
      const a = inainte[cod], b = asc[cod];
      return JSON.stringify(a || null) !== JSON.stringify(b || null);
    }).map(({ cod }) => cod);

    await s.setJSON("dmf/" + id, { ...d, ascendenta: asc, stare: "verificat" });
    if (schimbate.length) {
      await jurnalizeaza(s, {
        fapta: "ascendenta-modificata",
        actor: actorJurnal(eu),
        obiect: d.serie,
        detalii: `${Object.keys(asc).length}/30 poziții completate, tip ${t.tip}; ` +
          `modificate: ${schimbate.slice(0, 12).join(", ")}${schimbate.length > 12 ? " ș.a." : ""}` +
          (d.stare === "emis" ? " — DOSAR CU CERTIFICATE DEJA EMISE" : ""),
        ip: ipCerere(req),
      });
    }
    return json({ ok: true, tip: t.tip, lipsa: t.lipsa, completate: Object.keys(asc).length });
  }

  // —— Numărul de cuib WDF ——
  // Se dă o singură dată și nu se mai schimbă: e cheia sub care cuibul intră în baza
  // World Dog Federation.
  if (actiune === "numar-wdf") {
    if (!potVerifica(eu)) return json({ eroare: "Nepermis." }, 403);
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);
    if (d.numarWDF) return json({ ok: true, numarWDF: d.numarWDF, deja: true });

    // Rezervare cu marcaj (ca la serii): două verificări simultane nu mai pot da același
    // număr WDF pe două cuiburi. `wdf/<numar>` se scrie înainte, coliziunea se vede.
    let numarWDF = null;
    for (let i = 0; i < 30; i++) {
      const c = await s.get("contor/wdf", { type: "json" }).catch(() => null);
      const urm = Math.max(c?.ultim || 0, WDF_ULTIMUL_PE_HARTIE) + 1;
      const cand = "WDF-" + String(urm).padStart(4, "0");
      // Contorul se avansează oricum: dacă numărul e luat, nu-l mai încercăm.
      await s.setJSON("contor/wdf", { ultim: urm });

      // Rezervarea cu `onlyIfNew`: verificarea și scrierea sunt aceeași faptă, deci două
      // atribuiri simultane nu mai pot ieși cu ACELAȘI număr WDF pe două cuiburi. Cine
      // pierde primește `modified:false` și încearcă următorul candidat. Același mecanism
      // atomic ca la `serieNoua` — înainte, scrierea era necondiționată și coliziunea NU
      // se vedea, deși comentariul pretindea că da (SEC-002).
      let alMeu = false;
      try {
        const r = await s.setJSON("wdf/" + cand, { serie: d.serie, rezervat: new Date().toISOString() }, { onlyIfNew: true });
        alMeu = r?.modified !== false; // magazii vechi fără răspuns => tratăm ca reușită
      } catch (err) {
        console.error("Rezervarea numărului WDF a eșuat:", cand, err);
      }
      if (alMeu) { numarWDF = cand; break; }
    }
    if (!numarWDF) return json({ eroare: "Nu am putut aloca un număr WDF unic. Reîncearcă." }, 500);
    await s.setJSON("dmf/" + id, { ...d, numarWDF });
    await jurnalizeaza(s, {
      fapta: "numar-wdf",
      actor: actorJurnal(eu),
      obiect: d.serie,
      detalii: `Cuib înregistrat cu numărul ${numarWDF} (${d.rasa}, crescător ${d.membruNume})`,
      ip: ipCerere(req),
    });
    return json({ ok: true, numarWDF });
  }

  // —— Emiterea certificatelor ——
  if (actiune === "emite") {
    if (!potVerifica(eu)) return json({ eroare: "Nepermis." }, 403);
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);
    if (!d.numarWDF) return json({ eroare: "Atribuie întâi numărul de cuib WDF." }, 400);
    if (!d.ascendenta || !d.ascendenta.T || !d.ascendenta.M)
      return json({ eroare: "Completează întâi ascendența (cel puțin părinții)." }, 400);

    // Certificatele de aici ies dintr-o declarație de montă și fătare: părinții sunt
    // numiți în ea, deci tipicitatea (Tip C) e exclusă din capul locului.
    const t = tipCertificat(d.ascendenta, { dinDeclaratie: true });
    const an = new Date().getFullYear();
    const cerute = Array.isArray(body.pui) ? body.pui : [];
    if (!cerute.length) return json({ eroare: "Alege cel puțin un pui." }, 400);

    const emise = [];
    for (const cerere of cerute) {
      const i = Number(cerere?.index);
      const pui = d.pui?.[i];
      if (!pui) continue;
      // Un pui nu primește două certificate: dacă există deja, îl returnăm pe acela.
      const existent = await s.get("pedigree-cuib/" + id + "/" + i, { type: "json" }).catch(() => null);
      if (existent?.serie) { emise.push({ index: i, serie: existent.serie, deja: true }); continue; }

      const serie = await serieNoua(an);
      if (!serie) return json({ eroare: "Nu am putut aloca o serie. Reîncearcă." }, 500);
      // Cipul se NORMALIZEAZĂ (fără spații/cratime), ca la importul istoric și ca la
      // căutare — altfel un cip scris „941 000..." făcea câinele negăsibil după microcip
      // și rupea legătura părinte→fișă din /cuiburi/ și steaua din registrul public.
      const microcip = taie(pui.identificare, 30).replace(/[\s-]/g, "");
      const cert = {
        serie, tip: t.tip, lipsaAscendenta: t.lipsa,
        dmfId: id, dmfSerie: d.serie, numarWDF: d.numarWDF, puiIndex: i,
        caine: {
          nume: pui.nume, rasa: d.rasa, varietate: pui.varietate || d.varietate || "",
          sex: pui.sex, dataNasterii: d.dataFatarii,
          culoare: pui.culoare || "", tipPar: pui.tipPar || "", microcip,
        },
        crescator: {
          nume: d.membruNume, afix: d.afix || "", nrAfix: d.nrAfix || "",
        },
        // Proprietarul poate lipsi la emitere (pui nevândut): certificatul se emite pe
        // crescător, iar transferul se operează ulterior.
        proprietar: {
          nume: taie(cerere?.proprietar?.nume, 120) || taie(pui.cumparator?.nume, 120) || d.membruNume,
          adresa: taie(cerere?.proprietar?.adresa, 200) || taie(pui.cumparator?.adresa, 200),
          localitate: taie(cerere?.proprietar?.localitate, 120) || taie(pui.cumparator?.localitate, 120),
          judet: taie(cerere?.proprietar?.judet, 60) || taie(pui.cumparator?.judet, 60),
          tara: taie(cerere?.proprietar?.tara, 60) || taie(pui.cumparator?.tara, 60) || "România",
        },
        // Ascendența se ÎNGHEAȚĂ în certificat. Dacă dosarul se corectează mai târziu,
        // certificatul deja emis rămâne ce a fost tipărit și înmânat omului.
        ascendenta: d.ascendenta,
        emis: new Date().toISOString(),
        emisDe: eu.rol === "admin" ? "administrator" : (eu.registrator?.nume || "registratură"),
        anulat: false,
      };
      await s.setJSON("pedigree/" + serie, cert);
      await s.setJSON("pedigree-cuib/" + id + "/" + i, { serie, nume: pui.nume, tip: t.tip });
      if (microcip && segmentCheieValid(microcip)) await s.setJSON("pedigree-caine/" + microcip, { serie });
      emise.push({ index: i, serie, tip: t.tip });
    }
    await s.setJSON("dmf/" + id, { ...(await s.get("dmf/" + id, { type: "json" })), stare: "emis" });
    const noi = emise.filter((x) => !x.deja);
    if (noi.length) {
      await jurnalizeaza(s, {
        fapta: "certificat-emis",
        actor: actorJurnal(eu),
        obiect: d.serie,
        detalii: `${noi.length} certificat(e) Tip ${t.tip}, cuib ${d.numarWDF}, crescător ${d.membruNume}: ` +
          noi.map((x) => x.serie).join(", "),
        ip: ipCerere(req),
      });
    }
    return json({ ok: true, tip: t.tip, lipsa: t.lipsa, emise });
  }

  // —— Certificatul complet (pentru tipărire) ——
  if (actiune === "certificat") {
    const serie = taie(body.serie, 40).toUpperCase();
    if (!segmentCheieValid(serie)) return json({ eroare: "Referință invalidă." }, 400);
    const c = await s.get("pedigree/" + serie, { type: "json" }).catch(() => null);
    if (!c) return json({ eroare: "Certificat inexistent." }, 404);
    if (!potVerifica(eu)) {
      // Crescătorul (sau asociația prin care s-a depus) își vede propriile certificate.
      const d = await s.get("dmf/" + c.dmfId, { type: "json" }).catch(() => null);
      if (!dosarAlMeu(d, eu)) return json({ eroare: "Nepermis." }, 403);
    }
    // Codul QR se face pe server: pagina de tipărire rămâne fără dependențe, iar
    // imaginea e gata înainte ca omul să apese Ctrl+P. Modulul `qrcode` se încarcă
    // LENEȘ, doar pe această acțiune — restul multiplexorului nu-l plătește la cold-start.
    const adresaVerificare = "https://cfc-royal.ro/verifica-pedigree/?s=" + encodeURIComponent(serie);
    let qr = null;
    try {
      const { default: QRCode } = await import("qrcode");
      qr = await QRCode.toDataURL(adresaVerificare, { margin: 0, width: 320, errorCorrectionLevel: "M" });
    } catch (err) { console.error("Generarea codului QR a eșuat:", err); }

    return json({
      certificat: c,
      pozitii: pozitiiAscendenta().map((p) => ({ ...p, eticheta: etichetaPozitie(p.cod) })),
      qr, adresaVerificare,
    });
  }

  // —— Certificatele unui cuib ——
  if (actiune === "certificate-cuib") {
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);
    if (!potVerifica(eu)) {
      if (!dosarAlMeu(d, eu)) return json({ eroare: "Nepermis." }, 403);
    }
    const lista = [];
    try {
      const { blobs } = await s.list({ prefix: "pedigree-cuib/" + id + "/" });
      for (const b of blobs) {
        const x = await s.get(b.key, { type: "json" });
        if (!x) continue;
        // Numărul WDF individual se citește din certificat, nu din rezumat: rezumatul e
        // scris la emitere, iar numărul vine de la World Dog Federation mai târziu.
        const c = await s.get("pedigree/" + x.serie, { type: "json" }).catch(() => null);
        lista.push({ ...x, index: Number(b.key.split("/").pop()), numarWDFCaine: c?.numarWDFCaine || "" });
      }
    } catch (err) { console.error("Listare certificate eșuată:", err); }
    lista.sort((a, b) => a.index - b.index);
    return json({ certificate: lista, numarWDF: d.numarWDF || null });
  }

  // —— Extrasul din Cartea de Origine ——
  //
  // Ca extrasul de cont de la bancă: întreaga carte sau doar cuiburile dintre două
  // numere. Îl pot cere DOAR administratorul și registratorul cu dreptul de a genera
  // coduri; ceilalți registratori primesc refuz — extrasul scoate evidența din casă.
  if (actiune === "extras-carte") {
    if (!poateCereExtras(eu))
      return json({ eroare: "Extrasul îl pot cere doar administratorul și registratorul desemnat." }, 403);
    const iv = intervalulCerut(body.deLa, body.panaLa);
    if (iv.eroare) return json({ eroare: iv.eroare }, 400);

    // Toate dosarele cu număr de cuib — ele SUNT Cartea de Origine. Ciornele și
    // dosarele încă nefinalizate nu au număr, deci nu apar: extrasul redă registrul,
    // nu coada de lucru.
    let chei = [];
    try { chei = (await s.list({ prefix: "dmf/" })).blobs.map((b) => b.key); }
    catch (err) { console.error("registru-pedigree:", err); return json({ eroare: "Nu am putut citi registrul. Încearcă din nou." }, 500); }

    const dosare = (await inValuri(chei, 12, async (k) => {
      const d = await s.get(k, { type: "json" }).catch(() => null);
      const nr = numarDinText(d?.numarWDF);
      return d && nr != null && inInterval(nr, iv.deLa, iv.panaLa) ? { d, nr, id: k.slice(4) } : null;
    })).filter(Boolean).sort((a, b) => a.nr - b.nr);

    const cuiburi = await inValuri(dosare, 8, async ({ d, nr, id }) => {
      // Seriile certificatelor emise, pe pui: cine are act și cine nu se vede în extras.
      const acte = new Map();
      try {
        const { blobs } = await s.list({ prefix: "pedigree-cuib/" + id + "/" });
        for (const b of blobs) {
          const x = await s.get(b.key, { type: "json" }).catch(() => null);
          if (x?.serie) acte.set(Number(b.key.split("/").pop()), x);
        }
      } catch (err) { console.error("Listare certificate la extras eșuată:", err); }
      return {
        nr, numarWDF: d.numarWDF, dmfSerie: d.serie || "",
        rasa: d.rasa || "", varietate: d.varietate || "", dataFatarii: d.dataFatarii || "",
        tata: { nume: d.mascul?.nume || "", pedigree: d.mascul?.pedigree || "" },
        mama: { nume: d.femela?.nume || "", pedigree: d.femela?.pedigree || "" },
        crescator: { nume: d.membruNume || "", afix: d.afix || "", nrAfix: d.nrAfix || "" },
        pui: (d.pui || []).map((p, i) => ({
          nume: p?.nume || "", sex: p?.sex || "", culoare: p?.culoare || "",
          serie: acte.get(i)?.serie || null, tip: acte.get(i)?.tip || null,
        })),
      };
    });

    await jurnalizeaza(s, {
      fapta: "extras-carte",
      actor: actorJurnal(eu),
      obiect: iv.deLa == null && iv.panaLa == null
        ? "întreaga Carte de Origine"
        : `cuiburile ${iv.deLa ?? "început"}–${iv.panaLa ?? "sfârșit"}`,
      detalii: `${cuiburi.length} cuiburi în extras`,
      ip: ipCerere(req),
    });
    return json({
      cuiburi, interval: { deLa: iv.deLa, panaLa: iv.panaLa },
      generat: new Date().toISOString(),
      deCatre: eu.rol === "admin" ? "administrator" : (eu.registrator?.nume || "registratură"),
    });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
