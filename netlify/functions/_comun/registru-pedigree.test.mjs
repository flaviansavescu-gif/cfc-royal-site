// Teste pentru ascendență și tipul certificatului — regulile care decid ce document
// primește omul în mână. Rulează: node netlify/functions/_comun/registru-pedigree.test.mjs
import handler, {
  pozitiiAscendenta, etichetaPozitie, tipCertificat, WDF_ULTIMUL_PE_HARTIE,
  schimbaValabilitatea, MOTIV_MINIM,
} from "../registru-pedigree.mjs";

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
// Tip C: ascendența NU e cunoscută deloc — certificatul de tipicitate de rasă.
// Înainte, un exemplar fără niciun strămoș primea „Tip B", adică „parțial cunoscută":
// actul declara despre sine altceva decât era. Tipicitatea e un traseu propriu, cu
// reguli proprii; confundarea celor două ascunde tocmai ce trebuie să se vadă.
t("ascendenta goala -> Tip C", tipCertificat({}).tip === "C");
t("ascendenta lipsa -> Tip C", tipCertificat(undefined).tip === "C");
t("la Tip C toate cele 30 de pozitii sunt semnalate lipsa",
  tipCertificat({}).lipsa.length === 30, tipCertificat({}).lipsa.length);
t("nume fara numar = pozitie necunoscuta, deci tot Tip C",
  tipCertificat(Object.fromEntries(poz.map(p => [p.cod, { nume: "X", nr: "" }]))).tip === "C");

// Granița dintre C și B: un singur strămoș cunoscut scoate certificatul din tipicitate.
t("un singur stramos cunoscut -> Tip B, nu C",
  tipCertificat({ T: { nume: "Tata", nr: "REG-1" } }).tip === "B");

console.log("— tipicitatea e alt traseu: din DMF nu iese niciodată Tip C —");
// Tip C se acordă în urma unei expoziții, fără declarație de montă. Dacă există o DMF,
// părinții sunt numiți în ea, deci sunt cunoscuți — iar puii sunt cel puțin Tip B.
// Cazul real care scăpa: garda de la emitere cere ca T și M să EXISTE, nu să aibă și
// număr de înregistrare. Un dosar cu părinții scriși doar cu numele trecea garda și
// ieșea „Tip C" — certificat de tipicitate pentru un câine cu părinți cunoscuți.
{
  const doarNumeleParintilor = { T: { nume: "JERY DE LAZDOG", nr: "" }, M: { nume: "FRENCHIE ALISA", nr: "" } };
  t("fara declaratie, ascendenta fara numere ramane Tip C",
    tipCertificat(doarNumeleParintilor).tip === "C");
  t("DIN DECLARATIE, acelasi dosar da Tip B",
    tipCertificat(doarNumeleParintilor, { dinDeclaratie: true }).tip === "B");
  t("din declaratie, ascendenta cu totul goala tot da Tip B",
    tipCertificat({}, { dinDeclaratie: true }).tip === "B");
  // Declarația ridică podeaua la B; nu atinge celelalte tipuri.
  t("din declaratie, ascendenta completa ramane Tip A",
    tipCertificat(complet, { dinDeclaratie: true }).tip === "A");
  t("din declaratie, ascendenta partiala ramane Tip B",
    tipCertificat(doarParinti, { dinDeclaratie: true }).tip === "B");
  // Pozițiile lipsă se raportează la fel: doar eticheta se schimbă, nu constatarea.
  t("lipsurile se numara la fel, cu sau fara declaratie",
    tipCertificat({}, { dinDeclaratie: true }).lipsa.length === 30);
}

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

console.log("— anularea unui certificat emis —");
{
  const emis = () => ({
    serie: "CFCR-P-2026-0001", tip: "A", anulat: false,
    caine: { nume: "Rex", rasa: "Ciobănesc German" },
    crescator: { nume: "Ion Popescu" },
    ascendenta: { T: { nume: "Tata" }, M: { nume: "Mama" } },
  });

  const fara = schimbaValabilitatea(emis(), { anuleaza: true, motiv: "fals" });
  t("motiv prea scurt -> refuzat", !!fara.eroare && !fara.cert, fara.eroare);
  t(`pragul motivului e ${MOTIV_MINIM}`, MOTIV_MINIM === 10, MOTIV_MINIM);

  const a = schimbaValabilitatea(emis(), {
    anuleaza: true, motiv: "Microcipul declarat nu corespunde cu exemplarul",
    deCatre: "administrator", acum: "2026-08-01T10:00:00.000Z",
  });
  t("anularea marcheaza actul, nu-l sterge", a.cert && a.cert.anulat === true && a.cert.serie === "CFCR-P-2026-0001");
  t("ascendenta ramane in act", !!(a.cert && a.cert.ascendenta && a.cert.ascendenta.T));
  t("motivul si autorul se pastreaza", a.cert.anulare.motiv.startsWith("Microcipul") && a.cert.anulare.deCatre === "administrator");
  t("istoricul are o intrare", a.cert.anulariIstoric.length === 1 && a.cert.anulariIstoric[0].fapta === "anulare");

  const dinNou = schimbaValabilitatea(a.cert, { anuleaza: true, motiv: "acelasi lucru inca o data" });
  t("un act deja anulat nu se anuleaza a doua oara", !!dinNou.eroare, dinNou.eroare);

  const r = schimbaValabilitatea(a.cert, {
    anuleaza: false, motiv: "Anularea a fost o eroare de secretariat",
    deCatre: "administrator", acum: "2026-08-02T10:00:00.000Z",
  });
  t("repunerea in vigoare sterge steagul", r.cert.anulat === false && r.cert.anulare === null);
  t("istoricul pastreaza AMBELE fapte", r.cert.anulariIstoric.length === 2 &&
    r.cert.anulariIstoric[1].fapta === "restabilire", JSON.stringify(r.cert.anulariIstoric.map((x) => x.fapta)));
  t("motivul anularii ramane in istoric dupa repunere",
    r.cert.anulariIstoric[0].motiv.startsWith("Microcipul"));

  const r2 = schimbaValabilitatea(r.cert, { anuleaza: false, motiv: "nu era anulat oricum" });
  t("un act neanulat nu se repune in vigoare", !!r2.eroare, r2.eroare);

  t("certificat inexistent -> eroare", !!schimbaValabilitatea(null, { anuleaza: true, motiv: "orice motiv lung" }).eroare);

  // Obiectul primit nu trebuie modificat: apelantul decide ce scrie in magazie.
  const original = emis();
  schimbaValabilitatea(original, { anuleaza: true, motiv: "un motiv suficient de lung" });
  t("obiectul primit ramane neatins", original.anulat === false && original.anulariIstoric === undefined);
}

console.log(`\n${ok} trecute, ${rau} căzute`);
process.exit(rau ? 1 : 0);
