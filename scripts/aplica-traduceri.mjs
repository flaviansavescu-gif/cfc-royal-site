// aplica-traduceri.mjs — pune traducerile românești peste rubricile rămase în engleză.
//
// Peticul e un JSON: { "<cod WDF sau id>": { "sectiune.rubrica": "text românesc" } }.
// Unealta REFUZĂ să scrie dacă ceva nu se potrivește — rasă negăsită, rubrică
// inexistentă, ori rubrică deja în românește (semn că peticul e vechi și ar
// suprascrie o traducere mai bună făcută între timp). Mai bine se oprește decât
// să strice în tăcere o fișă.
//
//   node scripts/aplica-traduceri.mjs <petic.json> [--forteaza]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AICI = path.dirname(fileURLToPath(import.meta.url));
const TINTA = path.join(AICI, "..", "netlify", "functions", "_breed", "breeds.json");
const RO = /[ăâîșțşţ]/i;
// Cuvinte care nu au ce căuta într-un text românesc — dacă apar, traducerea n-a fost făcută.
// Granița e pe LITERĂ Unicode, nu pe `\b`: `\bfor\b` se potrivește în „forță", fiindcă
// „ț" nu e literă pentru `\w`, și ar respinge o traducere bună.
// „dog" NU e în listă: e cuvânt românesc (tip dog, dog german, dog argentinian).
const EN = /(?<!\p{L})(the|and|with|shall|should|must|slightly|well|from|for|which|their|body|head|tail|coat)(?!\p{L})/iu;

const [, , calePetic, ...restul] = process.argv;
if (!calePetic) { console.error("Folosire: node scripts/aplica-traduceri.mjs <petic.json>"); process.exit(1); }
const forteaza = restul.includes("--forteaza");

const petic = JSON.parse(fs.readFileSync(calePetic, "utf8"));
const date = JSON.parse(fs.readFileSync(TINTA, "utf8"));

const gaseste = (cheie) =>
  date.breeds.find((b) => b.wdf_code === cheie) ||
  date.breeds.find((b) => b.id === cheie) ||
  date.breeds.find((b) => b.breed_name === cheie);

const opriri = [];
const deScris = [];

for (const [cheie, rubrici] of Object.entries(petic)) {
  const rasa = gaseste(cheie);
  if (!rasa) { opriri.push(`rasă negăsită: ${cheie}`); continue; }
  for (const [caleBruta, textRo] of Object.entries(rubrici)) {
    // Un „!" la capătul cheii înseamnă „am verificat, e intenționat" — pentru rubricile
    // unde garda dă fals-pozitiv: nume proprii englezești rămase înadins în text
    // („Bull Terrier", „bull-and-terrier"), ori cuvinte identice în ambele limbi
    // („Distinct."). Se scrie doar cu acest semn, niciodată din întâmplare.
    const asumat = caleBruta.endsWith("!");
    const cale = asumat ? caleBruta.slice(0, -1) : caleBruta;
    if (cale === "_nume") continue;                       // etichetă de citit, nu rubrică
    const [sectiune, camp] = cale.split(".");

    // —— LISTE (defecte, fișa de arbitraj, pedagogie, observații) ——
    // Peticul aduce lista ÎNTREAGĂ tradusă, de aceeași lungime; se înlocuiește element cu
    // element, ca ordinea (și numărătoarea din ring) să rămână exact cea veche.
    const listaVeche = camp ? (rasa[sectiune] || {})[camp] : rasa[sectiune];
    if (Array.isArray(listaVeche)) {
      if (!Array.isArray(textRo) || textRo.length !== listaVeche.length) {
        opriri.push(`${cheie} → ${cale}: lista tradusă are ${Array.isArray(textRo) ? textRo.length : "?"} elemente, cea veche ${listaVeche.length}`);
        continue;
      }
      const rele = textRo.filter((t) => typeof t !== "string" || !t.trim() || (EN.test(t) && !asumat));
      if (rele.length) { opriri.push(`${cheie} → ${cale}: ${rele.length} elemente par tot englezești: „${String(rele[0]).slice(0, 50)}"`); continue; }
      deScris.push({ rasa, sectiune, camp, textRo, cheie, cale, lista: true });
      continue;
    }

    if (!camp) { opriri.push(`${cheie} → cale greșită: „${cale}"`); continue; }
    const vechi = (rasa[sectiune] || {})[camp];
    if (typeof vechi !== "string" || !vechi.trim()) {
      opriri.push(`${cheie} → ${cale}: rubrica e goală în fișă (peticul e pentru altă versiune)`);
      continue;
    }
    if (RO.test(vechi) && !forteaza) {
      opriri.push(`${cheie} → ${cale}: rubrica e DEJA în românește — nu o suprascriu`);
      continue;
    }
    // Traducerea nu se judecă după diacritice — „Moderat." e românește curat.
    // Se judecă după ce NU trebuie să fie: text englezesc, ori textul vechi copiat.
    if (EN.test(textRo) && !asumat) {
      opriri.push(`${cheie} → ${cale}: traducerea pare tot englezească (dacă e înadins, pune „!" la capătul cheii)`);
      continue;
    }
    if (textRo.trim() === vechi.trim() && !asumat) {
      opriri.push(`${cheie} → ${cale}: traducerea e identică cu originalul (dacă e înadins, pune „!" la capătul cheii)`);
      continue;
    }
    deScris.push({ rasa, sectiune, camp, textRo, cheie, cale });
  }
}

if (opriri.length) {
  console.error("NU AM SCRIS NIMIC. Neconcordanțe:");
  for (const o of opriri) console.error("  ✖ " + o);
  process.exit(1);
}

for (const s of deScris) {
  // Listele de la rădăcina fișei (judge_checklist, recurring_judge_observations) n-au „camp".
  if (s.camp) s.rasa[s.sectiune][s.camp] = s.textRo;
  else s.rasa[s.sectiune] = s.textRo;
}

// Urcăm versiunea fișelor atinse și consemnăm de ce — istoricul rasei trebuie să
// arate că textul s-a schimbat, ca la orice revizuire de standard.
const azi = new Date().toISOString().slice(0, 10);
const atinse = [...new Set(deScris.map((s) => s.rasa))];
for (const r of atinse) {
  r.version = (Number(r.version) || 1) + 1;
  r.revision_history = r.revision_history || [];
  r.revision_history.push({ version: r.version, date: azi, note: "Traducere în limba română a rubricilor rămase în engleză." });
  r.last_updated = azi;
}

fs.writeFileSync(TINTA, JSON.stringify(date, null, 2) + "\n", "utf8");
console.log(`Scris: ${deScris.length} rubrici, pe ${atinse.length} rase.`);
for (const r of atinse) console.log(`  ${(r.wdf_code || r.id).padEnd(10)} ${r.breed_name}  → v${r.version}`);
