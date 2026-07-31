// =========================================================================
// proba-citire-26.mjs — pune citirea automată față în față cu un răspuns pe care îl știm.
//
// DE CE TOCMAI CUIBUL 26. Fiindcă acolo răspunsul e cunoscut: formularul a fost completat
// de mână, verificat față de certificatele tipărite, iar cele șase acte au fost deja
// eliberate. Orice altă probă ar fi fost o părere despre o părere.
//
// CE DOVEDEȘTE ȘI CE NU. Dovedește cât de bine transcrie citirea DOUĂ documente anume.
// Nu dovedește că merge pe orice pedigree din lume — un act rusesc scris de mână, o
// fotografie strâmbă făcută cu telefonul, un certificat pe două coloane pot arăta altfel.
// De aceea funcția de pe server PROPUNE, nu completează.
//
// NU ATINGE NIMIC. Nu intră în registru, nu urcă nimic, nu publică nimic. Citește două
// fișiere de pe disc și scrie o comparație pe ecran.
//
// CHEIA nu se scrie niciodată aici și nu se dă prin chat. Se pune într-un fișier `.env`
// lângă `package.json` (e în .gitignore, deci nu pleacă în depozit), pe un singur rând:
//     ANTHROPIC_API_KEY=...
//
// Rulează:  node scripts/proba-citire-26.mjs
//           node scripts/proba-citire-26.mjs "C:\cale\catre\alt\DMF"
// =========================================================================
import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { citesteFormular } from "./arhiva-formular.mjs";
import {
  INSTRUCTIUNI, schemaCitirii, mutaSubRadacina, laFel,
} from "../netlify/functions/_comun/citire-ascendenta.mjs";
import { pozitiiAscendenta, etichetaPozitie } from "../netlify/functions/registru-pedigree.mjs";

const RADACINA = fileURLToPath(new URL("..", import.meta.url));
const MODEL = "claude-opus-5";
const PRET = { intrare: 5 / 1_000_000, iesire: 25 / 1_000_000 };
const MAX_FISIER_SITE = 5 * 1024 * 1024;   // cât acceptă formularul de pe site

const IMPLICIT = "C:/FLAVIAN/Asociația Chinologică CARAȘ-SEVERIN/SITE/De pus in folder CODE/" +
  "26 Mușetescu Gabriel - Poodle - Enzo-Deea/DMF";

const c = {
  bun: (s) => `\x1b[32m${s}\x1b[0m`,
  rau: (s) => `\x1b[31m${s}\x1b[0m`,
  atentie: (s) => `\x1b[33m${s}\x1b[0m`,
  stins: (s) => `\x1b[90m${s}\x1b[0m`,
};

// —— Cheia, din mediu sau din .env ——
function cheia() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const env = join(RADACINA, ".env");
  if (existsSync(env)) {
    // Citim doar rândul care ne trebuie și nu-l tipărim niciodată, nici pe bucăți.
    const m = /^\s*ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/m.exec(readFileSync(env, "utf8"));
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  return "";
}

// Steagurile nu sunt căi: fără filtrul ăsta, „--din-fisier" ar fi luat drept dosar.
const dosar = process.argv.slice(2).find((a) => !a.startsWith("--")) || IMPLICIT;
if (!existsSync(dosar)) {
  console.error(c.rau(`Nu găsesc dosarul: ${dosar}`));
  process.exit(1);
}

const fisiere = readdirSync(dosar);
const gaseste = (re) => fisiere.find((f) => re.test(f));
const PIESE = [
  { cine: "TATĂL", radacina: "T", nume: gaseste(/pedigree.*mascul/i), declaratie: "mascul" },
  { cine: "MAMA", radacina: "M", nume: gaseste(/pedigree.*femel/i), declaratie: "femela" },
];

const numeTxt = gaseste(/\.txt$/i);
if (!numeTxt) {
  console.error(c.rau("Nu găsesc formularul .txt în dosar — fără el nu am cu ce compara."));
  process.exit(1);
}
const { date: adevar } = citesteFormular(readFileSync(join(dosar, numeTxt), "utf8"));

// Refacerea comparației din răspunsul păstrat, fără să mai plătim o citire. Când se
// schimbă felul în care se compară — și s-a schimbat, după prima rulare — trebuie să se
// vadă efectul pe ACELEAȘI date. Altfel ar fi două lucruri schimbate deodată.
const DIN_FISIER = process.argv.includes("--din-fisier");
const UNDE_BRUT = join(process.env.TEMP || RADACINA, "citire-26-brut.json");

const cheie = DIN_FISIER ? "-" : cheia();
if (!cheie) {
  console.error(c.rau("Lipsește ANTHROPIC_API_KEY."));
  console.error("Pune-o pe un rând în " + join(RADACINA, ".env") + " :  ANTHROPIC_API_KEY=...");
  console.error(c.stins("Fișierul .env e în .gitignore, deci nu pleacă nicăieri."));
  process.exit(1);
}

const CODURI = pozitiiAscendenta().map((p) => p.cod);
const client = new Anthropic({ apiKey: cheie });

console.log(`\nDosar : ${basename(dosar)}`);
console.log(`Rasă  : ${adevar.rasa}${adevar.varietate ? " / " + adevar.varietate : ""}`);
console.log(`Cuib  : ${adevar.numarCuib}  ·  ${adevar.pui.length} pui\n`);

const propuse = {};
const brut = {};
let jIn = 0, jOut = 0;

const pastrat = DIN_FISIER && existsSync(UNDE_BRUT) ? JSON.parse(readFileSync(UNDE_BRUT, "utf8")) : null;
if (DIN_FISIER && !pastrat) {
  console.error(c.rau(`Nu găsesc răspunsul păstrat: ${UNDE_BRUT}. Rulează întâi fără --din-fisier.`));
  process.exit(1);
}
if (pastrat) console.log(c.stins("(refac comparația din răspunsul păstrat — nicio citire nouă, cost zero)\n"));

for (const piesa of PIESE) {
  if (!piesa.nume) { console.log(c.rau(`✗ ${piesa.cine}: nu găsesc pedigree-ul în dosar`)); continue; }
  const cale = join(dosar, piesa.nume);
  const date = readFileSync(cale);
  const ePdf = /\.pdf$/i.test(piesa.nume);
  const mb = (date.length / 1024 / 1024).toFixed(2);

  process.stdout.write(`Citesc ${piesa.cine} — ${piesa.nume} (${mb} MB)… `);
  if (date.length > MAX_FISIER_SITE) {
    process.stdout.write(c.atentie("[peste limita de 5 MB a formularului de pe site] "));
  }

  let scos;
  if (pastrat) {
    scos = pastrat.brut?.[piesa.cine];
    if (!scos) { console.log(c.rau("lipsește din răspunsul păstrat")); continue; }
  } else {
  const b64 = date.toString("base64");
  const document = ePdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
    : { type: "image", source: { type: "base64", media_type: /\.png$/i.test(piesa.nume) ? "image/png" : "image/jpeg", data: b64 } };

  let r;
  try {
    r = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: INSTRUCTIUNI,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: { type: "json_schema", schema: schemaCitirii(CODURI) } },
      messages: [{
        role: "user",
        content: [document, { type: "text", text: `Acesta e certificatul de origine al ${piesa.cine} din cuibul care se înregistrează. Transcrie-l.` }],
      }],
    });
  } catch (err) {
    console.log(c.rau("a căzut: " + (err?.message || err)));
    continue;
  }

  jIn += r.usage?.input_tokens ?? 0;
  jOut += r.usage?.output_tokens ?? 0;
  scos = JSON.parse(r.content.find((b) => b.type === "text").text);
  }

  brut[piesa.cine] = scos;
  const mutate = mutaSubRadacina(piesa.radacina, scos.pozitii, CODURI, piesa.cine);
  Object.assign(propuse, mutate.propuneri);
  if (scos.caine?.nume) {
    propuse[piesa.radacina] = { nume: scos.caine.nume, nr: scos.caine.nr || "", titluri: "", sigur: true, nelamurire: "", din: piesa.cine };
  }
  console.log(c.bun(`${mutate.luate} poziții`) + (mutate.nesigure ? c.atentie(`, ${mutate.nesigure} nesigure`) : ""));

  // Capul certificatului, față de ce a declarat crescătorul.
  const dec = adevar[piesa.declaratie] || {};
  const rand = (eticheta, a, b) => {
    if (!a && !b) return;
    const semn = laFel(a, b) ? c.bun("=") : (a && b ? c.rau("≠") : c.atentie("?"));
    console.log(`    ${semn} ${eticheta.padEnd(12)} declarat: ${String(a || "—").padEnd(34)} document: ${b || "—"}`);
  };
  rand("nume", dec.nume, scos.caine?.nume);
  rand("serie", dec.pedigree, scos.caine?.nr);
  rand("microcip", dec.microcip, scos.caine?.microcip);
  rand("rasa", adevar.rasa, scos.caine?.rasa);
}

// —— Comparația pe cele 30 de poziții ——
console.log("\n" + "─".repeat(110));
console.log("POZIȚIE   " + "cine e".padEnd(26) + "DECLARAT (formular)".padEnd(38) + "CITIT (document)");
console.log("─".repeat(110));

let identice = 0, diferite = 0, doarDoc = 0, doarForm = 0, lipsaAmbele = 0;
const deVazut = [];

for (const { cod } of pozitiiAscendenta()) {
  const d = adevar.ascendenta[cod];
  const p = propuse[cod];
  if (!d && !p) { lipsaAmbele++; continue; }

  let semn, stare;
  if (d && p) {
    const numeLaFel = laFel(d.nume, p.nume);
    // O serie scrisă într-o parte și lipsă în cealaltă NU e o nepotrivire: e o lipsă.
    // Numărată drept diferență, ar fi umflat lista cu rânduri la care n-are nimeni ce
    // face — iar o listă umflată nu se mai citește.
    const serieLipsa = !(d.nr || "").trim() || !(p.nr || "").trim();
    const serieLaFel = serieLipsa || laFel(d.nr, p.nr);
    if (numeLaFel && serieLaFel) { semn = c.bun("="); identice++; stare = "identic"; }
    else { semn = c.rau("≠"); diferite++; stare = numeLaFel ? "aceeași poziție, serie diferită" : "NUME DIFERIT"; }
  } else if (p) { semn = c.atentie("+"); doarDoc++; stare = "doar în document"; }
  else { semn = c.atentie("−"); doarForm++; stare = "doar în formular"; }

  const st = (x) => (x ? `${x.nume}${x.nr ? " / " + x.nr : ""}` : "—");
  console.log(
    `${semn} ${cod.padEnd(7)} ${etichetaPozitie(cod).padEnd(26)}` +
    `${st(d).slice(0, 36).padEnd(38)}${st(p).slice(0, 44)}` +
    (p && !p.sigur ? c.atentie("  ⚠ " + p.nelamurire) : ""),
  );
  if (stare !== "identic") deVazut.push({ cod, stare, declarat: st(d), document: st(p), nelamurire: p?.nelamurire || "" });
}

const cost = jIn * PRET.intrare + jOut * PRET.iesire;
console.log("─".repeat(110));
console.log(
  `${c.bun(identice + " identice")} · ${diferite ? c.rau(diferite + " diferite") : "0 diferite"} · ` +
  `${c.atentie(doarDoc + " doar în document")} · ${c.atentie(doarForm + " doar în formular")} · ` +
  c.stins(lipsaAmbele + " necunoscute în amândouă"),
);
console.log(`Jetoane: ${jIn} intrare · ${jOut} ieșire  ·  cost ~${(cost * 100).toFixed(1)} cenți (${(cost).toFixed(4)} $)`);

if (deVazut.length) {
  console.log("\n" + c.atentie("DE VĂZUT CU OCHII, pe documentul tipărit:"));
  for (const x of deVazut) {
    console.log(`  ${x.cod.padEnd(6)} ${x.stare}`);
    console.log(`         formular: ${x.declarat}`);
    console.log(`         document: ${x.document}${x.nelamurire ? "   ⚠ " + x.nelamurire : ""}`);
  }
  console.log(c.stins("\n  „+ doar în document" + '" nu e greșeală: e o poziție pe care citirea a găsit-o și formularul n-o avea.'));
}

// Răspunsul întreg, pentru cine vrea să se uite în el.
const unde = join(process.env.TEMP || RADACINA, "citire-26-brut.json");
writeFileSync(unde, JSON.stringify({ brut, propuse, adevar: adevar.ascendenta }, null, 2), "utf8");
console.log(c.stins(`\nRăspunsul întreg: ${unde}`));
