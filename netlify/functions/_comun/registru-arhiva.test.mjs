// Teste pentru curățarea secretelor din copiile de siguranță.
//
// Prima arhivă făcută pe date reale conținea un cod funcțional de registratură, scris
// acolo de o versiune mai veche a codului. O copie de siguranță circulă — ajunge pe un
// disc, pe un e-mail, într-un dosar. Ce iese din ea nu trebuie să deschidă nicio ușă.
//
// Rulează: node netlify/functions/_comun/registru-arhiva.test.mjs
import { faraSecrete } from "./registru-arhiva.mjs";

let ok = 0, rau = 0;
const t = (n, c, info) => { if (c) { ok++; console.log("  ok  " + n); } else { rau++; console.log("  RAU " + n + (info != null ? " -> " + info : "")); } };

console.log("— campurile care deschid usi nu ies in arhiva —");
const fisa = {
  nume: "Registrator Test", email: "r@exemplu.ro", cod: "REG-ABCD2345",
  creat: "2026-07-27T10:00:00.000Z", ultima_logare: "2026-07-27T12:00:00.000Z",
};
const curat = faraSecrete(fisa);
t("codul dispare", !("cod" in curat));
t("numele ramane", curat.nume === "Registrator Test");
t("e-mailul ramane", curat.email === "r@exemplu.ro");
t("datele de intrare raman", curat.ultima_logare === "2026-07-27T12:00:00.000Z");
t("originalul NU e modificat", fisa.cod === "REG-ABCD2345");

for (const camp of ["jeton", "parola", "secret"]) {
  const x = faraSecrete({ nume: "X", [camp]: "valoare-secreta" });
  t("scoate si campul " + camp, !(camp in x));
}

console.log("— nu strica restul —");
t("obiect gol", JSON.stringify(faraSecrete({})) === "{}");
t("null trece nevatamat", faraSecrete(null) === null);
t("sirurile trec nevatamate", faraSecrete("text") === "text");
const dosar = { serie: "CFCR-DMF-2026-0001", pui: [{ nume: "Argo" }], semnatura: "Ion Popescu" };
const d2 = faraSecrete(dosar);
t("declaratia ramane intreaga", d2.serie === "CFCR-DMF-2026-0001" && d2.pui.length === 1);
t("semnatura declarantului NU e un secret si ramane", d2.semnatura === "Ion Popescu");

console.log(`\n${ok} trecute, ${rau} căzute`);
process.exit(rau ? 1 : 0);
