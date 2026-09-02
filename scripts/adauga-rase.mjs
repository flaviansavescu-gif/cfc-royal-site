// adauga-rase.mjs — adaugă fișe noi de rasă în Exploratorul de standarde.
//
// Fișierul de intrare e un vector de fișe complete. Unealta REFUZĂ să scrie dacă
// rasa există deja (după nume ori după vreo denumire alternativă), dacă id-ul e
// luat, dacă lipsesc rubricile obligatorii ori dacă grupa nu e una din cele zece
// ale WDF. Mai bine se oprește decât să bage un dublet în nomenclator.
//
//   node scripts/adauga-rase.mjs <rase.json>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AICI = path.dirname(fileURLToPath(import.meta.url));
const TINTA = path.join(AICI, "..", "netlify", "functions", "_breed", "breeds.json");

const [, , cale] = process.argv;
if (!cale) { console.error("Folosire: node scripts/adauga-rase.mjs <rase.json>"); process.exit(1); }

const noi = JSON.parse(fs.readFileSync(cale, "utf8"));
const date = JSON.parse(fs.readFileSync(TINTA, "utf8"));

const cheie = (n) => String(n || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const luate = new Set();
const ids = new Set();
for (const b of date.breeds) {
  ids.add(b.id);
  luate.add(cheie(b.breed_name));
  for (const a of b.alternate_names || []) luate.add(cheie(a));
}
const GRUPE = new Set(date.breeds.map((b) => b.group));
const OBLIGATORII = ["id", "breed_name", "group", "country_of_origin", "wdf_status", "identity", "anatomy", "faults"];

const opriri = [];
for (const b of noi) {
  const et = `${b.breed_name || b.id || "?"}: `;
  for (const k of OBLIGATORII) if (!b[k]) opriri.push(et + `lipsește rubrica obligatorie „${k}"`);
  if (ids.has(b.id)) opriri.push(et + `id-ul „${b.id}" e deja luat`);
  if (!GRUPE.has(b.group)) opriri.push(et + `grupa „${b.group}" nu e una dintre cele zece ale WDF`);
  for (const n of [b.breed_name, ...(b.alternate_names || [])])
    if (luate.has(cheie(n))) opriri.push(et + `numele „${n}" există deja în nomenclator`);
  // Fișa trebuie să aibă carne: fără rubricile de bază, arbitrul deschide o pagină goală.
  for (const k of ["head", "eyes", "ears", "tail", "coat", "color"])
    if (!(b.anatomy || {})[k]) opriri.push(et + `anatomia n-are „${k}"`);
  if (!(b.faults.disqualifying || []).length) opriri.push(et + "n-are niciun defect descalificant");
}

if (opriri.length) {
  console.error("NU AM SCRIS NIMIC. Neconcordanțe:");
  for (const o of opriri) console.error("  ✖ " + o);
  process.exit(1);
}

date.breeds.push(...noi);
// Ordinea din fișier e cea a grupelor, apoi alfabetică — ca diferențele să fie citibile.
const nrGrupa = (g) => { const m = /(\d+)/.exec(String(g || "")); return m ? Number(m[1]) : 99; };
date.breeds.sort((a, b) => nrGrupa(a.group) - nrGrupa(b.group) || String(a.breed_name).localeCompare(String(b.breed_name), "ro"));
if (date.meta) date.meta.breed_count = date.breeds.length;

fs.writeFileSync(TINTA, JSON.stringify(date, null, 2) + "\n", "utf8");
console.log(`Adăugate: ${noi.length} rase. Nomenclatorul are acum ${date.breeds.length}.`);
for (const b of noi) console.log(`  ${b.id}  ${b.breed_name}  (grupa ${nrGrupa(b.group)})`);
