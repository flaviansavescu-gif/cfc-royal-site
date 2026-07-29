// Teste pentru ascendență și tipul certificatului — regulile care decid ce document
// primește omul în mână. Rulează: node netlify/functions/_comun/registru-pedigree.test.mjs
import handler, { pozitiiAscendenta, etichetaPozitie, tipCertificat, WDF_ULTIMUL_PE_HARTIE }
  from "../registru-pedigree.mjs";

let ok = 0, rau = 0;
const t = (n, c, info) => { if (c) { ok++; console.log("  ok  " + n); } else { rau++; console.log("  RAU " + n + (info != null ? " -> " + info : "")); } };

console.log("— cele 30 de pozitii —");
const poz = pozitiiAscendenta();
t("30 de pozitii in total", poz.length === 30, poz.length);
t("2 parinti", poz.filter(p => p.generatie === 1).length === 2);
t("4 bunici", poz.filter(p => p.generatie === 2).length === 4);
t("8 strabunici", poz.filter(p => p.generatie === 3).length === 8);
t("16 stra-strabunici", poz.filter(p => p.generatie === 4).length === 16);
t("coduri unice", new Set(poz.map(p => p.cod)).size === 30);
t("lungimea codului = generatia", poz.every(p => p.cod.length === p.generatie));
t("doar literele T si M", poz.every(p => /^[TM]+$/.test(p.cod)));
t("parintii sunt T si M", poz.filter(p => p.generatie === 1).map(p => p.cod).join(",") === "T,M");
t("bunicii in ordinea TT,TM,MT,MM",
  poz.filter(p => p.generatie === 2).map(p => p.cod).join(",") === "TT,TM,MT,MM",
  poz.filter(p => p.generatie === 2).map(p => p.cod).join(","));

console.log("— etichetele —");
t("T = tatal", etichetaPozitie("T") === "tatăl", etichetaPozitie("T"));
t("M = mama", etichetaPozitie("M") === "mama", etichetaPozitie("M"));
// Ultima litera e persoana descrisa; cele dinainte sunt posesorii, in ordine inversa.
t("TM = mama tatalui", etichetaPozitie("TM") === "mama tatălui", etichetaPozitie("TM"));
t("MT = tatal mamei", etichetaPozitie("MT") === "tatăl mamei", etichetaPozitie("MT"));
t("TT = tatal tatalui", etichetaPozitie("TT") === "tatăl tatălui", etichetaPozitie("TT"));
t("MM = mama mamei", etichetaPozitie("MM") === "mama mamei", etichetaPozitie("MM"));
t("MTT = tatal tatalui mamei", etichetaPozitie("MTT") === "tatăl tatălui mamei", etichetaPozitie("MTT"));
t("TMMM = mama mamei mamei tatalui",
  etichetaPozitie("TMMM") === "mama mamei mamei tatălui", etichetaPozitie("TMMM"));
t("TM si MT sunt persoane DIFERITE", etichetaPozitie("TM") !== etichetaPozitie("MT"));

console.log("— tipul certificatului —");
const complet = {};
for (const p of poz) complet[p.cod] = { nume: "Caine " + p.cod, nr: "REG-" + p.cod };
t("toate 30 completate -> Tip A", tipCertificat(complet).tip === "A");
t("fara lipsuri la Tip A", tipCertificat(complet).lipsa.length === 0);

const faraUnNumar = JSON.parse(JSON.stringify(complet));
faraUnNumar.MMMM.nr = "";
const r1 = tipCertificat(faraUnNumar);
t("un singur numar lipsa -> Tip B", r1.tip === "B");
t("pozitia lipsa e semnalata", r1.lipsa.length === 1 && r1.lipsa[0] === "MMMM", r1.lipsa.join(","));

const faraUnNume = JSON.parse(JSON.stringify(complet));
delete faraUnNume.TTTT;
t("o pozitie absenta -> Tip B", tipCertificat(faraUnNume).tip === "B");

const doarParinti = { T: complet.T, M: complet.M };
const r2 = tipCertificat(doarParinti);
t("doar parintii -> Tip B", r2.tip === "B");
t("28 de lipsuri", r2.lipsa.length === 28, r2.lipsa.length);
t("ascendenta goala -> Tip B", tipCertificat({}).tip === "B");
t("ascendenta lipsa -> Tip B", tipCertificat(undefined).tip === "B");
t("nume fara numar nu conteaza",
  tipCertificat(Object.fromEntries(poz.map(p => [p.cod, { nume: "X", nr: "" }]))).tip === "B");

console.log("— numerotarea WDF —");
t("continua dupa cuibul 76 de pe hartie", WDF_ULTIMUL_PE_HARTIE === 76);

console.log("— poarta —");
const cere = (b) => handler(new Request("https://x/y", { method: "POST",
  headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }), {});
const g1 = await cere({ cod: "REG-NUEXISTA", actiune: "ascendenta", id: "x" });
t("cod necunoscut -> 401", g1.status === 401, g1.status);
const g2 = await cere({ actiune: "emite", id: "x" });
t("fara cod -> 401", g2.status === 401, g2.status);
const g3 = await cere({ actiune: "verifica" });
t("verificare publica fara serie -> 400", g3.status === 400, g3.status);
const g4 = await handler(new Request("https://x/y", { method: "GET" }), {});
t("GET -> 405", g4.status === 405, g4.status);

console.log("— fisa publica a cainelui —");
// Doar cazurile care NU ating stocarea: aici nu exista Blobs. Cautarea unei referinte
// inexistente (404) si poarta pentru numarul WDF se verifica pe situl publicat.
const p1 = await cere({ actiune: "caine" });
t("cautare fara referinta -> 400", p1.status === 400, p1.status);

console.log(`\n${ok} trecute, ${rau} căzute`);
process.exit(rau ? 1 : 0);
