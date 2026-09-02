// alinieaza-nume-rase.mjs — Exploratorul să numească rasele la fel ca site-ul și Managerul.
//
// De ce: expozantul se înscrie la „Ciobănesc German", iar arbitrul deschide fișa și
// citește „German Shepherd Dog". Același câine, două nume. Nomenclatorul site-ului
// (src/data/nomenclator-wdf.ts, generat din Manager) e sursa: el hotărăște numele
// românesc, iar Exploratorul se aliniază la el. NU inventăm traduceri aici.
//
// Numele englezesc NU se pierde: intră între `alternate_names`. E obligatoriu —
// atât importul de standarde WDF, cât și sincronizarea nomenclatorului din Manager
// caută rasa după breed_name ȘI după alternate_names. Fără el, un import viitor ar
// crede că e o rasă nouă și ar face duplicate.
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
  if (!n) continue;                          // rasă necunoscută nomenclatorului — se lasă
  if (n.ro === n.en) continue;               // nomenclatorul n-are nume românesc pentru ea
  if (cheie(n.ro) === cheie(b.breed_name)) continue; // deja aliniată
  schimbari.push({ b, vechi: b.breed_name, nou: n.ro });
}

console.log(`Rase de aliniat: ${schimbari.length} din ${date.breeds.length}\n`);
for (const s of schimbari)
  console.log(`  ${(s.b.wdf_code || s.b.id).padEnd(11)} ${s.vechi}\n${" ".repeat(14)}→ ${s.nou}`);

if (!scrie) { console.log("\n(Nimic scris. Rulează cu --scrie ca să aplic.)"); process.exit(0); }

const azi = new Date().toISOString().slice(0, 10);
for (const s of schimbari) {
  const b = s.b;
  b.alternate_names = Array.isArray(b.alternate_names) ? b.alternate_names : [];
  // Numele englezesc trece între denumirile alternative — pe el se fac potrivirile.
  if (!b.alternate_names.some((a) => cheie(a) === cheie(s.vechi))) b.alternate_names.unshift(s.vechi);
  b.breed_name = s.nou;
  if (b.identity) b.identity.official_name = s.nou;
  b.version = (Number(b.version) || 1) + 1;
  b.revision_history = b.revision_history || [];
  b.revision_history.push({ version: b.version, date: azi, note: `Nume aliniat la nomenclatorul CFC-Royal („${s.vechi}" păstrat ca denumire alternativă).` });
  b.last_updated = azi;
}
fs.writeFileSync(TINTA, JSON.stringify(date, null, 2) + "\n", "utf8");
console.log(`\nScris: ${schimbari.length} rase redenumite, cu numele vechi păstrat ca denumire alternativă.`);
