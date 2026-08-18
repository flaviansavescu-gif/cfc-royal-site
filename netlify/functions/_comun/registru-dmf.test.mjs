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
  // Ceruta de Regulamentul de crestere (Art. 9 alin. 2) la montele de dupa 13.08.2026.
  // Sta in baza ca probele cu date RELATIVE (zileInUrma) sa nu cada cand calendarul
  // trece pragul — fara ea, "zileInUrma(100)" ar deveni intr-o zi o monta post-regulament.
  fatareCezariana: "nu",
  consimtaminte: { adn: true, predare60: true, gdpr: true, semnatura: true },
  semnatura: "Ion Popescu",
}, o || {});

console.log("— cazul bun —");
const bun = valideazaDeclaratia(baza(), membru);
t("declarație validă trece", !bun.eroare, bun.eroare);
t("afixul vine din contul membrului", bun.d && bun.d.afix === "de Cerna");
t("nu e peste termen la 37 de zile", bun.d && bun.d.pesteTermen === false);
t("zilele de la fătare calculate", bun.d && bun.d.zileDeLaFatare === 37, bun.d && bun.d.zileDeLaFatare);

console.log("— cezariana (Art. 9 din Regulamentul de crestere si sanatate) —");
{
  // O monta sigur DUPA intrarea in vigoare (13.08.2026) si o fatare care nu e nici in
  // viitor, nici inaintea montei. Ordinea datelor conteaza, nu durata gestatiei.
  const dupa = { dataMontei: "2026-08-14", dataFatarii: zileInUrma(1) };
  const fara = valideazaDeclaratia(baza({ ...dupa, fatareCezariana: "" }), membru);
  t("monta post-regulament fara rubrica cezarienei e respinsa", !!fara.eroare && /cezarian/.test(fara.eroare), fara.eroare);
  const cuDa = valideazaDeclaratia(baza({ ...dupa, fatareCezariana: "da" }), membru);
  t("„da” se pastreaza ca adevarat", !cuDa.eroare && cuDa.d.fatareCezariana === true, cuDa.eroare);
  const cuNu = valideazaDeclaratia(baza(dupa), membru);
  t("„nu” se pastreaza ca fals", !cuNu.eroare && cuNu.d.fatareCezariana === false, cuNu.eroare);
  const veche = valideazaDeclaratia(baza({ dataMontei: "2026-06-01", dataFatarii: "2026-08-05", fatareCezariana: "" }), membru);
  t("monta dinaintea regulamentului nu cere rubrica (Art. 27)", !veche.eroare && veche.d.fatareCezariana === null, veche.eroare);
  const motiv = valideazaDeclaratia(baza({ ...dupa, motivSelectie: "Fixarea tipului de cap." }), membru);
  t("motivul de selectie se pastreaza in declaratie", !motiv.eroare && motiv.d.motivSelectie === "Fixarea tipului de cap.", motiv.eroare);
}

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
  const cons = { adn: true, predare60: true, gdpr: true, semnatura: true };
  cons[c] = false;
  t("fara consimtamant " + c + " -> respins", !!valideazaDeclaratia(baza({ consimtaminte: cons }), membru).eroare);
}

console.log("— semnatura, care tine locul celei olografe —");
t("fara bifa de semnatura -> respins",
  !!valideazaDeclaratia(baza({ consimtaminte: { adn: true, predare60: true, gdpr: true, semnatura: false } }), membru).eroare);
t("fara nume scris -> respins", !!valideazaDeclaratia(baza({ semnatura: "" }), membru).eroare);
t("doar prenume -> respins", !!valideazaDeclaratia(baza({ semnatura: "Ion" }), membru).eroare);
t("nume prea scurt -> respins", !!valideazaDeclaratia(baza({ semnatura: "I P" }), membru).eroare);
const semnat = valideazaDeclaratia(baza({ semnatura: "  Ion Popescu  " }), membru);
t("nume complet -> acceptat si curatat",
  !semnat.eroare && semnat.d.semnatura === "Ion Popescu", semnat.eroare || (semnat.d && "[" + semnat.d.semnatura + "]"));

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

console.log("— poarta chinotehnistului (asociatii afiliate) —");
{
  const handler = (await import("../registru-dmf.mjs")).default;
  const cere = (b) => handler(new Request("https://x/y", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }), {});
  // Fara cod, niciuna dintre actiunile de depunere nu raspunde cu succes.
  for (const actiune of ["ciorna-noua", "depune", "mele"]) {
    const r = await cere({ actiune });
    t("actiunea " + actiune + " fara cod e refuzata", r.status === 401 || r.status === 403, "status " + r.status);
  }
  // Sursa trebuie sa lege lista chinotehnistului de SLUGUL ASOCIATIEI, nu de persoana:
  // spatiul e al asociatiei — regresia ar rupe exact intelegerea cu Membrii Colectivi.
  const { readFileSync } = await import("node:fs");
  const sursa = readFileSync(new URL("../registru-dmf.mjs", import.meta.url), "utf8");
  t("lista afiliatilor e pe slugul asociatiei", sursa.includes('"dmf-afiliat/" + eu.chinotehnist.asociatieSlug'));
  t("dosarul poarta provenienta depunerii", sursa.includes('fel: "chinotehnist"'));
  t("cotizatia nu se cere chinotehnistului la depunere",
    /eu\.rol === "membru" && !eu\.membru\.cotizatieLaZi/.test(sursa));
}

console.log(`\n${ok} trecute, ${rau} căzute`);
process.exit(rau ? 1 : 0);
