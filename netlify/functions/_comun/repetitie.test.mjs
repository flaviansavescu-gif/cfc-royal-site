// repetitie.test.mjs — modul repetiție: ce se vede, ce nu, și ce se poate șterge.
//
// Ștergerea repetiției mătură tot ce ține de o expoziție: înscrieri, dovezi de plată,
// verificările registraturii, auditul. Pe o expoziție ADEVĂRATĂ ar fi o catastrofă
// tăcută — descoperită luni mai târziu, când cineva caută dovada unei plăți.
//
// Proba asta ține locul unei singure reguli:
// **fără marcajul de repetiție pus dinainte, nu se șterge nimic.**
//
// Rulează: node netlify/functions/_comun/repetitie.test.mjs
import {
  eRepetitie, poateSterge, poateMarca, prefixeleExpozitiei, cheileExpozitiei,
  seVedeInFormular, seVedeInCalendar,
} from "./repetitie.mjs";
import { readFileSync } from "node:fs";

let rau = 0;
const e = (nume, bun, info) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + (!bun && info != null ? " -> " + info : ""));
};

const REPETITIE = { showId: "rep-2026", nume: "REPETIȚIE", repetitie: true };
const ADEVARATA = { showId: "resita-2026", nume: "Reșița 2026" };

// ——————————————————————————————————————————————————————————————————
console.log("— ștergerea refuză orice expoziție care nu e marcată ca repetiție —");
{
  e("o repetiție se poate șterge", poateSterge(REPETITIE).ok === true);

  const r = poateSterge(ADEVARATA);
  e("o expoziție ADEVĂRATĂ nu se poate șterge", r.ok === false);
  e("și se răspunde cu 403, nu cu un ok tăcut", r.status === 403, String(r.status));
  e("cu motivul scris pe înțeles", /nu e marcată ca repetiție/i.test(r.eroare));

  const inexistenta = poateSterge(null);
  e("o expoziție inexistentă nu e tratată ca repetiție", inexistenta.ok === false);
  e("și primește 404", inexistenta.status === 404, String(inexistenta.status));
}

console.log("— marcajul NU se pune peste o expoziție care are înscrieri —");
{
  // Paza de la ștergere oprea accidentul dintr-un pas. Nu-l oprea pe cel din DOI: un
  // showId tastat greșit la marcare, apoi curățenia — și dispărea o expoziție adevărată,
  // cu tot cu dovezile de plată.
  e("o expoziție goală se poate marca", poateMarca(ADEVARATA, 0).ok === true);
  const r = poateMarca(ADEVARATA, 137);
  e("una cu înscrieri NU se poate marca", r.ok === false);
  e("și se spune câte are", /137/.test(r.eroare), r.eroare);
  e("cu 409, nu cu 403", r.status === 409, String(r.status));
  e("mesajul trimite omul să verifice showId-ul", /showId/i.test(r.eroare));

  e("o singură înscriere e de ajuns ca să refuze", poateMarca(ADEVARATA, 1).ok === false);
  e("scoaterea marcajului rămâne mereu îngăduită", poateMarca(REPETITIE, 900, false).ok === true);
  e("expoziția nepublicată dă 404", poateMarca(null, 0).status === 404);
}

console.log("— marcajul trebuie să fie exact „true\", nu ceva care seamănă —");
{
  // Dacă marcajul ar fi citit ca valoare adevărată în sens larg, un câmp rămas dintr-o
  // versiune veche („repetitie": "nu") ar deschide ștergerea pe o expoziție adevărată.
  for (const valoare of ["true", 1, "da", "nu", {}, [], "false"]) {
    e(`„repetitie: ${JSON.stringify(valoare)}" NU deschide ștergerea`,
      poateSterge({ repetitie: valoare }).ok === false);
  }
  e("doar „true\" curat", poateSterge({ repetitie: true }).ok === true);
  e("lipsa câmpului înseamnă expoziție adevărată", eRepetitie({}) === false);
}

console.log("— ce mătură ștergerea: tot ce ține de expoziție, nimic din afara ei —");
{
  const p = prefixeleExpozitiei("rep-2026");
  const prefixe = p.map((x) => x.prefix);
  for (const cap of ["coada/", "dovada/", "verificare/", "audit/", "proprietar/"]) {
    e("mătură „" + cap + "\"", prefixe.some((x) => x.startsWith(cap)));
  }
  e("fiecare prefix poartă showId-ul", prefixe.every((x) => x.includes("rep-2026")), prefixe.join(" "));
  e("fiecare prefix se termină cu „/\" — altfel ar prinde și „rep-2026-bis\"",
    prefixe.every((x) => x.endsWith("/")), prefixe.join(" "));

  // Un showId gol ar da prefixe ca „coada//" — sau, la o altă scriere, „coada/", care
  // mătură TOATE expozițiile. Mai bine aruncă decât să șteargă tot.
  let aAruncat = false;
  try { prefixeleExpozitiei(""); } catch { aAruncat = true; }
  e("showId gol => aruncă, nu mătură tot", aAruncat);
  let aAruncatNull = false;
  try { prefixeleExpozitiei(null); } catch { aAruncatNull = true; }
  e("showId lipsă => la fel", aAruncatNull);

  const chei = cheileExpozitiei("rep-2026");
  e("șterge și configurația", chei.includes("config/rep-2026"));
  e("șterge și rezultatele publicate", chei.includes("rezultate/rep-2026"));

  // Prefixele unei expoziții nu trebuie să prindă altă expoziție.
  const altele = prefixeleExpozitiei("resita-2026").map((x) => x.prefix);
  e("prefixele a două expoziții nu se cuprind una pe alta",
    prefixe.every((a) => altele.every((b) => !a.startsWith(b) && !b.startsWith(a))));
}

console.log("— o repetiție nu ajunge sub ochii publicului —");
{
  e("formularul public NU o arată", seVedeInFormular(REPETITIE, false) === false);
  e("formularul o arată cu „?repetitie=1\"", seVedeInFormular(REPETITIE, true) === true);
  e("o expoziție adevărată se vede oricum", seVedeInFormular(ADEVARATA, false) === true);
  e("și cu parametrul pus", seVedeInFormular(ADEVARATA, true) === true);

  e("calendarul NU arată repetiții", seVedeInCalendar(REPETITIE) === false);
  e("calendarul arată expozițiile adevărate", seVedeInCalendar(ADEVARATA) === true);
  // Calendarul nu primește parametrul deloc: e pagina publică a asociației, acolo nu
  // intră o probă în nicio împrejurare.
  e("calendarul nu are cum să fie păcălit de un parametru", seVedeInCalendar.length === 1);
}

// ——— legăturile: regula e chiar FOLOSITĂ, nu doar scrisă ———
console.log("— regulile sunt chemate acolo unde contează —");
{
  const sursa = readFileSync(new URL("../inscriere-expo.mjs", import.meta.url), "utf8");
  e("funcția importă modulul", sursa.includes('from "./_comun/repetitie.mjs"'));
  e("ștergerea cheamă paza", /const verdict = poateSterge\(c\)/.test(sursa));
  e("marcarea cheamă și ea paza ei", /poateMarca\(c, cate, pornit\)/.test(sursa));
  e("marcarea numără înscrierile înainte", /list\(\{ prefix: "coada\/" \+ showId \+ "\/" \}\)/.test(sursa));
  e("dacă numărătoarea cade, socotim că are înscrieri", /cate = 1;/.test(sursa));
  e("și se oprește la refuz", /if \(!verdict\.ok\) return json/.test(sursa));
  e("nu mai există o a doua definiție a marcajului, în funcție",
    !/const eRepetitie = \(config\) =>/.test(sursa));
  e("lista publică folosește regula", sursa.includes("seVedeInFormular(c, cuRepetitii)"));
  e("calendarul folosește regula", sursa.includes("seVedeInCalendar(c)"));
  e("marcajul călătorește cu înscrierea",
    /\.\.\.\(eRepetitie\(config\) \? \{ repetitie: true \} : \{\}\)/.test(sursa));

  const formular = readFileSync(new URL("../../../src/components/InscriereExpo.astro", import.meta.url), "utf8");
  e("formularul citește „?repetitie=1\"",
    /new URLSearchParams\(location\.search\)\.get\("repetitie"\)/.test(formular));
  e("îl trimite mai departe la server", /inscriere-expo" \+ \(eRepetitie \? "\?repetitie=1"/.test(formular));
  e("pune „[REPETIȚIE]\" în lista de expoziții", formular.includes("[REPETIȚIE]"));
  e("are banda de avertizare", formular.includes('id="ie-repetitie"'));

  const script = readFileSync(new URL("../../../scripts/repetitie.mjs", import.meta.url), "utf8");
  e("scriptul se oprește dacă expoziția nu e repetiție",
    /if \(!e\.repetitie\)[\s\S]{0,400}process\.exit\(1\)/.test(script));
  e("valoarea secretului nu ajunge pe ecran",
    !/console\.(log|error)\([^)]*(\$\{secret\}|\+\s*secret\b|,\s*secret\b)/.test(script));
  e("adresele de probă sunt pe example.com (RFC 2606)",
    (script.match(/@example\.com/g) || []).length >= 5);
  e("scenariul are cazuri care TREBUIE respinse",
    (script.match(/cade: true/g) || []).length >= 4);
}

console.log(rau ? rau + " căzute" : "toate trecute");
process.exit(rau ? 1 : 0);
