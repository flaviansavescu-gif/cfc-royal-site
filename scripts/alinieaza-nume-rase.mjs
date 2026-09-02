// alinieaza-nume-rase.mjs — fiecare rasă poartă AMÂNDOUĂ denumirile.
//
// Cerut de VP Tehnic și de Arbitraj (02.09.2026): „ambele denumiri, cea în engleză
// iar în paranteză cea în română, astfel să fie cunoscute ambele”. Pe ecran se
// citește „German Shepherd Dog (Ciobănesc German)”.
//
// CUM: numele NU se lipesc într-un singur șir. `breed_name` rămâne denumirea de
// căpetenie, iar `nume_ro` poartă cealaltă formă; îmbinarea se face DOAR la afișare
// (numeIntreg din app.js). Altfel s-ar strica sortarea, căutarea, potrivirea cu
// nomenclatorul Managerului și citirea în cască din ring, care ar rosti paranteza.
//
// CARE E DENUMIREA DE CĂPETENIE: cea internațională (engleză), cum s-a cerut — CU O
// EXCEPȚIE: la rasele ROMÂNEȘTI numele românesc e cel original și rămâne el în față,
// iar cel englezesc trece în paranteză. Un ciobănesc carpatin nu se trece sub nume
// englezesc pe site-ul unei federații românești.
//
// Sursa denumirilor: nomenclatorul site-ului (src/data/nomenclator-wdf.ts, generat din
// Manager). NU se inventează traduceri aici.
//
//   node scripts/alinieaza-nume-rase.mjs           (arată ce ar schimba)
//   node scripts/alinieaza-nume-rase.mjs --scrie   (scrie)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AICI = path.dirname(fileURLToPath(import.meta.url));
const TINTA = path.join(AICI, "..", "netlify", "functions", "_breed", "breeds.json");
const NOMENCLATOR = path.join(AICI, "..", "src", "data", "nomenclator-wdf.ts");
const scrie = process.argv.includes("--scrie");

const date = JSON.parse(fs.readFileSync(TINTA, "utf8"));
const nom = [...fs.readFileSync(NOMENCLATOR, "utf8")
  .matchAll(/\{ ro: "([^"]+)", en: "([^"]+)", g: (\d+) \}/g)].map((m) => ({ ro: m[1], en: m[2] }));
if (!nom.length) { console.error("Nu am putut citi nomenclatorul site-ului."); process.exit(1); }

const cheie = (n) => String(n || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const index = new Map();
for (const x of nom) { index.set(cheie(x.en), x); index.set(cheie(x.ro), x); }

const schimbari = [];
for (const b of date.breeds) {
  const alt = Array.isArray(b.alternate_names) ? b.alternate_names : [];
  let n = null;
  for (const c of [b.breed_name, ...alt].map(cheie)) { n = index.get(c); if (n) break; }
  if (!n) continue;                            // rasă necunoscută nomenclatorului
  // Fără a doua formă — ori aceeași formă scrisă doar cu alte diacritice. „Dalmatian
  // (Dalmațian)" ori „Coton de Tuléar (Coton de Tulear)" n-ar spune nimănui nimic.
  if (n.ro === n.en || cheie(n.ro) === cheie(n.en)) continue;

  // Rasele românești își păstrează numele românesc în față.
  const romaneasca = /^Roman/i.test(b.country_of_origin || "");
  const capat = romaneasca ? n.ro : n.en;
  const paranteza = romaneasca ? n.en : n.ro;
  if (b.breed_name === capat && b.nume_ro === paranteza) continue;   // deja așezată
  schimbari.push({ b, capat, paranteza, vechi: b.breed_name });
}

console.log(`Rase de așezat pe două denumiri: ${schimbari.length} din ${date.breeds.length}\n`);
for (const s of schimbari) console.log(`  ${(s.b.wdf_code || s.b.id).padEnd(11)} ${s.capat} (${s.paranteza})`);

if (!scrie) { console.log("\n(Nimic scris. Rulează cu --scrie ca să aplic.)"); process.exit(0); }

const azi = new Date().toISOString().slice(0, 10);
for (const s of schimbari) {
  const b = s.b;
  b.breed_name = s.capat;
  b.nume_ro = s.paranteza;
  if (b.identity) b.identity.official_name = s.capat;
  // Amândouă formele trebuie să rămână găsibile: importul de standarde WDF și
  // sincronizarea nomenclatorului caută rasa după breed_name ȘI după alternate_names.
  b.alternate_names = Array.isArray(b.alternate_names) ? b.alternate_names : [];
  for (const n of [s.capat, s.paranteza, s.vechi])
    if (cheie(n) !== cheie(b.breed_name) && !b.alternate_names.some((a) => cheie(a) === cheie(n)))
      b.alternate_names.push(n);
  // Denumirea de căpetenie n-are ce căuta și între cele alternative: ar apărea de
  // două ori sub numele rasei, în listă și în exportul Word.
  b.alternate_names = b.alternate_names.filter((a) => cheie(a) !== cheie(b.breed_name));
  b.version = (Number(b.version) || 1) + 1;
  b.revision_history = b.revision_history || [];
  b.revision_history.push({ version: b.version, date: azi, note: "Rasa poartă amândouă denumirile: „" + s.capat + " (" + s.paranteza + ")”." });
  b.last_updated = azi;
}
fs.writeFileSync(TINTA, JSON.stringify(date, null, 2) + "\n", "utf8");
console.log(`\nScris: ${schimbari.length} rase poartă acum amândouă denumirile.`);
