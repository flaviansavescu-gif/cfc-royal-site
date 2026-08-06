import { valideazaAnunt, nrPui, continePret, expirat } from "../registru-cuiburi.mjs";

let ok = 0, rau = 0;
const t = (n, c, info) => { if (c) { ok++; console.log("  ok  " + n); } else { rau++; console.log("  RAU " + n + (info ? " -> " + info : "")); } };

console.log("— numărul de pui disponibili —");
t("număr valid trece", nrPui("3") === 3);
t("zero e valid", nrPui("0") === 0);
t("negativ devine 0", nrPui("-2") === 0);
t("peste maxim devine 0", nrPui("999") === 0);
t("gunoi devine 0", nrPui("abc") === 0);

console.log("— fără prețuri —");
t("suma în lei prinsă", continePret("pui frumoși, 2000 lei"));
t("euro prins", continePret("500 EUR"));
t("simbol € prins", continePret("preț 1500€"));
t("cuvântul preț prins", continePret("cere prețul pe privat"));
t("notă curată trece", !continePret("cuib sănătos, socializat, disponibili de la 8 săptămâni"));

console.log("— validarea anunțului —");
const bun = valideazaAnunt({ disponibiliM: "2", disponibiliF: "1", nota: "cuib sănătos", contactTelefon: "0712345678" });
t("anunț bun trece", bun.ok === true, bun.eroare);
t("curăță disponibilii", bun.disponibiliM === 2 && bun.disponibiliF === 1);

t("fără pui disponibili respins", !!valideazaAnunt({ disponibiliM: "0", disponibiliF: "0", contactTelefon: "07x" }).eroare);
t("preț în notă respins", !!valideazaAnunt({ disponibiliM: "1", nota: "1500 lei", contactTelefon: "07x" }).eroare);
t("fără contact respins", !!valideazaAnunt({ disponibiliM: "1", nota: "ok" }).eroare);
t("e-mail invalid respins", !!valideazaAnunt({ disponibiliM: "1", contactEmail: "nu-e-email" }).eroare);
t("e-mail valid singur trece", valideazaAnunt({ disponibiliM: "1", contactEmail: "a@b.ro" }).ok === true);
const implicit = valideazaAnunt({ disponibiliM: "1", contactTelefon: "07x" }, "Ion Popescu");
t("numele de contact cade pe numele membrului", implicit.contactNume === "Ion Popescu");

console.log("— expirarea —");
const acum = Date.parse("2026-08-06T00:00:00Z");
t("anunț viitor: neexpirat", expirat({ expiraLa: "2026-11-06T00:00:00Z" }, acum) === false);
t("anunț trecut: expirat", expirat({ expiraLa: "2026-07-06T00:00:00Z" }, acum) === true);
t("fără dată: neexpirat (nu blocăm din greșeală)", expirat({}, acum) === false);

console.log("\n" + ok + " ok, " + rau + " rău");
if (rau) process.exit(1);
