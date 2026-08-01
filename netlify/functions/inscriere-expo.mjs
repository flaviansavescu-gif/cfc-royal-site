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
import { escapeHtml } from "./_comun/posta.mjs";
import { calculeazaTaxa, taxaVeche } from "./_comun/taxa-expo.mjs";
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

const SECRET = process.env.EXPO_SYNC_SECRET || "";

// Cât poate trimite o adresă IP într-o oră. Generos deliberat: o familie cu patru câini
// trebuie să-i poată înscrie pe toți, iar o canisă mare poate veni cu opt. Peste
// doisprezece într-o oră, de la aceeași adresă, nu mai e o canisă — e un robot.
const MAX_INSCRIERI_PE_ORA = 12;

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
  winner: { min: 15, max: null },
  champion: { min: 15, max: null },
  foreign_champion: { min: 15, max: null },
  veterani: { min: 120, max: null },
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

function varstaInLuni(nastere, laData) {
  const d1 = new Date(nastere), d2 = new Date(laData);
  let luni = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (d2.getDate() < d1.getDate()) luni -= 1;
  return luni;
}

function clasaValida(clasa, nastere, dataShow) {
  const r = VARSTA[clasa];
  if (!r) return false;
  const luni = varstaInLuni(nastere, dataShow);
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
        if (c && !inchisPentruInscrieri(c)) {
          expozitii.push({
            showId: c.showId, nume: c.nume, data: c.data, termen: c.termen, locatie: c.locatie,
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
    if (!SECRET || body.secret !== SECRET) return json({ eroare: "Secret invalid." }, 401);

    if (body.actiune === "config") {
      const c = body.config || {};
      if (!c.showId) return json({ eroare: "showId lipsă." }, 400);
      await store.setJSON("config/" + c.showId, { ...c, deschis: true });
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
      for (const key of body.chei || []) {
        try {
          const i = await store.get(key, { type: "json" });
          if (i) {
            await store.setJSON(key, { ...i, importat: true });
            // Dovada plății e o dată personală: odată importată în manager, copia din
            // cloud nu mai are rost — o ștergem.
            if (i.dovadaKey) await store.delete(i.dovadaKey).catch(() => {});
          }
        } catch (err) {
          console.error("Marcare eșuată:", err);
        }
      }
      return json({ ok: true });
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
  const config = await store.get("config/" + showId, { type: "json" });
  if (!config) return json({ eroare: "Expoziție inexistentă." }, 404);
  if (inchisPentruInscrieri(config)) return json({ eroare: "Înscrierile pentru această expoziție nu mai sunt deschise." }, 400);

  const numeCaine = String(body.numeCaine || "").trim();
  const rasaId = String(body.rasaId || "");
  const sex = String(body.sex || "");
  const dataNasterii = String(body.dataNasterii || "");
  const clasa = String(body.clasa || "");
  const numeProp = String(body.numeProprietar || "").trim();
  const email = String(body.email || "").trim().toLowerCase();

  const rasa = (config.rase || []).find((r) => r.id === rasaId);
  if (numeCaine.length < 2) return json({ eroare: "Numele câinelui este obligatoriu." }, 400);
  if (!rasa) return json({ eroare: "Alege o rasă din listă." }, 400);
  if (!["M", "F"].includes(sex)) return json({ eroare: "Alege sexul câinelui." }, 400);
  if (!dataNasterii || isNaN(new Date(dataNasterii).getTime())) return json({ eroare: "Data nașterii este invalidă." }, 400);
  if (!VARSTA[clasa]) return json({ eroare: "Alege clasa de concurs." }, 400);
  if (numeProp.length < 3) return json({ eroare: "Numele proprietarului este obligatoriu." }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ eroare: "Email invalid." }, 400);
  if (String(body.gdpr || "") !== "1") return json({ eroare: "Trebuie să accepți prelucrarea datelor (GDPR)." }, 400);
  // Bifa normelor de participare. Verificată AICI, nu doar prin atributul required din
  // formular: „required" ține de browser, iar cererea poate veni și fără browser.
  if (String(body.normeParticipare || "") !== "1")
    return json({ eroare: "Trebuie să îți asumi normele de participare la expoziție." }, 400);
  // „Toți câinii participanți trebuie să fie identificați prin microchip, iar datele
  // acestuia trebuie să corespundă în mod exact cu documentele prezentate"
  // (Verificarea identității câinilor, 1.1). Era opțional aici, deși în manager e
  // obligatoriu — a doua cale, negardată.
  if (String(body.microcip || "").trim().length < 6)
    return json({ eroare: "Microcipul este obligatoriu (minimum 6 caractere)." }, 400);
  // Numarul de pedigree e obligatoriu daca exemplarul are pedigree. Exceptia declarata
  // e calea pedigree-ului de tipicitate (caine de rasa fara acte). Verificat si pe
  // server, nu doar in browser.
  if (String(body.pedigreeTipicitate || "") !== "1" && String(body.pedigree || "").trim().length < 2)
    return json({ eroare: "Numărul de pedigree este obligatoriu. Dacă exemplarul nu are acte, bifează pedigree de tipicitate." }, 400);
  if (!clasaValida(clasa, dataNasterii, config.data))
    return json({ eroare: "Vârsta câinelui la data expoziției nu se încadrează în clasa aleasă." }, 400);

  // ——— Taxa de înscriere: când expoziția are taxă pe clasa aleasă, cerem declarația de
  // plată și dovada (poză/PDF). Dovada NU confirmă plata — secretariatul o verifică și
  // abia el marchează plata drept confirmată în manager.
  //
  // Grila nouă taxează după trei lucruri, nu după clasa de concurs: e membru, e
  // primul lui câine la această expoziție, e student. Declarațiile vin din formular,
  // dar suma NU: ea se recalculează aici, altfel oricine ar putea trimite „taxa: 0".
  const declaraMembru = String(body.esteMembru || "") === "1";
  const declaraStudent = String(body.esteStudent || "") === "1";
  const declaraPrimul = String(body.primulCaine || "1") === "1";

  const grila = config.tarif || null;
  let inainte = 0;
  if (grila) {
    const fisa = await store.get(cheieProprietar(showId, email), { type: "json" }).catch(() => null);
    inainte = Number(fisa && fisa.caini) || 0;
  }
  // Adevărul îl spune contorul, nu bifa. Cine zice „nu e primul" fără să fi înscris
  // nimic ar plăti mai puțin decât trebuie — pe ăsta îl oprim, cu suma corectă în
  // mesaj, fiindcă e informație despre propriile lui înscrieri.
  const primul = inainte === 0;
  if (!declaraPrimul && primul && grila) {
    const corecta = calculeazaTaxa(grila, { membru: declaraMembru, primul: true, student: declaraStudent, clasa });
    return json({
      eroare: "Aceasta este prima ta înscriere la această expoziție, deci taxa este de " +
        corecta + " lei, nu cea pentru al doilea câine. Corectează răspunsul și reia plata dacă e nevoie.",
    }, 400);
  }

  const taxa = grila
    ? calculeazaTaxa(grila, { membru: declaraMembru, primul, student: declaraStudent, clasa })
    : taxaVeche(config.taxe, clasa);
  const amPlatit = String(body.amPlatit || "") === "1";
  const TIPURI_DOVADA = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  let dovadaBuf = null;
  let dovadaTip = null;
  let dovadaNume = null;
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
  if (taxa > 0) {
    if (!amPlatit)
      return json({ eroare: "Bifează că ai plătit taxa de înscriere (" + taxa + " lei) — plata se face înainte de trimiterea înscrierii." }, 400);
    if (!dovadaBuf)
      return json({ eroare: "Atașează dovada plății taxei de înscriere (poză sau PDF)." }, 400);
  }

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
    pedigree: String(body.pedigree || "").trim().slice(0, 60) || null,
    pedigreeTipicitate: String(body.pedigreeTipicitate || "") === "1",
    microcip: String(body.microcip || "").trim().slice(0, 60) || null,
    crescator: String(body.crescator || "").trim().slice(0, 120) || null,
    // Art. 21 lit. f — se tipăresc în catalog; managerul le preia la import.
    culoareRoba: String(body.culoareRoba || "").trim().slice(0, 120) || null,
    tata: String(body.tata || "").trim().slice(0, 120) || null,
    mama: String(body.mama || "").trim().slice(0, 120) || null,
    clasa,
    numeProprietar: numeProp.slice(0, 120),
    email,
    telefon: String(body.telefon || "").trim().slice(0, 40) || null,
    adresa: String(body.adresa || "").trim().slice(0, 200) || null,
    tara: String(body.tara || "").trim().slice(0, 60) || null,
    creat: new Date().toISOString(),
    // Ce anume și-a asumat omul, nu doar că a bifat. Versiunea e amprenta textului
    // normelor din clipa înscrierii: dacă normele se schimbă mâine, fișa asta arată în
    // continuare spre textul vechi, cel pe care l-a citit el. La fel pentru GDPR, care
    // până acum se verifica și se uita.
    asumari: { norme: versiuneaNormelor(), gdpr: true, la: new Date().toISOString() },
    importat: false,
  };

  const sufix = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const key = "coada/" + showId + "/" + sufix;
  if (dovadaBuf) {
    const dovadaKey = "dovada/" + showId + "/" + sufix;
    await store.set(dovadaKey, dovadaBuf, { metadata: { tip: dovadaTip, nume: dovadaNume } });
    inscriere.dovadaKey = dovadaKey;
    inscriere.dovadaTip = dovadaTip;
    inscriere.dovadaNume = dovadaNume;
  }
  inscriere.amPlatit = amPlatit;
  inscriere.taxa = taxa;
  if (grila) {
    // Declarațiile se păstrează lângă înscriere: secretariatul le vede la import și
    // le confirmă. Nu verificăm aici calitatea de membru — registrul de acces al
    // asociației conține doar membrii cărora li s-a emis cod, deci o „nepotrivire"
    // n-ar dovedi nimic, în schimb ar refuza prețul corect unui membru real.
    inscriere.declaratii = {
      membru: declaraMembru,
      student: declaraStudent,
      primulDeclarat: declaraPrimul,
      caineNr: inainte + 1,
    };
    // Cine bifează „primul câine" deși mai are înscrieri plătește mai mult decât
    // trebuie. Nu-l oprim din drum — îi reținem suma corectă și lăsăm o notă, ca
    // secretariatul să-i întoarcă diferența.
    if (declaraPrimul && !primul) {
      const cePlatise = calculeazaTaxa(grila, { membru: declaraMembru, primul: true, student: declaraStudent, clasa });
      if (cePlatise !== taxa) {
        inscriere.taxaObservatie =
          "A declarat primul câine, dar este al " + (inainte + 1) + "-lea: a putut plăti " +
          cePlatise + " lei în loc de " + taxa + " lei.";
      }
    }
    try {
      await store.setJSON(cheieProprietar(showId, email), {
        caini: inainte + 1, nume: inscriere.numeProprietar, actualizat: inscriere.creat,
      });
    } catch (err) {
      // Contorul e o comoditate, nu o poartă: dacă scrierea cade, înscrierea rămâne
      // validă și al doilea câine va fi taxat ca primul — secretariatul corectează.
      console.error("Contorul de câini pe proprietar nu s-a putut actualiza:", err);
    }
  }
  await store.setJSON(key, inscriere);

  // Email de confirmare (Brevo), dacă e configurat.
  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) {
    const html = `<p>Bună, ${numeProp.replace(/</g, "&lt;")},</p>
      <p>Am primit înscrierea câinelui <b>${numeCaine.replace(/</g, "&lt;")}</b> (${rasa.numeRo}) la expoziția <b>${config.nume}</b> (${config.data}).</p>
      ${taxa > 0 ? `<p>Taxa de înscriere pentru această fișă: <b>${taxa} lei</b>.</p>` : ""}
      ${taxa > 0 && config.organizator?.iban
        // Contul în care s-a plătit, scris și în e-mail: peste o lună, când cineva
        // caută plata în extras, are unde verifica beneficiarul fără să sune.
        ? `<p style="color:#555">Plata se face în contul organizatorului: <b>${escapeHtml(config.organizator.nume)}</b><br>` +
          `<span style="font-family:monospace">${escapeHtml(config.organizator.iban)}</span>` +
          `${config.organizator.banca ? " · " + escapeHtml(config.organizator.banca) : ""}</p>`
        : ""}
      <p>După verificarea de către secretariat vei primi e-mailul de validare, iar la închiderea catalogului — numărul de concurs și ecusonul de tipărit.</p>
      <p>— Club Federal Chinologic Royal · World Dog Federation</p>`;
    try {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { name: "CFC-Royal Expoziții", email: "newsletter@cfc-royal.ro" },
          to: [{ email }],
          subject: `Înscriere primită — ${config.nume}`,
          htmlContent: html,
        }),
      });
    } catch (err) {
      console.error("Email confirmare eșuat:", err);
    }
  }

  return json({ ok: true });
};
