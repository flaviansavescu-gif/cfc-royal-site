// arhiva-formular.test.mjs — citirea formularelor de cuib.
//
// Probele de aici păzesc trei greșeli ADEVĂRATE, găsite comparând ce scotea cititorul cu
// ce scrie pe certificatele tipărite. Toate trei sunt de același soi: cititorul lua un
// rând întreg acolo unde rândul conținea două lucruri, și lipea al doilea de primul.
//
//   1. Numele părintelui înghițea codul nostru WDF scris pe același rând:
//      ‹DEEA / WDF.RO150194R22› în loc de ‹DEEA›. Numele ăla ajunge în arborele de
//      origini de pe fișa fiecărui pui, deși pe certificat scrie doar ‹DEEA›.
//      La cuibul 14 din Arhiva 1 s-a și publicat așa.
//   2. Seria de pedigree a tatălui rămânea cu separatorul de la coadă:
//      ‹X/572/06/2023/KM /› în loc de ‹X/572/06/2023/KM›.
//   3. ‹- N/A› (nu există număr) era luat drept număr de pedigree și afișat ca atare sub
//      numele strămoșului. Dar ‹UCHR (RO) N/A› NU e gol: numește registrul.
//
// Rulează: node scripts/arhiva-formular.test.mjs
import { esteGol, faraWDF, serieCurata, citesteFormular } from "./arhiva-formular.mjs";

let rau = 0;
const t = (nume, bun, info) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + (!bun && info != null ? " -> " + info : ""));
};
const egal = (nume, dat, asteptat) => t(nume, dat === asteptat, JSON.stringify(dat) + " ≠ " + JSON.stringify(asteptat));

console.log("— ce înseamnă ‹gol› —");
for (const g of ["", "-", " - ", "–", "—", "_", "N/A", "n/a", "- N/A", "  -  N / A "])
  t(`‹${g}› e gol`, esteGol(g) === true);
for (const plin of ["UCHR (RO) N/A", "ABKC N/A", "RKF 4091390", "0", "COR 441-03/101"])
  t(`‹${plin}› NU e gol`, esteGol(plin) === false);

console.log("\n— codul WDF nu are ce căuta în nume —");
egal("nume cu cod lipit", faraWDF("DEEA / WDF.RO150194R22"), "DEEA");
egal("nume cu spații multiple", faraWDF("Z-BETY VON HAUS ARIANE  / WDF.RO150122L22"), "Z-BETY VON HAUS ARIANE");
egal("nume curat rămâne neatins", faraWDF("ENZO PSIA DOLINA"), "ENZO PSIA DOLINA");
egal("bara din nume nu se taie fără WDF", faraWDF("OLIVER (Stone FCI) / ceva"), "OLIVER (Stone FCI) / ceva");

console.log("\n— seria de pedigree —");
egal("codul WDF lipit după serie", serieCurata("COR 1 10390-23/122 / WDF.RO150121L23"), "COR 1 10390-23/122");
egal("separatorul rămas la coadă", serieCurata("X/572/06/2023/KM /"), "X/572/06/2023/KM");
egal("barele din interior rămân", serieCurata("COR 441-03/101"), "COR 441-03/101");
egal("‹- N/A› devine gol", serieCurata("- N/A"), "");
egal("‹UCHR (RO) N/A› rămâne", serieCurata("UCHR (RO) N/A"), "UCHR (RO) N/A");
egal("‹-› devine gol", serieCurata("-"), "");

console.log("\n— formular întreg (forma cuibului 26) —");
{
  const FORM = [
    "Număr cuib:\t\t26/22-02-2026",
    "Beneficiar: \t\tMUȘETESCU GABRIEL ROMULUS",
    "Rasa câinilor cuprinși în DMF:\tPOODLE",
    "Varietate:\t\t\tTOY",
    "Data Montei:\t\t\t02/07/2025",
    "Data Fătării:\t\t\t01/09/2025",
    "",
    "*Masculul care a montat (Tatăl)\tENZO PSIA DOLINA",
    "Nr. Serie Certificat Pedigree:\tX/572/06/2023/KM\t/  ",
    "Data Nașterii:\t\t\t02/02/2023",
    "Nr. Microcip:\t\t\t900215003497831",
    "Numele proprietarului:\t\tSTAN DANIELA",
    "",
    "*Femela montată (Mama)\t\tDEEA\t\t/\tWDF.RO150194R22",
    "Nr. Serie Certificat Pedigree:\tUCHR (RO) 6198",
    "Data Nașterii:\t\t\t20/11/2022",
    "Nr. Microcip:\t\t\t642099000958161",
    "Numele proprietarului:\t\tMUȘETESCU GABRIEL ROMULUS",
    "",
    "♂ LINIA TATĂLUI:",
    "1a. Tatăl:\tNumele câinelui: OLIVER (Stone FCI) / Nr.și Serie Pedigree:  - N/A",
    "\t\tMențiuni (titluri și teste medicale): -",
    "1b. Mama:\tNumele cățelei:  LORIYA (z Sozvezdiy L'va) / Nr.și Serie Pedigree: TKR III-43810",
    "\t\tMențiuni (titluri și teste medicale): -",
    "2a. Bunicul patern al tatălui:\tNumele câinelui: GENTLY Born Nigel / Nr.și Serie Pedigree: RKF 4091390",
    "\t\tMențiuni (titluri și teste medicale): -",
    "",
    "♀ LINIA MAMEI:",
    "PEDIGREE UCHR",
    "",
    "AFIX CRESCĂTOR: CĂȚELUȘUL POTRIVIT",
    "",
    "DETALII DESPRE PUI:",
    "01. Numele câinelui:\t\t\tCĂȚELUȘUL POTRIVIT - MILO",
    "Sex: M \tCuloare: BROWN; \tVarietate: - ; \t\tTip păr: CURLY COATED",
    "Nr. Microcip:\t\t\t\t642090003875802",
    "Numele viitorului proprietar:\t\tMUȘETESCU GABRIEL ROMULUS",
    "",
    "WDF.RO150195L25",
    "",
    "02. Numele câinelui:\t\t\tCĂȚELUȘUL POTRIVIT - LUKIE",
    "Sex: M \tCuloare: BROWN; \tVarietate: - ; \t\tTip păr: CURLY COATED",
    "Nr. Microcip:\t\t\t\t642090003875819",
    "Numele viitorului proprietar:\t\tDIACONEASA CRISTIAN",
    "",
    "WDF.",
  ].join("\n");

  const { date, lipsuri } = citesteFormular(FORM);

  egal("numele mamei, fără codul WDF", date.femela.nume, "DEEA");
  egal("codul WDF al mamei stă în câmpul lui", date.femela.wdf, "WDF.RO150194R22");
  egal("seria tatălui, fără separator", date.mascul.pedigree, "X/572/06/2023/KM");
  egal("poziția M din ascendență", date.ascendenta.M.nume, "DEEA");
  egal("poziția T din ascendență", date.ascendenta.T.nr, "X/572/06/2023/KM");
  egal("bunicul cu ‹- N/A› nu primește număr", date.ascendenta.TT.nr, "");
  egal("bunicul cu ‹- N/A› își păstrează numele", date.ascendenta.TT.nume, "OLIVER (Stone FCI)");
  egal("varietatea puiului scrisă ‹-› rămâne goală", date.pui[0].varietate, "");

  // Linia mamei lipsește cu totul din formular. Cititorul nu are voie să inventeze
  // poziții acolo: mai bine o ascendență scurtă și adevărată decât una plină și falsă.
  t("linia mamei rămâne necompletată", !date.ascendenta.MT && !date.ascendenta.MM);

  // Puiul fără număr pe formular TREBUIE raportat, nu trecut cu vederea. Numărul lui
  // există doar pe certificatul emis; cine face importul e obligat să-l ia de acolo.
  t("puiul fără cod WDF e semnalat", lipsuri.some((l) => /puiul 2: cod WDF/.test(l)), lipsuri.join(" · "));
  t("puiul cu cod WDF nu e semnalat", !lipsuri.some((l) => /puiul 1: cod WDF/.test(l)));
}

console.log(rau ? `\n  ${rau} probe căzute\n` : "\n  Toate probele au trecut.\n");
process.exit(rau ? 1 : 0);
