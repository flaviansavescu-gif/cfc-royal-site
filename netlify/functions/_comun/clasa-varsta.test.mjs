// clasa-varsta.test.mjs — clasa de concurs se dă dupa VARSTA la data expozitiei (Art. 13).
//
// Defectul reparat aici, gasit la auditul din 17.08.2026: cand data nasterii sau data
// expozitiei nu se putea citi, `varstaInLuni` intorcea NaN — iar `NaN < min` si
// `NaN >= max` sunt AMANDOUA false, deci functia raspundea „clasa e buna" pentru ORICE
// clasa. Un caine cu data stricata trecea la Champion sau la Veterani fara nicio piedica,
// intra in catalog, se judeca si putea primi CAC.
//
// Fara varsta nu se poate spune nimic despre clasa: raspunsul corect e refuzul.
//
// Ruleaza: node netlify/functions/_comun/clasa-varsta.test.mjs
import { clasaValida } from "../inscriere-expo.mjs";

let rau = 0;
const t = (nume, bun) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume);
};

const EXPO = "2026-11-01";

console.log("\nClasa fata de varsta (Art. 13)\n");

// Reperele normale — regula trebuie sa ramana cea documentata.
t("18 luni intra la Deschisa", clasaValida("deschisa", "2025-05-01", EXPO));
t("4 luni intra la Baby", clasaValida("baby", "2026-07-01", EXPO));
t("4 luni NU intra la Champion", !clasaValida("champion", "2026-07-01", EXPO));
t("10 ani intra la Veterani", clasaValida("veterani", "2016-11-01", EXPO));
t("9 ani NU intra la Veterani", !clasaValida("veterani", "2017-11-01", EXPO));
t("clasa inexistenta se refuza", !clasaValida("inventata", "2025-05-01", EXPO));

// Miezul: date necitibile. Inainte, TOATE cele de mai jos treceau.
t("data nasterii lipsa se refuza", !clasaValida("champion", "", EXPO));
t("data nasterii aiurea se refuza", !clasaValida("champion", "nu-e-o-data", EXPO));
t("data nasterii null se refuza", !clasaValida("veterani", null, EXPO));
t("data expozitiei lipsa se refuza", !clasaValida("champion", "2025-05-01", ""));
t("data expozitiei aiurea se refuza", !clasaValida("veterani", "2025-05-01", "candva"));
t("amandoua stricate se refuza", !clasaValida("deschisa", undefined, undefined));

// ——— Winner cere caine ADULT: minim 18 luni (regulamentul „Clasa Winner"). ———
// Defect gasit la analiza din 20.08: site-ul avea 15, managerul 18 — cainele de 15-17
// luni trecea de formular, PLATEA, apoi importul il refuza. Probele de mai jos fixeaza
// granita pe regulament, ca cifra sa nu mai poata aluneca in tacere.
t("16 luni NU intra la Winner", !clasaValida("winner", "2025-07-01", EXPO));
t("18 luni intra la Winner", clasaValida("winner", "2025-05-01", EXPO));
t("15 luni intra la Champion (are titlu, alta poarta)", clasaValida("champion", "2025-08-01", EXPO));

// ——— Tabelul site-ului = tabelul managerului (cand managerul exista pe acest disc). ———
// Cele doua tabele traiesc in proiecte diferite si nu se pot importa unul pe altul in CI;
// local insa (unde se lucreaza la amandoua), orice despartire a lor cade aici.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const MANAGER = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "..", "cfcr-expo-manager", "lib", "domeniu.ts");
if (existsSync(MANAGER)) {
  const sursaSite = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "inscriere-expo.mjs"), "utf8");
  const sursaMan = readFileSync(MANAGER, "utf8");
  const tabel = (s) => {
    const out = {};
    for (const m of s.matchAll(/^\s*(\w+):\s*\{\s*min:\s*(\d+),\s*max:\s*(\d+|null)/gm))
      out[m[1]] = m[2] + "/" + m[3];
    return out;
  };
  const site = tabel(sursaSite.slice(sursaSite.indexOf("const VARSTA")));
  const man = tabel(sursaMan.slice(sursaMan.indexOf("VARSTA_CLASA")));
  for (const clasa of Object.keys(man))
    t(`clasa ${clasa}: site (${site[clasa]}) = manager (${man[clasa]})`, site[clasa] === man[clasa]);
} else {
  console.log("  (managerul nu e pe acest disc — comparatia site/manager sarita)");
}

console.log(rau ? `\n${rau} probe cazute\n` : "\nToate probele au trecut\n");
process.exit(rau ? 1 : 0);
