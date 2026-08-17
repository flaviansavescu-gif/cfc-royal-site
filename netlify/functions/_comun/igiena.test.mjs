// igiena.test.mjs — reparatiile marunte, dar cu dinti, din auditul 17.08.2026.
//
// Fiecare probă de aici apără o regulă care, lipsă, lăsa o ușă întredeschisă:
//   1. materialele de curs — nu mai sunt in `public/`, iar calea ceruta nu poate iesi
//      din dosarul lor (traversare);
//   2. `jcr-raspuns` — singura functie din Judge Comparison Room fara zid anti-ghicire;
//   3. `verifica-act` — lista anularilor citita prost NU mai inseamna „act valabil";
//   4. seriile — rezervarea se face cu `onlyIfNew`, deci doua depuneri simultane nu mai
//      pot primi acelasi numar de inregistrare;
//   5. codurile de instalare — 8 caractere si NU se mai pastreaza in clar.
//
// Fara ghilimele romanesti in titluri (regula casei).
//
// Ruleaza: node netlify/functions/_comun/igiena.test.mjs
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { caleSigura } from "../material-curs.mjs";

const cite = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const exista = (rel) => existsSync(fileURLToPath(new URL(rel, import.meta.url)));

let rau = 0;
const t = (nume, bun, info) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + (!bun && info != null ? " -> " + info : ""));
};

console.log("\n1. Materialele de curs: afara din public, si fara traversare\n");

t("dosarul NU mai e in public/", !exista("../../../public/cursuri-materiale"));
t("dosarul exista la radacina depozitului", exista("../../../cursuri-materiale"));
t(
  "netlify.toml il include in pachetul functiei",
  /\[functions\."material-curs"\][\s\S]*included_files = \["cursuri-materiale\/\*\*"\]/.test(cite("../../../netlify.toml")),
);

t("o cale normala trece", caleSigura("flavian-savescu/suport-curs-4-3-cod-etic-arbitru.pdf") !== null);
t("prefixul din link e acceptat", caleSigura("/cursuri-materiale/flavian-savescu/orar.pdf") !== null);
for (const rea of [
  "../material-studiu/pagina-1.webp",
  "flavian-savescu/../../.env",
  "../../.env",
  "/etc/passwd",
  "flavian-savescu/cod.pdf/../../../secret.pdf",
  "flavian-savescu\\..\\..\\secret.pdf",
  "flavian-savescu/secret.exe",
  "flavian-savescu/secret",
  "",
  null,
]) {
  t("se refuza: " + JSON.stringify(rea), caleSigura(rea) === null);
}

console.log("\n2. Zidul anti-ghicire pe toate functiile care primesc un cod\n");

for (const f of ["jcr-barem", "jcr-comparatie", "jcr-feedback", "jcr-raport", "jcr-raspuns", "jcr-resurse", "jcr-sesiuni"]) {
  t(f + " e ambalat in cuLimitareCod", /cuLimitareCod\(/.test(cite("../" + f + ".mjs")));
}

console.log("\n3. Revocarile: tacerea magaziei nu mai inseamna „valabil”\n");

{
  const s = cite("../verifica-act.mjs");
  t("citirea listei intoarce null la eroare", /return null;/.test(s));
  t("raspunsul cunoaste starea nedeterminata", /nedeterminat: true/.test(s));
  t("nedeterminat NU se raporteaza ca valid", /if \(revocate === null\)[\s\S]{0,400}valid: false/.test(s));
  const pagina = cite("../../../src/pages/verifica.astro");
  t("pagina publica arata starea nedeterminata", /d\.nedeterminat/.test(pagina));
}

console.log("\n4. Seriile: rezervare fara fereastra de cursa\n");

for (const f of ["registru-dmf", "registru-pedigree"]) {
  const s = cite("../" + f + ".mjs");
  t(f + " rezerva seria cu onlyIfNew", /onlyIfNew: true/.test(s));
  t(f + " tine cont de raspunsul magaziei", /modified !== false/.test(s));
}

console.log("\n5. Codurile de instalare\n");

for (const f of ["breed-instalare", "paa-instalare"]) {
  const s = cite("../" + f + ".mjs");
  t(f + ": lungimea e 8", /const LUNGIME_COD = 8;/.test(s));
  t(f + ": codul NU se mai pastreaza in magazie", !/const rec = \{ cod,/.test(s));
  t(f + ": codul pleaca o singura data, la generare", /return json\(\{ ok: true, cod: \{ \.\.\.rec, cod, id \} \}\)/.test(s));
}

console.log(rau ? `\n${rau} probe cazute\n` : "\nToate probele au trecut\n");
process.exit(rau ? 1 : 0);
