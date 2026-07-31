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
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { citesteFormular } from "./arhiva-formular.mjs";
import { potriveste } from "./arhiva-rase.mjs";

const ENV_MANAGER = "C:/FLAVIAN/Asociația Chinologică CARAȘ-SEVERIN/cfcr-expo-manager/.env";
const NOMENCLATOR = new URL("../src/data/nomenclator-wdf.ts", import.meta.url);
const URL_FUNCTIE = process.env.URL_IMPORT || "https://cfc-royal.ro/.netlify/functions/registru-import";

const argv = process.argv.slice(2);
const BAZA = argv.find((a) => !a.startsWith("--"));
const TRIMITE = argv.includes("--trimite");
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

console.log(`\n  IMPORT ARHIVĂ ISTORICĂ${TRIMITE ? "" : "  (proba uscată — nu se scrie nimic)"}`);
console.log(`  ${BAZA}`);
console.log(`  nomenclator: ${rase.length} rase\n`);

const dosare = readdirSync(BAZA).filter((d) => statSync(path.join(BAZA, d)).isDirectory()).sort();
const gata = [], oprite = [];

for (const d of dosare) {
  const numar = d.slice(0, 2);
  if (DOAR && !DOAR.includes(numar)) continue;

  const txts = readdirSync(path.join(BAZA, d)).filter((f) => f.toLowerCase().endsWith(".txt"));
  if (!txts.length) { oprite.push({ d, de_ce: "nu are formular .txt — se face de mână" }); continue; }

  const { date, lipsuri } = citesteFormular(readFileSync(path.join(BAZA, d, txts[0]), "utf8"));
  if (lipsuri.length) { oprite.push({ d, de_ce: "formular incomplet: " + lipsuri.join("; ") }); continue; }

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
  });
}

console.log(`  Gata de trimis: ${gata.length} · oprite: ${oprite.length}\n`);
for (const o of oprite) console.log(`  ✗ ${o.d}\n      ${o.de_ce}`);
if (oprite.length) console.log("");

for (const g of gata) {
  const n = g.cuib.pui.length;
  console.log(`  ${g.dosar.slice(0, 2)}  ${g.cuib.rasa}${g.corectat ? "  (" + g.corectat + ")" : ""} · ${n} pui · cuib ${g.cuib.numarCuib}`);
}

if (!TRIMITE) {
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
      body: JSON.stringify({ secret, cuib: g.cuib }),
    });
    d = await r.json();
  } catch (err) {
    console.log(`  ✗ ${g.dosar.slice(0, 2)}  cererea n-a plecat: ${err.message}`);
    cazute++;
    continue;
  }
  if (!r.ok && !d?.scrise) {
    console.log(`  ✗ ${g.dosar.slice(0, 2)}  ${d?.eroare || r.status}`);
    cazute++;
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
console.log(`  Certificate scrise: ${scrise} · sărite (existau): ${sarite} · cuiburi căzute: ${cazute}\n`);
