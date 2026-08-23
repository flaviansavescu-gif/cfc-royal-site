// importuri-functii.test.mjs — niciun helper apelat, dar neimportat, nu mai ajunge live.
//
// LECȚIA (23.08.2026, auditul registraturii): `registru-canise.mjs` chema
// `invalideazaIndexPublic(s)` fără s-o importe — `node --check` trece (e ReferenceError
// la RULARE, nu la parsare), probele de comportament n-o atingeau, iar aprobarea
// caniselor era ruptă în producție de zile bune, în tăcere. Aceeași clasă a mai lovit
// (dubla `dataRo`, 26.07). De aici încolo, un identificator apelat dar nedefinit și
// neimportat oprește build-ul.
//
// Cum: pentru fiecare handler din netlify/functions/, se ia lista helperilor „de casă"
// des folosiți; dacă un fișier ÎL CHEAMĂ (`nume(`) dar nu-l importă și nu-l definește
// local, e semnalat. Nu e un linter general (n-avem un AST aici) — e o plasă țintită pe
// helperii al căror import uitat s-a dovedit deja scump.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL("../netlify/functions/", import.meta.url));

// Helperii de casă pe care o funcție îi cheamă des — și pe care i-a uitat deja cineva.
const HELPERI = [
  "invalideazaIndexPublic", "refuzaDacaInchis", "segmentCheieValid",
  "jurnalizeazaObligatoriu", "jurnalizeaza", "dispozitivCunoscut",
  "escapeHtml", "trimite", "actorJurnal", "ipCerere",
];

let verificate = 0;
const lipsuri = [];
for (const nume of readdirSync(DIR)) {
  if (!nume.endsWith(".mjs") || nume.endsWith(".test.mjs")) continue;
  const sursa = readFileSync(DIR + nume, "utf8");
  verificate++;
  for (const h of HELPERI) {
    // Îl cheamă? (`h(` undeva). Îl are? (import numit SAU definiție locală function/const).
    const cheama = new RegExp("\\b" + h + "\\s*\\(").test(sursa);
    if (!cheama) continue;
    const importat = new RegExp("import\\s*\\{[^}]*\\b" + h + "\\b[^}]*\\}").test(sursa);
    const definit = new RegExp("(function|const|let|var)\\s+" + h + "\\b").test(sursa);
    if (!importat && !definit) lipsuri.push(nume + " cheamă „" + h + "” fără să-l importe/definească");
  }
}

if (lipsuri.length) {
  console.error("HELPERI APELAȚI DAR NEIMPORTAȚI (ar fi ReferenceError live):");
  for (const l of lipsuri) console.error("  RAU " + l);
  process.exit(1);
}
console.log("ok: " + verificate + " funcții — niciun helper de casă apelat fără import");
