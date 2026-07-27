// Teste pentru regula de vârstă a ciornelor.
//
// DE CE. Am spus proprietarului că butonul de curățenie va șterge ciorna abandonată.
// N-a șters-o — era de aceeași zi, iar pragul e de o săptămână. Regula era corectă
// (nu vrei să ștergi formularul cuiva care tocmai îl completează), promisiunea nu.
// Testul ăsta fixează ce face de fapt, ca să nu mai spun altceva.
//
// Rulează: node netlify/functions/_comun/curatenie.test.mjs
import { CIORNA_ABANDONATA_MS } from "../registru-acces.mjs";

let ok = 0, rau = 0;
const t = (n, c, info) => { if (c) { ok++; console.log("  ok  " + n); } else { rau++; console.log("  RAU " + n + (info != null ? " -> " + info : "")); } };

// Aceeași socoteală ca în curataMagazia(), pe date, nu pe magazie.
const eAbandonata = (creat, acum) => (acum - Date.parse(creat)) >= CIORNA_ABANDONATA_MS;
const cuZileInUrma = (n, acum) => new Date(acum - n * 86400e3).toISOString();
const ACUM = Date.parse("2026-07-27T12:00:00.000Z");

console.log("— pragul —");
t("pragul e de 7 zile", CIORNA_ABANDONATA_MS === 7 * 24 * 3600e3, CIORNA_ABANDONATA_MS);

console.log("— ce NU se atinge —");
t("ciorna de azi ramane", !eAbandonata(cuZileInUrma(0, ACUM), ACUM));
t("ciorna de ieri ramane", !eAbandonata(cuZileInUrma(1, ACUM), ACUM));
t("ciorna de 6 zile ramane", !eAbandonata(cuZileInUrma(6, ACUM), ACUM));
t("ciorna de fix 6 zile si 23 de ore ramane",
  !eAbandonata(new Date(ACUM - (7 * 86400e3 - 3600e3)).toISOString(), ACUM));

console.log("— ce se sterge —");
t("ciorna de fix 7 zile se sterge", eAbandonata(cuZileInUrma(7, ACUM), ACUM));
t("ciorna de 8 zile se sterge", eAbandonata(cuZileInUrma(8, ACUM), ACUM));
t("ciorna de o luna se sterge", eAbandonata(cuZileInUrma(30, ACUM), ACUM));

console.log("— ziua de la care se poate sterge, aratata omului —");
const creat = "2026-07-27T10:33:46.001Z";
const de = new Date(Date.parse(creat) + CIORNA_ABANDONATA_MS).toISOString().slice(0, 10);
t("ciorna de azi (27 iulie) se poate sterge de pe 3 august", de === "2026-08-03", de);

console.log("— data lipsa nu trebuie sa duca la stergere —");
// Fara `creat`, Date.parse da NaN, iar comparatia e falsa: ciorna ramane. Mai bine
// ramane un fisier in plus decat sa dispara dosarul cuiva din cauza unei date lipsa.
t("ciorna fara data NU se sterge", !eAbandonata(undefined, ACUM));
t("ciorna cu data stricata NU se sterge", !eAbandonata("nu-e-o-data", ACUM));

console.log(`\n${ok} trecute, ${rau} căzute`);
process.exit(rau ? 1 : 0);
