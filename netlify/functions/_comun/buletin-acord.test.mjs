// buletin-acord.test.mjs — regulile consimtamantului pentru buletin.
//
// Ce apara probele de aici (audit 17.08.2026):
//   1. abonarea in DOI pasi — o cerere neconfirmata nu e o abonare, si expira in 48h;
//   2. dovada acordului — textul bifat si versiunea lui, ca sa se poata arata la nevoie;
//   3. dezabonarea dintr-un singur clic — jeton propriu, aleator, per adresa;
//   4. ritmul — nimeni nu poate trimite mii de e-mailuri de confirmare catre adrese straine;
//   5. curatenia — ce promite politica sa se stearga chiar se sterge.
//
// Fara ghilimele romanesti in titluri (regula casei).
//
// Ruleaza: node netlify/functions/_comun/buletin-acord.test.mjs
import {
  TEXT_ACORD, VERSIUNE_ACORD, VALABILITATE_CONFIRMARE_MS, EMAIL_RE,
  normEmail, amprentaEmail, jetonNou, expirat, MAX_CERERI, poateCere,
} from "./buletin-acord.mjs";
import { mascheazaCip, normCip } from "./microcip.mjs";
import { deSters, RETENTIE_DOVADA_MS } from "../buletin-curatenie.mjs";

let rau = 0;
const t = (nume, bun, info) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + (!bun && info != null ? " -> " + info : ""));
};

console.log("\nConsimtamantul pentru buletin\n");

// —— Textul acordului ——
t("textul acordului spune ce se primeste", /buletinul informativ/i.test(TEXT_ACORD));
t("textul acordului spune cum se retrage", /retrage|dezabon/i.test(TEXT_ACORD));
t("textul acordului are versiune", /^\d{4}-\d{2}-\d{2}$/.test(VERSIUNE_ACORD));

// —— Adresa ——
t("adresa se normalizeaza (spatii, majuscule)", normEmail("  Ion@Exemplu.RO ") === "ion@exemplu.ro");
t("adresa valida trece", EMAIL_RE.test("ion@exemplu.ro"));
t("adresa fara domeniu se refuza", !EMAIL_RE.test("ion@exemplu"));
t("adresa cu spatiu se refuza", !EMAIL_RE.test("i on@exemplu.ro"));
t(
  "amprenta nu depinde de scriere",
  amprentaEmail("Ion@Exemplu.RO") === amprentaEmail("ion@exemplu.ro"),
);
t("amprenta e sha256 (64 hex)", /^[a-f0-9]{64}$/.test(amprentaEmail("ion@exemplu.ro")));

// —— Jetoanele ——
const j1 = jetonNou(), j2 = jetonNou();
t("jetonul are 32 de caractere hex", /^[a-f0-9]{32}$/.test(j1));
t("doua jetoane nu se repeta", j1 !== j2);

// —— Termenul cererii ——
const acum = Date.parse("2026-08-17T12:00:00.000Z");
const cuOre = (h) => ({ cerut: new Date(acum - h * 3600e3).toISOString() });
t("cererea de acum 1 ora e valabila", !expirat(cuOre(1), acum));
t("cererea de acum 47 de ore e valabila", !expirat(cuOre(47), acum));
t("cererea de acum 49 de ore a expirat", expirat(cuOre(49), acum));
t("cererea fara data se considera expirata", expirat({ cerut: "" }, acum));
t("termenul e chiar de 48 de ore", VALABILITATE_CONFIRMARE_MS === 48 * 3600e3);

// —— Ritmul cererilor ——
{
  // Magazie de probă: cât îi trebuie lui `poateCere` — get și setJSON.
  const memorie = new Map();
  const s = {
    get: async (k) => memorie.get(k) ?? null,
    setJSON: async (k, v) => { memorie.set(k, v); },
  };
  let treceri = 0;
  for (let i = 0; i < MAX_CERERI + 3; i++) if (await poateCere(s, "amprenta-ip")) treceri++;
  t(`primele ${MAX_CERERI} cereri trec, restul nu`, treceri === MAX_CERERI, "au trecut " + treceri);

  // Alt IP nu e atins de blocarea primului.
  t("alta adresa IP nu e blocata", await poateCere(s, "alta-amprenta"));

  // Dacă magazia cade, cererea trece: apărarea nu devine ea însăși cauza unei căderi.
  const stricata = { get: async () => { throw new Error("magazie cazuta"); }, setJSON: async () => {} };
  t("magazia cazuta nu opreste abonarile", await poateCere(stricata, "x"));
}

// —— Curatenia ——
t("cererea neconfirmata de 3 zile se sterge", deSters(new Date(acum - 72 * 3600e3).toISOString(), VALABILITATE_CONFIRMARE_MS, acum));
t("cererea de 12 ore NU se sterge", !deSters(new Date(acum - 12 * 3600e3).toISOString(), VALABILITATE_CONFIRMARE_MS, acum));
t("dovada retrasa acum 4 ani se sterge", deSters(new Date(acum - 4 * 365 * 24 * 3600e3).toISOString(), RETENTIE_DOVADA_MS, acum));
t("dovada retrasa acum 1 an NU se sterge", !deSters(new Date(acum - 365 * 24 * 3600e3).toISOString(), RETENTIE_DOVADA_MS, acum));
t("fara data, nu se sterge nimic", !deSters(null, RETENTIE_DOVADA_MS, acum) && !deSters("candva", RETENTIE_DOVADA_MS, acum));

console.log("\nMicrocipul in raspunsurile publice\n");

t("cipul iese mascat, cu ultimele 4 cifre", mascheazaCip("985141001234821") === "···········4821");
t("cratimele si spatiile nu incurca masca", mascheazaCip("985-141 001234821") === "···········4821");
t("un cip gol ramane gol", mascheazaCip("") === "" && mascheazaCip(null) === "");
t("un cip foarte scurt se ascunde tot", mascheazaCip("123") === "···");
t("masca nu are cum sa arate mai mult de 4 cifre", (mascheazaCip("985141001234821").match(/\d/g) || []).length === 4);
t("forma de lucru ramane intreaga", normCip("985-141 001234821") === "985141001234821");

console.log(rau ? `\n${rau} probe cazute\n` : "\nToate probele au trecut\n");
process.exit(rau ? 1 : 0);
