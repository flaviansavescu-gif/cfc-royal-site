// inscriere-expo.mjs — puntea de înscriere online între cfc-royal.ro și CFCR Expo Manager.
// Publicul trimite înscrieri; ele se strâng într-o coadă (Netlify Blobs) și sunt importate
// ulterior în managerul local de pe laptop. Regulile WDF (clasă vs. vârstă) sunt impuse aici.
//
// GET                                  -> { expozitii: [...deschise cu rase] }
// POST { showId, ...caine, ...proprietar, clasa }  -> înscriere publică (validată, în coadă, email)
// POST { secret, actiune:"config", config }        -> managerul publică/actualizează o expoziție
// POST { secret, actiune:"inchide", showId }        -> închide înscrierile online
// POST { secret, actiune:"coada", showId }          -> managerul trage înscrierile neimportate
// POST { secret, actiune:"marcheaza", showId, ids } -> managerul marchează înscrierile ca importate
import { getStore } from "@netlify/blobs";
import { eRobot, limiteazaTrimiterile, minuteText } from "./_comun/formular-public.mjs";
import { escapeHtml, trimite } from "./_comun/posta.mjs";
import { refuzaDacaInchis } from "./_comun/poarta-scrieri.mjs";
import { calculeazaTaxa, taxaVeche } from "./_comun/taxa-expo.mjs";
import { egal } from "./_comun/citire-documente.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";
import { versiuneaNormelor } from "./_comun/norme-participare.mjs";
// MODUL REPETIȚIE. Lanțul înscriere → verificare → import → catalog → ring → rezultate
// n-a trecut niciodată printr-o expoziție adevărată. Repetiția generală îl trece, cu date
// născocite care nu au ce căuta sub ochii publicului. O expoziție marcată ca repetiție
// merge ÎNTRU TOTUL ca una adevărată — doar că nu apare public. Regulile stau în modulul
// lor, ca să poată fi probate pe fapte, nu citite cu ochii.
import {
  eRepetitie, poateSterge, poateMarca, prefixeleExpozitiei, cheileExpozitiei,
  seVedeInFormular, seVedeInCalendar,
} from "./_comun/repetitie.mjs";
import { createHash } from "node:crypto";
import { json } from "./_comun/raspuns.mjs";

const SECRET = process.env.EXPO_SYNC_SECRET || "";

// Cât poate trimite o adresă IP într-o oră. Generos deliberat: o familie cu patru câini
// trebuie să-i poată înscrie pe toți, iar o canisă mare poate veni cu opt. Peste
// doisprezece într-o oră, de la aceeași adresă, nu mai e o canisă — e un robot.
const MAX_INSCRIERI_PE_ORA = 12;

// Câți câini pot fi înscriși pe un singur formular (lot). Cât limita orară: o canisă mare
// îi trece pe toți dintr-o dată, dar un număr mai mare de-atât nu mai e o înscriere reală.
const MAX_CAINI_PE_LOT = 12;

// Clasele WDF și intervalele de vârstă (luni la data expoziției). Trebuie ținute în acord
// cu lib/domeniu.ts din manager.
const VARSTA = {
  baby: { min: 3, max: 6 },
  puppy: { min: 6, max: 9 },
  very_young: { min: 9, max: 12 },
  young: { min: 12, max: 18 },
  intermediara: { min: 15, max: 24 },
  deschisa: { min: 18, max: null },
  working: { min: 18, max: null },
  // Winner cere câine ADULT (18 luni) — regulamentul „Clasa Winner" + managerul spun la
  // fel; aici scria 15 și formularul primea câini pe care importul îi refuza apoi.
  winner: { min: 18, max: null },
  champion: { min: 15, max: null },
  foreign_champion: { min: 15, max: null },
  veterani: { min: 120, max: null },
};

function varstaInLuni(nastere, laData) {
  const d1 = new Date(nastere), d2 = new Date(laData);
  let luni = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (d2.getDate() < d1.getDate()) luni -= 1;
  return luni;
}

export function clasaValida(clasa, nastere, dataShow) {
  const r = VARSTA[clasa];
  if (!r) return false;

  // Datele se verifică ÎNAINTE de a socoti vârsta, și se verifică amândouă capcanele:
  //
  //   1. Dată necitibilă („candva", câmp gol) → `NaN`. Iar `NaN < min` și `NaN >= max`
  //      sunt AMÂNDOUĂ false, deci vechea funcție răspundea „clasa e bună" pentru ORICE
  //      clasă — un câine cu data stricată intra la Champion sau la Veterani.
  //   2. `null`/`undefined` → `new Date(null)` NU e invalidă, e 1 ianuarie 1970. Un câmp
  //      gol devenea astfel un câine de peste cincizeci de ani: perfect „valid" la
  //      Veterani (min. 120 de luni).
  //
  // `?? NaN` acoperă al doilea caz, `isNaN` pe primul. Fără dată bună nu se poate spune
  // nimic despre clasă, deci răspunsul corect e refuzul.
  const d1 = new Date(nastere ?? NaN);
  const d2 = new Date(dataShow ?? NaN);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;

  const luni = varstaInLuni(d1, d2);
  if (!Number.isFinite(luni)) return false;
  if (luni < r.min) return false;
  if (r.max !== null && luni >= r.max) return false;
  return true;
}

/**
 * S-au închis înscrierile?
 *
 * Termenul e un MOMENT, nu o zi. Organizatorul anunță „ultima înscriere: 31 august, ora
 * 21:00" — iar la 21:01 formularul trebuie să spună că s-a închis, nu să mai primească.
 *
 * Aici a fost o greșeală care merită scrisă, ca să nu se întoarcă: se făcea
 * `limita.setHours(23, 59, 59, 999)`, adică ora anunțată era aruncată și se închidea la
 * sfârșitul zilei. Mai rău, `setHours` lucrează în fusul MAȘINII, iar funcțiile merg pe
 * UTC: „sfârșitul zilei de 31 august" cădea pe 1 septembrie, ora 3 dimineața la Iași.
 * Aproape șase ore de înscrieri primite după ce omul citise pe site că s-a închis.
 *
 * Comparăm două momente. Un moment nu are fus orar — deci nu contează pe ce ceas merge
 * serverul, iar ora trecută în manager e chiar ora care se aplică.
 */
export function inchisPentruInscrieri(config) {
  if (!config || !config.deschis) return true;
  const limita = new Date(config.termen);
  if (isNaN(limita.getTime())) return false;   // termen ilizibil: nu închidem din greșeală
  return Date.now() > limita.getTime();
}

/**
 * S-a închis PRIN TRECEREA TERMENULUI — nu prin retragerea din manager.
 *
 * Deosebirea contează pentru ce vede omul. O expoziție retrasă din manager n-are ce
 * căuta pe site: nu s-a anunțat niciodată. Una căreia i-a trecut termenul s-a anunțat,
 * lumea a văzut-o, poate a și pus-o în calendar — dacă dispare peste noapte, vizitatorul
 * crede că a greșit adresa. Rămâne la vedere, scrisă ca închisă.
 */
export function inchisPrinTermen(config) {
  if (!config || !config.deschis) return false;   // retrasă din manager: alt caz, nu se arată deloc
  const limita = new Date(config.termen);
  if (isNaN(limita.getTime())) return false;      // termen ilizibil: nu o declarăm închisă
  return Date.now() > limita.getTime();
}

/**
 * Cât timp mai stă la vedere o expoziție închisă: până a doua zi după ea.
 *
 * Nu la nesfârșit — un formular cu zece expoziții trecute nu ajută pe nimeni. Nici doar
 * până în ziua expoziției: cine caută în dimineața aceea locul și ora trebuie să le
 * găsească acolo unde s-a uitat de fiecare dată.
 */
export function seMaiArataInchisa(config, acum = Date.now()) {
  if (!config || !config.data) return false;
  const zi = new Date(config.data);
  if (isNaN(zi.getTime())) return false;
  return acum <= zi.getTime() + 24 * 3600 * 1000;
}

/** Cererea vrea să vadă și repetițiile? `?repetitie=1`. */
function vedeRepetitiile(req) {
  try { return new URL(req.url).searchParams.get("repetitie") === "1"; }
  catch { return false; }
}

/** Câți câini a mai înscris adresa asta la expoziția asta.
 *  Un contor propriu, nu o numărătoare peste toată coada: la o expoziție cu două
 *  sute de înscrieri, fiecare trimitere ar citi două sute de fișe ca să afle un
 *  singur număr. Citirea e „strong" fiindcă de ea depinde o sumă de bani. */
const cheieProprietar = (showId, email) =>
  "proprietar/" + showId + "/" + createHash("sha256").update(email).digest("hex").slice(0, 32);

export default async (req) => {
  // Consistență tare: contorul de câini pe proprietar decide cât plătește omul.
  // Cu citire eventuală, al doilea câine trimis la un minut după primul putea să
  // apară tot ca „primul" și să fie taxat dublu.
  const store = getStore({ name: "expozitii", consistency: "strong" });

  // ——— Public: calendarul competițional (?calendar=1) ———
  // Viitoare = publicate și deschise pentru înscrieri; trecute = DOAR cele cu rezultate
  // publicate (astfel edițiile șterse/de test nu apar niciodată public).
  if (req.method === "GET" && new URL(req.url).searchParams.get("calendar")) {
    const intrari = new Map();
    try {
      const { blobs } = await store.list({ prefix: "config/" });
      for (const b of blobs) {
        const c = await store.get(b.key, { type: "json" }).catch(() => null);
        // Calendarul e pagina publică a asociației. Repetițiile nu apar niciodată acolo,
        // nici măcar cu `?repetitie=1`: acolo se uită lumea, nu noi.
        if (c && !seVedeInCalendar(c)) continue;
        if (c && !inchisPentruInscrieri(c)) {
          intrari.set(c.showId, { showId: c.showId, nume: c.nume, data: c.data, locatie: c.locatie, termen: c.termen, stare: "inscrieri" });
        }
      }
      const rez = await store.list({ prefix: "rezultate/" });
      for (const b of rez.blobs) {
        const r = await store.get(b.key, { type: "json" }).catch(() => null);
        const showId = b.key.slice("rezultate/".length);
        if (r) intrari.set(showId, { showId, nume: r.nume, data: r.data, locatie: "", stare: "rezultate" });
      }
    } catch (err) {
      console.error("Calendar eșuat:", err);
    }
    const calendar = [...intrari.values()].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    return json({ calendar });
  }

  // ——— Public: lista expozițiilor deschise ———
  if (req.method === "GET") {
    const expozitii = [];
    const cuRepetitii = vedeRepetitiile(req);
    try {
      const { blobs } = await store.list({ prefix: "config/" });
      for (const b of blobs) {
        const c = await store.get(b.key, { type: "json" });
        if (c && !seVedeInFormular(c, cuRepetitii)) continue;
        // Închisă prin termen: rămâne în listă, însemnată, până a doua zi după expoziție.
        const inchisa = inchisPrinTermen(c);
        if (c && (!inchisPentruInscrieri(c) || (inchisa && seMaiArataInchisa(c)))) {
          expozitii.push({
            showId: c.showId, nume: c.nume, data: c.data, termen: c.termen, locatie: c.locatie,
            arbitri: c.arbitri || [],
            inchis: inchisa || undefined,
            repetitie: eRepetitie(c) || undefined,
            rase: c.rase || [],
            // Asociația care organizează și încasează taxele. CFC-Royal e club federal:
            // multe expoziții le fac asociațiile afiliate, iar banii merg la ele. Contul
            // vine de la manager, nu e scris în pagina de formular — altfel n-ar putea
            // fi altul de la o expoziție la alta.
            organizator: c.organizator || null,
            // `tarif` = grila nouă (membru/nemembru × primul/următorii). `taxe` = calea
            // veche, pe clase; expozițiile publicate înainte de schimbare o păstrează.
            tarif: c.tarif || null,
            taxe: c.taxe || null,
          });
        }
      }
    } catch (err) {
      console.error("Listare expoziții eșuată:", err);
    }
    expozitii.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
    return json({ expozitii });
  }

  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ eroare: "Cerere invalidă." }, 400);
  }

  // ——— Manager (protejat cu secret) ———
  if (body.secret) {
    // În timp constant, ca la jetoane: comparația obișnuită se oprește la primul octet
    // diferit, iar diferența de timp spune cât din secret a fost ghicit.
    if (!SECRET || !egal(String(body.secret), SECRET)) return json({ eroare: "Secret invalid." }, 401);

    if (body.actiune === "config") {
      const c = body.config || {};
      if (!c.showId) return json({ eroare: "showId lipsă." }, 400);
      // Arbitrii invitați (derivați de Manager din ringurile expoziției; la republicare
      // se împrospătează). Igienizați aici, fiindcă ajung pe pagina publică.
      const arbitri = Array.isArray(c.arbitri)
        ? c.arbitri.slice(0, 20).map((a) => String(a || "").trim().slice(0, 120)).filter(Boolean)
        : [];
      await store.setJSON("config/" + c.showId, { ...c, arbitri, deschis: true });
      return json({ ok: true });
    }
    if (body.actiune === "inchide") {
      const c = await store.get("config/" + body.showId, { type: "json" });
      if (c) await store.setJSON("config/" + body.showId, { ...c, deschis: false });
      return json({ ok: true });
    }
    if (body.actiune === "coada") {
      const inscrieri = [];
      try {
        const { blobs } = await store.list({ prefix: "coada/" + body.showId + "/" });
        for (const b of blobs) {
          const i = await store.get(b.key, { type: "json" });
          if (i && !i.importat) inscrieri.push({ ...i, key: b.key });
        }
      } catch (err) {
        console.error("Citire coadă eșuată:", err);
      }
      return json({ inscrieri });
    }
    if (body.actiune === "verificari") {
      // Verificările registraturii, pentru TOATE înscrierile expoziției — inclusiv cele
      // deja importate. „coada" le ascunde pe cele importate, ca să nu intre de două ori;
      // aici avem nevoie tocmai de ele, fiindcă registratura se poate uita peste o
      // înscriere și după ce ea a ajuns în manager.
      // Se trimit TOATE înscrierile, inclusiv cele fără marcaj: altfel un marcaj
      // șters de registratură ar rămâne pe veci în manager, iar un „de lămurit"
      // retras ar continua să apară roșu.
      const verificari = [];
      try {
        const { blobs } = await store.list({ prefix: "coada/" + body.showId + "/" });
        for (const b of blobs) {
          const cheieV = "verificare/" + b.key.slice("coada/".length);
          const v = await store.get(cheieV, { type: "json" }).catch(() => null);
          verificari.push({ cheie: b.key, verificare: v || null });
        }
      } catch (err) {
        console.error("Citirea verificărilor a eșuat:", err);
      }
      return json({ verificari });
    }
    if (body.actiune === "marcheaza") {
      const dovezi = new Set();
      let showIdLot = "";
      for (const key of body.chei || []) {
        // Marcarea are treabă NUMAI cu înscrierile din coadă. Fără îngrădire, cheile din
        // cerere ar fi o unealtă de scris peste orice din magazie — configurații, stări —
        // pentru oricine ar pune vreodată mâna pe secret. Un drept cât treaba, nu mai mult.
        if (typeof key !== "string" || !key.startsWith("coada/")) continue;
        try {
          const i = await store.get(key, { type: "json" });
          if (i) {
            await store.setJSON(key, { ...i, importat: true });
            if (i.dovadaKey) { dovezi.add(i.dovadaKey); if (!showIdLot) showIdLot = i.showId || key.split("/")[1]; }
          }
        } catch (err) {
          console.error("Marcare eșuată:", err);
        }
      }
      // Dovada plății e o dată personală: odată importată, copia din cloud nu mai are rost.
      // DAR o dovadă poate fi comună mai multor câini dintr-un lot — o ștergem abia când
      // toți câinii care o folosesc au fost importați, altfel registratura ar rămâne fără
      // ea pentru restul lotului.
      if (dovezi.size && showIdLot) {
        let inca = new Set();
        try {
          const { blobs } = await store.list({ prefix: "coada/" + showIdLot + "/" });
          for (const b of blobs) {
            const i = await store.get(b.key, { type: "json" }).catch(() => null);
            if (i && i.importat !== true && i.dovadaKey) inca.add(i.dovadaKey);
          }
        } catch (err) {
          console.error("Verificarea dovezilor de lot a eșuat:", err);
          inca = dovezi; // la eroare, nu ștergem nimic (mai bine o dovadă rămasă decât una pierdută)
        }
        for (const dk of dovezi) if (!inca.has(dk)) await store.delete(dk).catch(() => {});
      }
      return json({ ok: true });
    }

    // ——— Gospodărirea magaziei: ce există și ce se poate arunca ———
    //
    // Formularul și registratura NU șterg nimic; dar probele tehnice și expozițiile
    // de încercare din perioada construcției rămân altfel pe veci în magazie și apar
    // în meniurile registraturii. Cele două acțiuni de mai jos sunt unelte de curățenie
    // pentru administrator (cer secretul managerului): una VEDE, cealaltă ȘTERGE doar
    // cheile primite explicit, și numai din prefixele care țin de circuitul înscrierii.
    // Rezultatele publicate (rezultate/) nu pot fi atinse de aici: au cod public REZ-…
    // și propria cale de anulare, cu urmă.
    if (body.actiune === "inventar") {
      const inventar = {};
      for (const prefix of ["config/", "coada/", "verificare/", "dovada/", "proprietar/"]) {
        const { blobs } = await store.list({ prefix });
        inventar[prefix] = blobs.map((b) => b.key);
      }
      return json({ inventar });
    }
    if (body.actiune === "sterge") {
      const ingaduite = ["config/", "coada/", "verificare/", "dovada/", "proprietar/"];
      let sterse = 0;
      const refuzate = [];
      for (const key of body.chei || []) {
        if (typeof key !== "string" || !ingaduite.some((p) => key.startsWith(p))) {
          refuzate.push(String(key).slice(0, 80));
          continue;
        }
        await store.delete(key).catch(() => {});
        sterse++;
      }
      return json({ ok: true, sterse, refuzate });
    }
    if (body.actiune === "dovada") {
      // Managerul trage dovada plății atașată unei înscrieri din coadă.
      const cheie = String(body.cheie || "");
      if (!cheie.startsWith("dovada/")) return json({ eroare: "Cheie invalidă." }, 400);
      const r = await store.getWithMetadata(cheie, { type: "arrayBuffer" }).catch(() => null);
      if (!r || !r.data) return json({ eroare: "Dovada nu există (probabil deja importată)." }, 404);
      return json({
        base64: Buffer.from(r.data).toString("base64"),
        tip: r.metadata?.tip || "application/octet-stream",
        nume: r.metadata?.nume || "dovada",
      });
    }
    // ——— Repetiția generală ———
    if (body.actiune === "repetitie") {
      const showId = String(body.showId || "");
      const pornit = body.pornit !== false;
      const c = await store.get("config/" + showId, { type: "json" });

      // Câte înscrieri are deja. Dacă listarea cade, socotim că are — mai bine refuzăm
      // o marcare bună decât s-o îngăduim pe cea care duce la ștergerea unei expoziții
      // adevărate.
      let cate = 0;
      if (pornit) {
        try {
          const { blobs } = await store.list({ prefix: "coada/" + showId + "/" });
          cate = blobs.length;
        } catch (err) {
          console.error("Nu am putut număra înscrierile înainte de marcare:", err);
          cate = 1;
        }
      }

      const verdict = poateMarca(c, cate, pornit);
      if (!verdict.ok) return json({ eroare: verdict.eroare }, verdict.status);

      await store.setJSON("config/" + showId, { ...c, repetitie: pornit });
      console.log(`Expoziția „${showId}" a fost marcată ca repetiție: ${pornit ? "DA" : "nu"}.`);
      return json({ ok: true, repetitie: pornit });
    }

    if (body.actiune === "repetitie-sterge") {
      const showId = String(body.showId || "");
      const c = await store.get("config/" + showId, { type: "json" });

      // PAZA, întrebată ÎNAINTE de prima ștergere. Nu întreabă omul „ești sigur?" —
      // întreabă magazia. Fără marcajul de repetiție, pus dinainte printr-o altă
      // acțiune, nu se atinge nimic.
      const verdict = poateSterge(c);
      if (!verdict.ok) return json({ eroare: verdict.eroare }, verdict.status);

      const sterse = { coada: 0, dovezi: 0, verificari: 0, audit: 0, proprietari: 0, config: 0 };
      for (const { prefix, camp } of prefixeleExpozitiei(showId)) {
        try {
          const { blobs } = await store.list({ prefix });
          for (const b of blobs) {
            await store.delete(b.key).catch(() => {});
            sterse[camp]++;
          }
        } catch (err) {
          console.error("Curățenia repetiției a eșuat la " + prefix + ":", err);
        }
      }
      for (const cheie of cheileExpozitiei(showId)) await store.delete(cheie).catch(() => {});
      sterse.config = 1;

      console.log(`Repetiția „${showId}" a fost ștearsă:`, sterse);
      return json({ ok: true, sterse });
    }

    return json({ eroare: "Acțiune necunoscută." }, 400);
  }

  // ——— Public: trimiterea unei înscrieri ———
  //
  // De aici încolo, oricine de pe internet scrie în magazie și declanșează un e-mail.
  // Capcana și limita stau ÎNAINTE de orice validare și înainte de orice citire din
  // magazie: un robot nu trebuie să ne coste nici măcar o căutare de configurație.
  // Comutatorul de urgență al administratorului: mentenanță = doar citiri.
  { const oprit = await refuzaDacaInchis(json); if (oprit) return oprit; }

  if (eRobot(body)) return json({ ok: true, inscriere: { id: "—" } });   // succes prefăcut

  const lim = await limiteazaTrimiterile(store, "inscriere-ip", req, {
    max: MAX_INSCRIERI_PE_ORA, fereastraMs: 3600e3,
  });
  if (!lim.permis) {
    return json({
      eroare: `Ai trimis deja ${MAX_INSCRIERI_PE_ORA} înscrieri în ultima oră. ` +
        `Mai încearcă peste ${minuteText(lim.dupaSecunde)} sau scrie la contact@cfc-royal.ro.`,
    }, 429);
  }

  const showId = String(body.showId || "");
  if (!segmentCheieValid(showId)) return json({ eroare: "Referință invalidă." }, 400);
  const config = await store.get("config/" + showId, { type: "json" });
  if (!config) return json({ eroare: "Expoziție inexistentă." }, 404);
  if (inchisPentruInscrieri(config)) return json({ eroare: "Înscrierile pentru această expoziție nu mai sunt deschise." }, 400);

  // ——— Blocul comun al proprietarului (o singură dată pentru tot lotul) ———
  const numeProp = String(body.numeProprietar || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  if (numeProp.length < 3) return json({ eroare: "Numele proprietarului este obligatoriu." }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ eroare: "Email invalid." }, 400);
  if (String(body.gdpr || "") !== "1") return json({ eroare: "Trebuie să accepți prelucrarea datelor (GDPR)." }, 400);
  // Bifa normelor de participare. Verificată AICI, nu doar prin atributul required din
  // formular: „required" ține de browser, iar cererea poate veni și fără browser.
  if (String(body.normeParticipare || "") !== "1")
    return json({ eroare: "Trebuie să îți asumi normele de participare la expoziție." }, 400);

  // Un formular = unul sau mai mulți câini. Forma VECHE (câmpuri de câine la nivelul de
  // sus) rămâne validă: o tratăm ca pe un lot de unul. Forma nouă trimite `caini: [ … ]`.
  // În oricare caz, în coadă ajung fișe cu CÂTE UN câine — exact ce importă managerul.
  const caini = Array.isArray(body.caini) && body.caini.length ? body.caini : [body];
  if (caini.length > MAX_CAINI_PE_LOT)
    return json({ eroare: "Prea mulți câini pe un singur formular (maximum " + MAX_CAINI_PE_LOT + ")." }, 400);

  const declaraMembru = String(body.esteMembru || "") === "1";
  const declaraStudent = String(body.esteStudent || "") === "1";
  const grila = config.tarif || null;
  let inainte = 0;
  if (grila) {
    const fisa = await store.get(cheieProprietar(showId, email), { type: "json" }).catch(() => null);
    inainte = Number(fisa && fisa.caini) || 0;
  }

  // Validăm și pregătim TOȚI câinii înainte de a scrie ceva: dacă unul e invalid, se
  // respinge tot lotul, cu mesaj pe câinele cu pricina (nimic pe jumătate). Taxa se
  // calculează AUTORITAR, în ordinea lotului (primul / următorii), nu după o bifă.
  const pregatite = [];
  let total = 0;
  for (let j = 0; j < caini.length; j++) {
    const d = caini[j] || {};
    const numeCaine = String(d.numeCaine || "").trim();
    const et = "Câinele " + (j + 1) + (numeCaine ? " (" + numeCaine + ")" : "") + ": ";
    const rasaId = String(d.rasaId || "");
    const sex = String(d.sex || "");
    const dataNasterii = String(d.dataNasterii || "");
    const clasa = String(d.clasa || "");
    const rasa = (config.rase || []).find((r) => r.id === rasaId);
    if (numeCaine.length < 2) return json({ eroare: et + "numele câinelui este obligatoriu." }, 400);
    if (!rasa) return json({ eroare: et + "alege o rasă din listă." }, 400);
    if (!["M", "F"].includes(sex)) return json({ eroare: et + "alege sexul." }, 400);
    if (!dataNasterii || isNaN(new Date(dataNasterii).getTime())) return json({ eroare: et + "data nașterii este invalidă." }, 400);
    if (!VARSTA[clasa]) return json({ eroare: et + "alege clasa de concurs." }, 400);
    // Microcipul e obligatoriu (identificarea WDF); pedigree-ul e obligatoriu dacă nu e
    // pe calea tipicității. Aceleași reguli ca înainte, aplicate fiecărui câine.
    if (String(d.microcip || "").trim().length < 6) return json({ eroare: et + "microcipul este obligatoriu (minimum 6 caractere)." }, 400);
    if (String(d.pedigreeTipicitate || "") !== "1" && String(d.pedigree || "").trim().length < 2)
      return json({ eroare: et + "numărul de pedigree este obligatoriu. Dacă exemplarul nu are acte, bifează pedigree de tipicitate." }, 400);
    if (!clasaValida(clasa, dataNasterii, config.data))
      return json({ eroare: et + "vârsta la data expoziției nu se încadrează în clasa aleasă." }, 400);

    const primul = (inainte + j) === 0;
    const taxa = grila
      ? calculeazaTaxa(grila, { membru: declaraMembru, primul, student: declaraStudent, clasa, breedId: rasaId })
      : taxaVeche(config.taxe, clasa);
    total += taxa;

    const inscriere = {
      showId,
      // Marcajul călătorește cu înscrierea, nu se deduce din configurație: registratura și
      // managerul trebuie să vadă „e o repetiție" chiar dacă se uită la fișă peste o
      // săptămână, când configurația a fost deja ștearsă.
      ...(eRepetitie(config) ? { repetitie: true } : {}),
      numeCaine: numeCaine.slice(0, 120),
      rasaId,
      rasaNumeRo: rasa.numeRo,
      sex,
      dataNasterii,
      pedigree: String(d.pedigree || "").trim().slice(0, 60) || null,
      pedigreeTipicitate: String(d.pedigreeTipicitate || "") === "1",
      microcip: String(d.microcip || "").trim().slice(0, 60) || null,
      crescator: String(d.crescator || "").trim().slice(0, 120) || null,
      // Art. 21 lit. f — se tipăresc în catalog; managerul le preia la import.
      culoareRoba: String(d.culoareRoba || "").trim().slice(0, 120) || null,
      tata: String(d.tata || "").trim().slice(0, 120) || null,
      mama: String(d.mama || "").trim().slice(0, 120) || null,
      clasa,
      numeProprietar: numeProp.slice(0, 120),
      email,
      telefon: String(body.telefon || "").trim().slice(0, 40) || null,
      adresa: String(body.adresa || "").trim().slice(0, 200) || null,
      tara: String(body.tara || "").trim().slice(0, 60) || null,
      creat: new Date().toISOString(),
      asumari: { norme: versiuneaNormelor(), gdpr: true, la: new Date().toISOString() },
      importat: false,
      taxa,
    };
    if (grila) {
      inscriere.declaratii = { membru: declaraMembru, student: declaraStudent, primulDeclarat: primul, caineNr: inainte + j + 1 };
    }
    pregatite.push({ inscriere, taxa });
  }

  // ——— Plata: o singură dovadă pentru tot lotul, pe suma TOTALĂ. Suma se recalculează
  // aici (nu se ia din formular), altfel oricine ar putea trimite „taxa: 0". ———
  const amPlatit = String(body.amPlatit || "") === "1";
  const TIPURI_DOVADA = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  let dovadaBuf = null, dovadaTip = null, dovadaNume = null;
  if (body.dovadaBase64) {
    if (String(body.dovadaBase64).length > 6_000_000)
      return json({ eroare: "Dovada plății depășește 4 MB — trimite o poză mai mică sau un PDF." }, 400);
    dovadaTip = String(body.dovadaTip || "");
    if (!TIPURI_DOVADA.has(dovadaTip))
      return json({ eroare: "Dovada plății trebuie să fie imagine (JPG/PNG/WebP) sau PDF." }, 400);
    try {
      dovadaBuf = Buffer.from(String(body.dovadaBase64), "base64");
    } catch {
      return json({ eroare: "Fișierul cu dovada plății nu a putut fi citit — încearcă din nou." }, 400);
    }
    if (!dovadaBuf.length || dovadaBuf.length > 4 * 1024 * 1024)
      return json({ eroare: "Dovada plății depășește 4 MB — trimite o poză mai mică sau un PDF." }, 400);
    dovadaNume = String(body.dovadaNume || "dovada").replace(/[^\w.\-]/g, "_").slice(0, 80);
  }
  if (total > 0) {
    if (!amPlatit)
      return json({ eroare: "Bifează că ai plătit taxa de înscriere (" + total + " lei în total) — plata se face înainte de trimiterea înscrierii." }, 400);
    if (!dovadaBuf)
      return json({ eroare: "Atașează dovada plății taxei de înscriere (poză sau PDF)." }, 400);
  }

  // ——— Scriere: N fișe cu câte un câine (exact ce importă managerul), o singură dovadă ———
  const lotSufix = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  let dovadaKey = null;
  if (dovadaBuf) {
    dovadaKey = "dovada/" + showId + "/" + lotSufix;
    await store.set(dovadaKey, dovadaBuf, { metadata: { tip: dovadaTip, nume: dovadaNume } });
  }
  const eLot = pregatite.length > 1;
  for (let j = 0; j < pregatite.length; j++) {
    const inscriere = pregatite[j].inscriere;
    inscriere.amPlatit = amPlatit;
    if (dovadaKey) { inscriere.dovadaKey = dovadaKey; inscriere.dovadaTip = dovadaTip; inscriere.dovadaNume = dovadaNume; }
    if (eLot) { inscriere.lotId = lotSufix; inscriere.lotPozitie = j + 1; inscriere.lotDin = pregatite.length; inscriere.lotTaxaTotala = total; }
    await store.setJSON("coada/" + showId + "/" + lotSufix + "-" + (j + 1), inscriere);
  }
  if (grila) {
    try {
      await store.setJSON(cheieProprietar(showId, email), {
        caini: inainte + pregatite.length, nume: numeProp.slice(0, 120), actualizat: new Date().toISOString(),
      });
    } catch (err) {
      // Contorul e o comoditate, nu o poartă: dacă scrierea cade, înscrierile rămân valide.
      console.error("Contorul de câini pe proprietar nu s-a putut actualiza:", err);
    }
  }

  // ——— Un singur e-mail de confirmare, cu toți câinii și totalul ———
  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) {
    const linii = pregatite.map((x) =>
      `<li><b>${escapeHtml(x.inscriere.numeCaine)}</b> (${escapeHtml(x.inscriere.rasaNumeRo)})${x.taxa > 0 ? " — " + x.taxa + " lei" : ""}</li>`).join("");
    const html = `<p>Bună, ${escapeHtml(numeProp)},</p>
      <p>Am primit înscrierea ${pregatite.length === 1 ? "câinelui" : "celor " + pregatite.length + " câini"} la expoziția <b>${escapeHtml(config.nume)}</b> (${escapeHtml(config.data)}):</p>
      <ul>${linii}</ul>
      ${total > 0 ? `<p>Total taxă de înscriere: <b>${total} lei</b>.</p>` : ""}
      ${total > 0 && config.organizator?.iban
        // Contul în care s-a plătit, scris și în e-mail: peste o lună, când cineva
        // caută plata în extras, are unde verifica beneficiarul fără să sune.
        ? `<p style="color:#555">Plata se face în contul organizatorului: <b>${escapeHtml(config.organizator.nume)}</b><br>` +
          `<span style="font-family:monospace">${escapeHtml(config.organizator.iban)}</span>` +
          `${config.organizator.banca ? " · " + escapeHtml(config.organizator.banca) : ""}</p>`
        : ""}
      <p>După verificarea de către secretariat vei primi e-mailul de validare, iar la închiderea catalogului — numerele de concurs și ecusoanele de tipărit.</p>
      <p>— Club Federal Chinologic Royal · World Dog Federation</p>`;
    await trimite({
      catre: email,
      subiect: `Înscriere primită — ${config.nume}`,
      html,
      expeditor: { name: "CFC-Royal Expoziții", email: "newsletter@cfc-royal.ro" },
    });

    // ——— Înștiințarea secretariatului: aceeași înscriere, văzută dinspre asociație ———
    //
    // Expozantul își primește confirmarea; fără e-mailul acesta, asociația află de
    // înscriere abia când apasă cineva pe importul din manager. Secretariatul vrea să
    // știe PE LOC că a intrat o înscriere — mai ales că plata se declară la trimitere
    // și trebuie căutată în extras. Destinatarii se pot schimba fără cod prin
    // INSCRIERI_EMAIL (adrese despărțite prin virgulă).
    const destinatari = String(process.env.INSCRIERI_EMAIL || "contact@cfc-royal.ro, flavian.savescu@gmail.com")
      .split(",").map((a) => a.trim()).filter(Boolean);
    const liniiSecretariat = pregatite.map((x) => {
      const i = x.inscriere;
      return `<li><b>${escapeHtml(i.numeCaine)}</b> — ${escapeHtml(i.rasaNumeRo)}, ${i.sex === "M" ? "mascul" : "femelă"}, clasa ${escapeHtml(i.clasa)}${x.taxa > 0 ? " — " + x.taxa + " lei" : ""}</li>`;
    }).join("");
    const htmlSecretariat = `<p>Înscriere nouă la <b>${escapeHtml(config.nume)}</b>:</p>
      <ul>${liniiSecretariat}</ul>
      <p>Proprietar: <b>${escapeHtml(numeProp)}</b> · <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>${body.telefon ? " · tel. " + escapeHtml(String(body.telefon)) : ""}</p>
      ${total > 0
        ? `<p>Taxă declarată ca plătită: <b>${total} lei</b>${dovadaBuf ? " — dovada e atașată fișei și se vede la verificarea din registratură" : ""}. De confirmat în extras.</p>`
        : "<p>Fără taxă de înscriere.</p>"}
      <p style="color:#555">Fișele așteaptă în coada site-ului; se aduc în Manager cu butonul de import.</p>`;
    // Înștiințarea e utilă, nu vitală: fișa e deja scrisă în coadă, expozantul e
    // confirmat — `trimite()` nu aruncă, deci un e-mail intern căzut nu strică înscrierea.
    await trimite({
      catre: destinatari,
      subiect: `Înscriere nouă — ${config.nume} (${pregatite.length} ${pregatite.length === 1 ? "câine" : "câini"}${total > 0 ? ", " + total + " lei" : ""})`,
      html: htmlSecretariat,
      expeditor: { name: "CFC-Royal Expoziții", email: "newsletter@cfc-royal.ro" },
    });
  }

  return json({ ok: true, caini: pregatite.length, total });
};
