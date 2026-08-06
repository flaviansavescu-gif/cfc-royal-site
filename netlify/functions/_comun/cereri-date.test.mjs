import { valideazaCerere, tipValid, termenDin, TIPURI, STARI } from "../cereri-date.mjs";

let ok = 0, rau = 0;
const t = (n, c, info) => { if (c) { ok++; console.log("  ok  " + n); } else { rau++; console.log("  RAU " + n + (info ? " -> " + info : "")); } };

console.log("— tipuri de drepturi —");
t("acces e valid", tipValid("acces"));
t("stergere e valid", tipValid("stergere"));
t("retragere-consimtamant e valid", tipValid("retragere-consimtamant"));
t("tip inventat respins", !tipValid("altceva"));
t("7 drepturi în nomenclator", Object.keys(TIPURI).length === 7, Object.keys(TIPURI).length);

console.log("— validarea cererii —");
const bun = valideazaCerere({ tip: "acces", nume: "Ion Popescu", email: "ion@exemplu.ro", descriere: "Vreau să văd ce date aveți." });
t("cerere bună trece", bun.ok === true, bun.eroare);
t("câmpuri curățate", bun.tip === "acces" && bun.nume === "Ion Popescu");

t("fără tip respins", !!valideazaCerere({ nume: "Ion", email: "a@b.ro", descriere: "ceva anume" }).eroare);
t("tip necunoscut respins", !!valideazaCerere({ tip: "x", nume: "Ion", email: "a@b.ro", descriere: "ceva anume" }).eroare);
t("nume gol respins", !!valideazaCerere({ tip: "acces", nume: "", email: "a@b.ro", descriere: "ceva anume" }).eroare);
t("e-mail invalid respins", !!valideazaCerere({ tip: "acces", nume: "Ion", email: "nu-e-email", descriere: "ceva anume" }).eroare);
t("descriere prea scurtă respinsă", !!valideazaCerere({ tip: "acces", nume: "Ion", email: "a@b.ro", descriere: "x" }).eroare);

console.log("— termenul de 30 de zile —");
const creat = "2026-08-06T00:00:00.000Z";
const termen = termenDin(creat);
t("termen = creat + 30 zile", termen.slice(0, 10) === "2026-09-05", termen);
t("dată malformată nu aruncă", typeof termenDin("aiurea") === "string");

console.log("— stările registraturii —");
t("in-lucru mapează la faptă", STARI["in-lucru"] === "dsar-in-lucru");
t("rezolvata mapează la faptă", STARI["rezolvata"] === "dsar-rezolvata");
t("refuzata mapează la faptă", STARI["refuzata"] === "dsar-refuzata");
t("stare inventată nu există", !STARI["altceva"]);

console.log("\n" + ok + " ok, " + rau + " rău");
if (rau) process.exit(1);
