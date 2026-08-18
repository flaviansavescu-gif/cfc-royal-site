// _comun/paznic.mjs — paznicul de INTRUZIUNE: memoria lui și regula lui de judecată.
//
// Al doilea paznic al casei. Primul (`monitor-flux`) veghează DISPONIBILITATEA — dacă
// registrul mai răspunde. Acesta veghează ÎNCERCĂRILE DE INTRARE: cine bate la uși și
// cum bate.
//
// DE CE E NEVOIE DE EL. Senzorul exista deja: zidul anti-ghicire (`limitare.mjs`) numără
// fiecare cod greșit. Dar e un contor de STARE, nu un jurnal — se resetează la fereastră
// nouă și se șterge la o autentificare reușită. Cine s-ar fi uitat la el peste un sfert de
// oră ar fi văzut doar „acum e liniște", nu și că la trei noaptea cineva a bătut de patru
// sute de ori și apoi s-a oprit. Aici îi punem memorie.
//
// CE NUMĂRĂ, DE FAPT, PAZNICUL. Nu încercările — TIPARUL lor. Douăzeci de coduri greșite
// nu sunt o veste; forma lor este:
//   • aceeași urmă la uși care n-au nicio legătură între ele  -> cineva CAUTĂ
//     (un om care și-a uitat codul încearcă la o singură ușă)
//   • multe urme diferite pe aceeași ușă, în același sfert de oră -> o UNEALTĂ care își
//     rotește adresa ca să nu fie blocată (nu sunt atâția oameni treji la 3 dimineața)
//
// CUM E AȘEZATĂ MEMORIA. O cheie pe (oră, ușă, amprentă):
//   paznic/<AAAA-LL-ZZ-HH>/<usa>/<amprenta>  ->  { n, prima, ultima }
// Alegerea nu e întâmplătoare: NUMELE cheilor poartă singure aproape tot semnalul. Câte
// amprente distincte au bătut într-o oră se află NUMĂRÂND CHEILE, fără să deschizi
// niciuna — iar asta ține judecata sub cele zece secunde ale unei funcții Netlify chiar
// și în toiul unui val de câteva mii de încercări.
//
// CE NU PĂSTRĂM: adresa IP în clar (doar amprenta ei, ca peste tot în casă), codul
// încercat (l-am face astfel căutabil), și nimic care să identifice o persoană.
// Retenție: 30 de zile, cât spune politica de confidențialitate pentru amprente IP.
import { createHash } from "node:crypto";

/** Fusul în care trăiește asociația. Alarmele se citesc de oameni, nu de servere. */
export const FUS = "Europe/Bucharest";

/** Cât ține memoria paznicului (politica: 30 de zile pentru amprente IP). */
export const RETENTIE_ZILE = 30;

// ——— Pragurile. Sunt DELIBERAT ridicate: un paznic care sună des ajunge ignorat. ———

/** SEMNAL: aceeași urmă bate la atâtea uși DIFERITE într-o fereastră scurtă. */
export const USI_PENTRU_SEMNAL = 3;
/** SEMNAL: sau o singură urmă adună atâtea refuzuri într-o zi. */
export const REFUZURI_URMA_PENTRU_SEMNAL = 25;
/** ALARMĂ: atâtea refuzuri în fereastra de veghe… */
export const REFUZURI_PENTRU_ALARMA = 300;
/** …venite de la atâtea urme diferite (adică adrese rotite, nu oameni). */
export const URME_PENTRU_ALARMA = 20;
/** Fereastra pe care se uită paznicul înapoi la fiecare trezire. */
export const ORE_VEGHE = 3;
/** După o alarmă, tăcere atâtea ore — dacă situația nu se schimbă. */
export const RABDARE_ALARMA_ORE = 12;

/**
 * Numele omenesc al ușii. Paznicul scrie „registratura", nu „registru-dmf.mjs" —
 * scrisoarea o citește președintele, nu un programator.
 *
 * Ce nu e aici nu e o ușă cu cod și nu se consemnează.
 */
export const USI = {
  "acces-cursuri": "Școala de Arbitraj",
  "stare-cursuri": "Școala de Arbitraj",
  "progres-cursuri": "Școala de Arbitraj",
  "test-modul": "Școala de Arbitraj",
  "autorizare-cursuri": "Școala de Arbitraj",
  "asistente-cursuri": "Școala de Arbitraj",
  "interese-rase": "Școala de Arbitraj",
  "buletin-cursuri": "Buletinul Școlii",
  "material-protejat": "Manualul de studiu",
  "material-curs": "Materialele de curs",
  "registru-acces": "Registrul genealogic",
  "registru-dmf": "Declarațiile de montă",
  "registru-pedigree": "Registratura",
  "registru-canise": "Registrul caniselor",
  "registru-sanatate": "Dosarele de sănătate",
  "registru-cuiburi": "Anunțurile de cuiburi",
  "registru-import": "Registratura",
  "registru-corectie": "Registratura",
  "cereri-date": "Cererile GDPR",
  "breed-date": "Exploratorul de standarde",
  "breed-instalare": "Instalarea Exploratorului",
  "paa-instalare": "Instalarea aplicației de adnotare",
  "jcr-sesiuni": "Judge Comparison Room",
  "jcr-raspuns": "Judge Comparison Room",
  "jcr-barem": "Judge Comparison Room",
  "jcr-comparatie": "Judge Comparison Room",
  "jcr-feedback": "Judge Comparison Room",
  "jcr-raport": "Judge Comparison Room",
  "jcr-resurse": "Judge Comparison Room",
};

/** Numele funcției din adresa cererii; `null` dacă nu e o funcție de-a noastră. */
export function numeFunctie(url) {
  const m = String(url || "").match(/\/\.netlify\/functions\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/** Ușa la care s-a bătut, pe înțelesul omului; `null` dacă nu e o ușă cu cod. */
export function usaDinUrl(url) {
  const f = numeFunctie(url);
  return f ? USI[f] || null : null;
}

/** Forma în care intră ușa în cheie (fără bare, fără diacritice care încurcă). */
export const feliaUsii = (usa) =>
  String(usa || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 40) || "necunoscuta";

/** Ora, în UTC, ca felie de cheie: 2026-08-18-14. Se stochează în UTC, se ARATĂ local. */
export function cheieOra(d = new Date()) {
  const i = d.toISOString();
  return i.slice(0, 10) + "-" + i.slice(11, 13);
}

/** Ultimele `ore` felii de oră, cea mai recentă întâi. */
export function feliiRecente(ore, acum = new Date()) {
  const out = [];
  for (let i = 0; i < ore; i++) out.push(cheieOra(new Date(acum.getTime() - i * 3600e3)));
  return out;
}

export const cheieFapt = (ora, usa, amprenta) => `paznic/${ora}/${feliaUsii(usa)}/${amprenta}`;

/** Ce se poate citi dintr-o cheie, FĂRĂ s-o deschizi. Aici stă viteza paznicului. */
export function despicaCheie(cheie) {
  const p = String(cheie || "").split("/");
  if (p.length !== 4 || p[0] !== "paznic") return null;
  return { ora: p[1], usa: p[2], amprenta: p[3] };
}

/** Amprenta adresei — aceeași socoteală ca la zidul anti-ghicire, ca să se poată lega. */
export function amprentaIp(req) {
  const h = req?.headers;
  const ip =
    (h?.get?.("x-nf-client-connection-ip")) ||
    (h?.get?.("x-forwarded-for") || "").split(",")[0].trim() ||
    "necunoscut";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Consemnează un refuz de acreditare. NU aruncă niciodată: paznicul n-are voie să fie
 * el cauza unei căderi, la fel ca zidul pe care stă.
 */
export async function consemneaza(store, { usa, amprenta, acum = new Date() }) {
  if (!store || !usa || !amprenta) return;
  const cheie = cheieFapt(cheieOra(acum), usa, amprenta);
  try {
    const v = (await store.get(cheie, { type: "json" })) || { n: 0, prima: acum.toISOString() };
    v.n = (v.n || 0) + 1;
    v.ultima = acum.toISOString();
    await store.setJSON(cheie, v);
  } catch (err) {
    console.error("Paznicul n-a putut consemna:", err);
  }
}

/**
 * Câte însemnări deschide paznicul la o trezire. Numărul de URME și de UȘI se află din
 * numele cheilor, gratis; doar numărul de încercări cere deschiderea fiecărei însemnări.
 * Sub un val mare n-are rost să le deschidem pe toate — plafonăm și spunem cinstit, în
 * scrisoare, că numărul e estimat.
 */
export const PLAFON_DESCHIDERI = 250;

/**
 * Strânge faptele din ultimele `ore`. Întoarce exact ce mănâncă `judeca`.
 *
 * Ordinea e importantă: întâi LISTĂM (ieftin, dă urmele și ușile), abia apoi deschidem —
 * și doar atâtea câte încap în răbdarea unei funcții Netlify.
 */
export async function strange(store, ore = ORE_VEGHE, acum = new Date()) {
  const chei = [];
  for (const ora of feliiRecente(ore, acum)) {
    let blobs = [];
    try { ({ blobs } = await store.list({ prefix: `paznic/${ora}/` })); }
    catch (err) { console.error("Paznicul n-a putut lista ora " + ora + ":", err); continue; }
    for (const b of blobs) {
      const d = despicaCheie(b.key);
      if (d) chei.push({ cheie: b.key, ...d });
    }
  }
  return aduna(store, chei, ore);
}

/**
 * Ca `strange`, dar pe o felie lungă de timp — pentru raportul săptămânal.
 *
 * O săptămână înseamnă 168 de ore, adică 168 de listări: peste răbdarea unei funcții.
 * Aici facem UNA singură, pe tot dosarul paznicului, și alegem după numele cheilor —
 * ele poartă data. Într-o săptămână liniștită sunt câteva chei; într-una grea, plafonul
 * de deschideri ține socoteala în timp.
 */
export async function strangeZile(store, zile = 7, acum = new Date()) {
  const dela = cheieOra(new Date(acum.getTime() - zile * 24 * 3600e3));
  const chei = [];
  try {
    const { blobs } = await store.list({ prefix: "paznic/" });
    for (const b of blobs) {
      const d = despicaCheie(b.key);
      if (d && d.ora >= dela) chei.push({ cheie: b.key, ...d }); // feliile sunt sortabile ca text
    }
  } catch (err) {
    console.error("Paznicul n-a putut lista memoria:", err);
  }
  return aduna(store, chei, zile * 24);
}

/** Partea comună: deschide (plafonat) și adună. */
async function aduna(store, chei, ore) {
  const urme = new Set();
  const peUrma = {};
  const peUsa = {};
  for (const c of chei) {
    urme.add(c.amprenta);
    (peUrma[c.amprenta] ||= { n: 0, usi: new Set() }).usi.add(c.usa);
  }

  let refuzuri = 0;
  const deschise = Math.min(chei.length, PLAFON_DESCHIDERI);
  // În loturi paralele, nu una câte una: secvențial, 250 de citiri ar mânca singure
  // răbdarea funcției. Aceeași lecție ca la trimiterea buletinului.
  const LOT = 12;
  for (let i = 0; i < deschise; i += LOT) {
    await Promise.all(
      chei.slice(i, Math.min(i + LOT, deschise)).map(async (c) => {
        try {
          const v = await store.get(c.cheie, { type: "json" });
          const n = Number(v?.n || 0);
          refuzuri += n;
          peUrma[c.amprenta].n += n;
          peUsa[c.usa] = (peUsa[c.usa] || 0) + n;
        } catch (err) { console.error("Paznicul n-a putut citi " + c.cheie + ":", err); }
      }),
    );
  }

  const trunchiat = chei.length > deschise;
  if (trunchiat && deschise > 0) {
    // Estimare cinstită, nu invenție: media pe însemnările deschise, întinsă peste restul.
    refuzuri = Math.round((refuzuri / deschise) * chei.length);
  }

  return { refuzuri, urme, peUsa, peUrma, chei: chei.length, trunchiat, ore };
}

/**
 * JUDECATA. Funcție pură — primește ce s-a strâns, întoarce starea. Se poate proba fără
 * magazie, fără rețea și fără să aștepți un atac adevărat.
 *
 * @param {object} f faptele: { refuzuri, urme:Set|number, peUsa:{usa:n}, peUrma:{amprenta:{n, usi:Set|number}} }
 * @returns {{stare:"liniste"|"semnal"|"alarma", motiv:string, usa?:string, urma?:string}}
 */
export function judeca(f) {
  const refuzuri = Number(f?.refuzuri || 0);
  const urme = f?.urme instanceof Set ? f.urme.size : Number(f?.urme || 0);
  const peUsa = f?.peUsa || {};
  const peUrma = f?.peUrma || {};

  // ——— ALARMĂ: val susținut de la adrese rotite ———
  // Amândouă condițiile, nu una: multe refuzuri de la o singură adresă înseamnă un om
  // încăpățânat (și e oprit oricum de zid); multe adrese cu câte două încercări înseamnă
  // o zi de expoziție. Împreună înseamnă unealtă.
  if (refuzuri >= REFUZURI_PENTRU_ALARMA && urme >= URME_PENTRU_ALARMA) {
    const [usa] = Object.entries(peUsa).sort((a, b) => b[1] - a[1])[0] || ["mai multe uși"];
    return {
      stare: "alarma",
      usa,
      motiv:
        `${refuzuri} de încercări de la ${urme} adrese diferite în ultimele ${ORE_VEGHE} ore, ` +
        `mai ales la ${usa}`,
    };
  }

  // ——— SEMNAL: aceeași urmă, uși fără legătură între ele ———
  for (const [amprenta, d] of Object.entries(peUrma)) {
    const nrUsi = d?.usi instanceof Set ? d.usi.size : Number(d?.usi || 0);
    if (nrUsi >= USI_PENTRU_SEMNAL) {
      return {
        stare: "semnal",
        urma: amprenta,
        motiv: `același vizitator a încercat la ${nrUsi} uși diferite`,
      };
    }
  }

  // ——— SEMNAL: o singură urmă, dar insistentă ———
  for (const [amprenta, d] of Object.entries(peUrma)) {
    if (Number(d?.n || 0) >= REFUZURI_URMA_PENTRU_SEMNAL) {
      return {
        stare: "semnal",
        urma: amprenta,
        motiv: `același vizitator a încercat ${d.n} coduri`,
      };
    }
  }

  return { stare: "liniste", motiv: "nimic de semnalat" };
}

/**
 * Mai are rost să sune? Regula împotriva oboselii de alarmă — lecția din 17.08, când
 * paznicul de disponibilitate a sunat pentru un sughiț trecător.
 *
 * Se sună dacă: nu s-a mai sunat, ori s-a schimbat ușa, ori a trecut răbdarea.
 */
export function meritaSunat(verdict, veche, acum = new Date()) {
  if (verdict.stare !== "alarma" && verdict.stare !== "semnal") return false;
  if (!veche?.la) return true;
  if (veche.stare !== verdict.stare) return true;      // s-a agravat sau s-a schimbat felul
  if (veche.usa !== verdict.usa) return true;          // altă ușă = altă poveste
  const t = Date.parse(veche.la);
  if (!Number.isFinite(t)) return true;
  return acum.getTime() - t > RABDARE_ALARMA_ORE * 3600e3;
}

// ——— Ceasul local, pentru scrisori și pentru ora raportului ———

const parti = (d) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("ro-RO", {
      timeZone: FUS, weekday: "long", day: "numeric", month: "long",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );

/** „luni, 18 august, 08:00" — cum scrie un om, nu un server. */
export function momentLocal(d = new Date()) {
  const p = parti(d);
  return `${p.weekday}, ${p.day} ${p.month}, ${p.hour}:${p.minute}`;
}

/** Doar ora, ca număr, în fusul asociației. */
export const oraLocala = (d = new Date()) => Number(parti(d).hour);

/** E luni? (1 = luni, după socoteala JS.) */
export function eLuni(d = new Date()) {
  const zi = new Intl.DateTimeFormat("en-US", { timeZone: FUS, weekday: "short" }).format(d);
  return zi === "Mon";
}
