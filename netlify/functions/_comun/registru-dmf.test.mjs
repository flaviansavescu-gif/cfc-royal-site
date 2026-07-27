import { valideazaDeclaratia } from "../registru-dmf.mjs";

let ok = 0, rau = 0;
const t = (n, c, info) => { if (c) { ok++; console.log("  ok  " + n); } else { rau++; console.log("  RAU " + n + (info ? " -> " + info : "")); } };

const membru = { nume: "Ion Popescu", afix: "de Cerna", nrAfix: "AFX025/2026", email: "i@p.ro" };
const zileInUrma = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const parinte = (o) => Object.assign({
  nume: "Rex", pedigree: "CFCR 1234", microcip: "941000024681357",
  dataNasterii: "2022-05-10", proprietar: "Ion Popescu", email: "i@p.ro",
}, o || {});

const pui = (nM, nF) => [
  ...Array.from({ length: nM }, (_, i) => ({ nume: "Pui M" + (i + 1), sex: "M" })),
  ...Array.from({ length: nF }, (_, i) => ({ nume: "Pui F" + (i + 1), sex: "F" })),
];

const baza = (o) => Object.assign({
  rasa: "Ciobănesc German", dataMontei: zileInUrma(100), dataFatarii: zileInUrma(37),
  nascutiM: 3, nascutiF: 2, ramasiM: 3, ramasiF: 2,
  mascul: parinte({ nume: "Tata", email: "tata@x.ro" }),
  femela: parinte({ nume: "Mama" }),
  pui: pui(3, 2),
  consimtaminte: { adn: true, predare60: true, gdpr: true },
}, o || {});

console.log("— cazul bun —");
const bun = valideazaDeclaratia(baza(), membru);
t("declarație validă trece", !bun.eroare, bun.eroare);
t("afixul vine din contul membrului", bun.d && bun.d.afix === "de Cerna");
t("nu e peste termen la 37 de zile", bun.d && bun.d.pesteTermen === false);
t("zilele de la fătare calculate", bun.d && bun.d.zileDeLaFatare === 37, bun.d && bun.d.zileDeLaFatare);

console.log("— termenul —");
const tarziu = valideazaDeclaratia(baza({ dataMontei: zileInUrma(183), dataFatarii: zileInUrma(120) }), membru);
t("peste 90 de zile: TRECE, dar marcat", !tarziu.eroare && tarziu.d.pesteTermen === true, tarziu.eroare);

console.log("— datele —");
t("fătare în viitor respinsă", !!valideazaDeclaratia(baza({ dataFatarii: "2099-01-01" }), membru).eroare);
t("montă după fătare respinsă",
  !!valideazaDeclaratia(baza({ dataMontei: zileInUrma(10), dataFatarii: zileInUrma(37) }), membru).eroare);
t("dată malformată respinsă", !!valideazaDeclaratia(baza({ dataFatarii: "37-11-2025" }), membru).eroare);
t("părinte născut după fătare respins",
  !!valideazaDeclaratia(baza({ mascul: parinte({ dataNasterii: zileInUrma(5), email: "t@x.ro" }) }), membru).eroare);

console.log("— statistica —");
t("rămași > născuți respins", !!valideazaDeclaratia(baza({ ramasiM: 5 }), membru).eroare);
t("zero născuți respins",
  !!valideazaDeclaratia(baza({ nascutiM: 0, nascutiF: 0, ramasiM: 0, ramasiF: 0, pui: [] }), membru).eroare);
const necorelat = valideazaDeclaratia(baza({ pui: pui(2, 2) }), membru);
t("număr de rânduri ≠ statistică respins", !!necorelat.eroare, necorelat.eroare);
const sexGresit = valideazaDeclaratia(baza({ pui: pui(4, 1) }), membru);
t("repartiția pe sexe ≠ statistică respinsă", !!sexGresit.eroare, sexGresit.eroare);
t("rămași < născuți e permis (pui morți)",
  !valideazaDeclaratia(baza({ nascutiM: 4, nascutiF: 3, ramasiM: 3, ramasiF: 2 }), membru).eroare);

console.log("— ordinea cerută de act: întâi masculii —");
const amestecat = valideazaDeclaratia(baza({
  pui: [{ nume: "F1", sex: "F" }, { nume: "M1", sex: "M" }, { nume: "M2", sex: "M" }, { nume: "F2", sex: "F" }, { nume: "M3", sex: "M" }],
}), membru);
t("rândurile amestecate sunt reordonate",
  !amestecat.eroare && amestecat.d.pui.map((p) => p.sex).join("") === "MMMFF",
  amestecat.eroare || (amestecat.d && amestecat.d.pui.map((p) => p.sex).join("")));

console.log("— microcipul părinților —");
t("microcip lipsă la mascul respins",
  !!valideazaDeclaratia(baza({ mascul: parinte({ microcip: "", email: "t@x.ro" }) }), membru).eroare);
t("microcip lipsă la femelă respins",
  !!valideazaDeclaratia(baza({ femela: parinte({ microcip: "" }) }), membru).eroare);
t("microcip de 12 cifre respins",
  !!valideazaDeclaratia(baza({ femela: parinte({ microcip: "123456789012" }) }), membru).eroare);
t("microcip cu spații acceptat",
  !valideazaDeclaratia(baza({ femela: parinte({ microcip: "941 000 024681357" }) }), membru).eroare);
t("puii NU au nevoie de microcip", !valideazaDeclaratia(baza(), membru).eroare);

console.log("— e-mailul proprietarului masculului (faza de confirmare) —");
t("lipsă -> respins", !!valideazaDeclaratia(baza({ mascul: parinte({ email: "" }) }), membru).eroare);
t("invalid -> respins", !!valideazaDeclaratia(baza({ mascul: parinte({ email: "abc" }) }), membru).eroare);
t("la femelă e opțional", !valideazaDeclaratia(baza({ femela: parinte({ email: "" }) }), membru).eroare);

console.log("— consimțămintele —");
for (const c of ["adn", "predare60", "gdpr"]) {
  const cons = { adn: true, predare60: true, gdpr: true };
  cons[c] = false;
  t("fara consimtamant " + c + " -> respins", !!valideazaDeclaratia(baza({ consimtaminte: cons }), membru).eroare);
}

console.log("— câmpuri obligatorii —");
t("fără rasă respins", !!valideazaDeclaratia(baza({ rasa: "" }), membru).eroare);
t("fără nume de pui respins",
  !!valideazaDeclaratia(baza({ pui: [{ nume: "", sex: "M" }, { nume: "b", sex: "M" }, { nume: "c", sex: "M" }, { nume: "d", sex: "F" }, { nume: "e", sex: "F" }] }), membru).eroare);
t("fără pedigree respins", !!valideazaDeclaratia(baza({ femela: parinte({ pedigree: "" }) }), membru).eroare);

console.log("— afixul: din formular, cu fisa de membru ca valoare prestabilita —");
const faraCanisa = { nume: "Ion Popescu", afix: "", nrAfix: "", email: "i@p.ro" };
const scrisDeMana = valideazaDeclaratia(baza({ afix: "de Cerna", nrAfix: "AFX025/2026" }), faraCanisa);
t("membru fara afix in fisa poate scrie unul",
  !scrisDeMana.eroare && scrisDeMana.d.afix === "de Cerna" && scrisDeMana.d.nrAfix === "AFX025/2026",
  scrisDeMana.eroare || (scrisDeMana.d && scrisDeMana.d.afix));
const dinFisa = valideazaDeclaratia(baza(), membru);
t("fara nimic in formular se ia din fisa", dinFisa.d && dinFisa.d.afix === "de Cerna");
const suprascris = valideazaDeclaratia(baza({ afix: "din Banat" }), membru);
t("ce scrie in formular are intaietate", suprascris.d && suprascris.d.afix === "din Banat");
t("afixul ramane optional", !valideazaDeclaratia(baza(), faraCanisa).eroare);

console.log(`\n${ok} trecute, ${rau} căzute`);
process.exit(rau ? 1 : 0);
