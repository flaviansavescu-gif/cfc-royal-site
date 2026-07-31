// =========================================================================
// importa-arhiva.mjs — trimite în registru cuiburile din arhiva de hârtie.
//
// Rulează PE LAPTOP, fiindcă acolo stau dosarele. Citește formularele, leagă rasele de
// nomenclatorul WDF și trimite fiecare cuib funcției `registru-import`.
//
// SE OPREȘTE ÎNAINTE SĂ STRICE. Dacă un formular nu se poate citi întreg, sau dacă rasa
// nu se potrivește EXACT cu nomenclatorul, cuibul acela NU pleacă: se raportează, iar
// restul continuă. O origine greșită într-un registru genealogic se moștenește de toți
// descendenții — mai bine un cuib lipsă, care se vede, decât unul greșit, care nu.
//
// FOLOSIRE:
//   node scripts/importa-arhiva.mjs "<folderul arhivei>"            -> doar arată (proba uscată)
//   node scripts/importa-arhiva.mjs "<folderul arhivei>" --trimite  -> scrie în registru
//   node scripts/importa-arhiva.mjs "<folder>" --trimite --doar 05,06,07
//
// Secretul (EXPO_SYNC_SECRET) se ia singur din .env-ul managerului. Nu se tastează.
// =========================================================================
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { citesteFormular } from "./arhiva-formular.mjs";
import { potriveste } from "./arhiva-rase.mjs";
import { certificateEmise, completeazaDinCertificate } from "./arhiva-certificate.mjs";

const eDirector = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

/**
 * Formularul cuibului. Dosarele vechi îl țin în rădăcină; cele noi, într-un subdosar
 * „DMF" lângă actele de care ține (pedigree-urile părinților, dovada de plată).
 *
 * DOUĂ FORMULARE ÎN DOSAR OPRESC IMPORTUL. Înainte se lua primul din listă, în tăcere.
 * S-a văzut ce înseamnă asta: pusă o copie „(înainte-de-corecție)" lângă original, ea
 * ieșea prima la sortare, iar corecția s-a raportat drept „6 certificate deja corecte"
 * — adică pe dos față de adevăr, fără niciun semn că s-ar fi citit alt fișier.
 *
 * Un import care alege singur între două surse și nu spune care e cel mai prost fel de
 * unealtă: dă un răspuns liniștitor, despre alt dosar decât cel la care te uiți.
 * Copiile vechi se pun într-un subdosar (`copii vechi`), unde nu sunt căutate.
 */
function unSingurFormular(fisiere, unde) {
  const txt = fisiere.filter((f) => f.toLowerCase().endsWith(".txt"));
  if (txt.length > 1) {
    console.error(`\n  OPRIT: în „${unde}" sunt ${txt.length} fișiere .txt:`);
    for (const f of txt) console.error(`    · ${f}`);
    console.error("  Nu ghicesc care e formularul. Lasă unul singur (mută copiile într-un subdosar) și reia.\n");
    process.exit(1);
  }
  return txt[0] || null;
}

function gasesteFormular(dosar) {
  const inRadacina = unSingurFormular(readdirSync(dosar), dosar);
  if (inRadacina) return path.join(dosar, inRadacina);
  for (const sub of readdirSync(dosar)) {
    const cale = path.join(dosar, sub);
    if (!eDirector(cale)) continue;
    if (!/^dmf$/i.test(sub)) continue;
    const t = unSingurFormular(readdirSync(cale), cale);
    if (t) return path.join(cale, t);
  }
  return null;
}

/** Dosarul cu certificatele deja emise, dacă există. */
function gasesteCertificate(dosar) {
  for (const sub of readdirSync(dosar)) {
    const cale = path.join(dosar, sub);
    if (eDirector(cale) && /pedigree\s*pui/i.test(sub)) return certificateEmise(cale);
  }
  return [];
}

/**
 * Un dosar de cuib, sau un dosar plin de dosare de cuib? Semnul e subdosarul „DMF":
 * dosarele de cuib noi îl au, cele care adună mai multe cuiburi nu.
 */
function eUnSingurCuib(cale) {
  if (readdirSync(cale).some((f) => f.toLowerCase().endsWith(".txt"))) return true;
  return readdirSync(cale).some((s) => /^dmf$/i.test(s) && eDirector(path.join(cale, s)));
}

const ENV_MANAGER = "C:/FLAVIAN/Asociația Chinologică CARAȘ-SEVERIN/cfcr-expo-manager/.env";
const NOMENCLATOR = new URL("../src/data/nomenclator-wdf.ts", import.meta.url);
const BAZA_URL = process.env.URL_BAZA || "https://cfc-royal.ro/.netlify/functions";

const argv = process.argv.slice(2);
const BAZA = argv.find((a) => !a.startsWith("--"));
const TRIMITE = argv.includes("--trimite");
// Corecție = același formular, citit din nou, dar peste acte care EXISTĂ deja: se
// rescrie numai textul ascendenței, iar clasa actului trebuie să iasă neschimbată.
const CORECTEAZA = argv.includes("--corecteaza");
const URL_FUNCTIE = process.env.URL_IMPORT || `${BAZA_URL}/${CORECTEAZA ? "registru-corectie" : "registru-import"}`;
const doarArg = argv[argv.indexOf("--doar") + 1];
const DOAR = argv.includes("--doar") && doarArg ? doarArg.split(",").map((x) => x.trim()) : null;

if (!BAZA) {
  console.log("Spune folderul arhivei:\n  node scripts/importa-arhiva.mjs \"C:/…/Arhiva 1 (1-26)\"\n");
  process.exit(1);
}

function dinEnv(nume) {
  if (process.env[nume]) return process.env[nume];
  try {
    const rand = readFileSync(ENV_MANAGER, "utf8").split(/\r?\n/).find((l) => l.startsWith(nume + "="));
    if (!rand) return null;
    let v = rand.slice(nume.length + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v || null;
  } catch { return null; }
}

// Rasele, scoase din fișierul TypeScript fără să-l compilăm.
const rase = [...readFileSync(NOMENCLATOR, "utf8")
  .matchAll(/\{\s*ro:\s*"([^"]+)",\s*en:\s*"([^"]+)",\s*g:\s*(\d+)\s*\}/g)]
  .map((m) => ({ ro: m[1], en: m[2], g: Number(m[3]) }));

console.log(`\n  ${CORECTEAZA ? "CORECȚIE DE ASCENDENȚĂ (acte existente)" : "IMPORT ARHIVĂ ISTORICĂ"}` +
  `${TRIMITE ? "" : "  (probă — nu se scrie nimic)"}`);
console.log(`  ${BAZA}`);
console.log(`  nomenclator: ${rase.length} rase\n`);

// Un singur cuib, sau o arhivă întreagă? Spunem pe față ce am înțeles, ca să nu se
// importe altceva decât crede omul că importă.
const UNUL = eUnSingurCuib(BAZA);
const RADACINA = UNUL ? path.dirname(BAZA) : BAZA;
const dosare = UNUL
  ? [path.basename(BAZA)]
  : readdirSync(BAZA).filter((d) => eDirector(path.join(BAZA, d))).sort();
console.log(`  ${UNUL ? "un singur cuib" : dosare.length + " dosare"}\n`);

const gata = [], oprite = [];

for (const d of dosare) {
  const numar = d.slice(0, 2);
  if (DOAR && !DOAR.includes(numar)) continue;
  const caleDosar = path.join(RADACINA, d);

  const formular = gasesteFormular(caleDosar);
  if (!formular) { oprite.push({ d, de_ce: "nu are formular .txt — se face de mână" }); continue; }

  const { date, lipsuri } = citesteFormular(readFileSync(formular, "utf8"));

  // Numerele WDF lipsă din formular se iau din certificatele deja emise — singurul loc
  // unde există. Se completează ÎNAINTE de a judeca dacă formularul e întreg.
  const certificate = gasesteCertificate(caleDosar);
  const { completate, erori: eCert } = completeazaDinCertificate(date.pui, certificate);
  if (eCert.length) { oprite.push({ d, de_ce: "certificatele nu se potrivesc: " + eCert.join("; ") }); continue; }

  // Lipsurile se recalculează: ce s-a completat din certificat nu mai lipsește.
  const ramase = lipsuri
    .filter((l) => !/cod WDF/.test(l))
    .concat(date.pui.flatMap((p, i) => (p.wdf ? [] : [`puiul ${i + 1}: cod WDF`])));
  if (ramase.length) { oprite.push({ d, de_ce: "formular incomplet: " + ramase.join("; ") }); continue; }

  const r = potriveste(date.rasa, date.varietate, rase);
  if (r.eroare) {
    oprite.push({ d, de_ce: r.eroare + " · apropiate: " + (r.apropiate || []).join(", ") });
    continue;
  }

  gata.push({
    dosar: d,
    cuib: {
      numarCuib: date.numarCuib,
      rasa: r.rasa.ro,
      varietate: date.varietate,
      dataMontei: date.dataMontei,
      dataFatarii: date.dataFatarii,
      afix: date.afix,
      crescator: date.beneficiar,
      mascul: date.mascul,
      femela: date.femela,
      ascendenta: date.ascendenta,
      pui: date.pui,
      sursa: d,
    },
    prin: r.prin, corectat: r.cum === "tastare" ? `„${date.rasa}" → ${r.rasa.ro}` : "",
    completate,
  });
}

console.log(`  Gata de trimis: ${gata.length} · oprite: ${oprite.length}\n`);
for (const o of oprite) console.log(`  ✗ ${o.d}\n      ${o.de_ce}`);
if (oprite.length) console.log("");

for (const g of gata) {
  const n = g.cuib.pui.length;
  console.log(`  ${g.dosar.slice(0, 2)}  ${g.cuib.rasa}${g.corectat ? "  (" + g.corectat + ")" : ""} · ${n} pui · cuib ${g.cuib.numarCuib}`);
  // Fiecare număr luat din certificat se spune. Cine verifică trebuie să vadă exact ce
  // n-a venit din formular și din ce act a venit în schimb.
  for (const c of g.completate || [])
    console.log(`        numărul puiului ${c.pui} (${c.nume}) luat din certificat: ${c.serie}  ← ${c.din}`);
}

// La import, proba uscată se face aici, pe laptop — nu are ce întreba serverul.
// La corecție e altfel: ce se schimbă se vede doar comparând cu actele DIN registru,
// deci proba pleacă la server cu `proba: true` și acesta răspunde fără să scrie.
if (!TRIMITE && !CORECTEAZA) {
  console.log(`\n  Proba uscată. Ca să scrie în registru, adaugă  --trimite\n`);
  process.exit(0);
}

const secret = dinEnv("EXPO_SYNC_SECRET");
if (!secret) { console.log("\n  Nu am găsit EXPO_SYNC_SECRET.\n"); process.exit(1); }

console.log(`\n  Trimit către ${URL_FUNCTIE} …\n`);
let scrise = 0, sarite = 0, cazute = 0;

for (const g of gata) {
  let r, d;
  try {
    r = await fetch(URL_FUNCTIE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, cuib: g.cuib, ...(CORECTEAZA ? { proba: !TRIMITE } : {}) }),
    });
    d = await r.json();
  } catch (err) {
    console.log(`  ✗ ${g.dosar.slice(0, 2)}  cererea n-a plecat: ${err.message}`);
    cazute++;
    continue;
  }
  if (!r.ok && !d?.scrise && !d?.schimbate) {
    console.log(`  ✗ ${g.dosar.slice(0, 2)}  ${d?.eroare || r.status}`);
    for (const x of d?.refuzate || []) console.log(`        ⚠ ${x.serie}: ${x.de_ce}`);
    cazute++;
    continue;
  }

  if (CORECTEAZA) {
    const sch = d.schimbate || [];
    scrise += sch.length;
    sarite += (d.neatinse || []).length;
    console.log(`  ✓ ${g.dosar.slice(0, 2)}  cuib ${d.cuib} · Tip ${d.tip} ${d.cunoscute}/30 (neschimbat) · ` +
      `${sch.length} de îndreptat, ${(d.neatinse || []).length} deja corecte`);
    for (const x of sch) {
      // La probă vin diferențele pe câmpuri; la scriere, doar câte au fost.
      if (Array.isArray(x.diferente)) {
        console.log(`        ${x.serie}  ${x.nume}`);
        for (const dd of x.diferente) console.log(`            ${dd}`);
      } else {
        console.log(`        ${x.serie}  ${x.nume}  (${x.campuri} câmpuri)`);
      }
    }
    for (const e of d.erori || []) console.log(`        ⚠ ${e.eroare}`);
    continue;
  }

  scrise += (d.scrise || []).length;
  sarite += (d.sarite || []).length;
  console.log(`  ✓ ${g.dosar.slice(0, 2)}  cuib ${d.cuib} · Tip ${d.tip} · ${d.cunoscute}/30 cunoscute · ` +
    `${(d.scrise || []).length} scrise, ${(d.sarite || []).length} sărite`);
  for (const x of d.scrise || []) console.log(`        ${x.serie}  ${x.nume}`);
  for (const e of d.erori || []) console.log(`        ⚠ ${e.eroare}`);
}

console.log(`\n  ${"-".repeat(50)}`);
if (CORECTEAZA) {
  console.log(`  Certificate ${TRIMITE ? "îndreptate" : "de îndreptat"}: ${scrise} · deja corecte: ${sarite} · cuiburi căzute: ${cazute}`);
  if (!TRIMITE) console.log(`  Probă — nu s-a scris nimic. Ca să scrie, adaugă  --trimite`);
  console.log("");
} else {
  console.log(`  Certificate scrise: ${scrise} · sărite (existau): ${sarite} · cuiburi căzute: ${cazute}\n`);
}
