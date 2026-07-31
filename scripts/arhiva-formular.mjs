// citeste-formular.mjs — cititorul formularelor „Cuib N (...).txt" din arhiva de pedigree.
//
// Formularele au fost scrise de mână, de oameni, în ani diferiți: apar tabulatori, spații
// duble, diacritice puse și nepuse, etichete cu mici abateri. Cititorul trebuie să fie
// îngăduitor la formă și necruțător la fond: ce nu poate citi, SPUNE — nu ghicește și nu
// trece mai departe în tăcere. O înregistrare greșită într-un registru genealogic e mai
// rea decât una lipsă: cea lipsă se vede, cea greșită se moștenește.

/** Textul de după eticheta dată, până la capătul rândului. */
function camp(text, eticheta) {
  const re = new RegExp(eticheta + "\\s*:?\\s*([^\\n]*)", "i");
  const m = re.exec(text);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

/** Diacriticele se scriu în două-trei feluri; le aducem la o formă de comparat. */
const fara = (s) => String(s || "")
  .replace(/[ăâ]/gi, "a").replace(/[îi]/gi, "i").replace(/[șş]/gi, "s").replace(/[țţ]/gi, "t");

/** Data în forma AAAA-LL-ZZ, din „28.05.2025", „08/11/2019" sau „17-01-2026". */
export function dataISO(brut) {
  const m = /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/.exec(String(brut || ""));
  if (!m) return "";
  const [, z, l, a] = m;
  return `${a}-${l.padStart(2, "0")}-${z.padStart(2, "0")}`;
}

/** Microcipul, doar cifre. Formularul îl scrie cu spații sau cratime. */
export function microcip(brut) {
  const c = String(brut || "").replace(/\D/g, "");
  return c.length >= 9 && c.length <= 15 ? c : "";
}

/** Codul WDF individual: WDF.RO150050L25. */
export function codWDF(brut) {
  const m = /WDF\.?\s*RO\s*(\d+)\s*([A-Z]\d{2})?/i.exec(String(brut || ""));
  return m ? ("WDF.RO" + m[1] + (m[2] || "")).toUpperCase() : "";
}

/**
 * Un strămoș, din rândurile de forma:
 *   1a. Tatăl:  Numele câinelui: X / Nr.și Serie Pedigree: Y
 *               Mențiuni (titluri și teste medicale): Z
 */
function stramos(bloc) {
  if (!bloc) return null;
  const m = /Numele c(?:[âa]inelui|[ăa][țt]elei)\s*:\s*([\s\S]*?)\/\s*Nr\.?\s*[șs]?i?\s*Serie Pedigree\s*:\s*([^\n]*)/i.exec(bloc);
  if (!m) return null;
  const nume = m[1].replace(/\s+/g, " ").trim();
  const nr = m[2].replace(/\s+/g, " ").trim();
  const t = /Men[țt]iuni[^:]*:\s*([^\n]*)/i.exec(bloc);
  let titluri = t ? t[1].replace(/\s+/g, " ").trim() : "";
  if (/^[-–_\s]*$/.test(titluri)) titluri = "";
  if (!nume || /^unknown$/i.test(nume)) return null;
  return { nume, nr: /^[-–_\s]*$/.test(nr) ? "" : nr, titluri };
}

/**
 * Harta dintre etichetele formularului și codurile de poziție ale registrului.
 *
 * Codul se citește ca un drum PORNIND DE LA CÂINE: „TM" = mama (M) tatălui (T).
 * Formularul, în schimb, descrie ascendența pornind de la PĂRINȚI: „Generația I" din
 * „LINIA TATĂLUI" sunt părinții tatălui, adică bunicii câinelui. De aici decalajul cu o
 * generație: dacă cineva l-ar transcrie „cum scrie", ar urca toată ascendența cu un rând.
 */
const HARTA = [
  // [prefix linie, eticheta din formular, cod poziție]
  ["T", /^1a\.\s*Tat[ăa]l/im, "TT"],
  ["T", /^1b\.\s*Mama/im, "TM"],
  ["T", /^2a\.\s*Bunicul patern/im, "TTT"],
  ["T", /^2a\.\s*Bunica patern/im, "TTM"],
  ["T", /^2b\.\s*Bunicul matern/im, "TMT"],
  ["T", /^2b\.\s*Bunica matern/im, "TMM"],
  ["T", /^3a\.\s*Str[ăa]bunic patern 1/im, "TTTT"],
  ["T", /^3a\.\s*Str[ăa]bunica patern[ăa] 1/im, "TTTM"],
  ["T", /^3a\.\s*Str[ăa]bunic patern 2/im, "TTMT"],
  ["T", /^3a\.\s*Str[ăa]bunica patern[ăa] 2/im, "TTMM"],
  ["T", /^3b\.\s*Str[ăa]bunic matern 1/im, "TMTT"],
  ["T", /^3b\.\s*Str[ăa]bunica matern[ăa] 1/im, "TMTM"],
  ["T", /^3b\.\s*Str[ăa]bunic matern 2/im, "TMMT"],
  ["T", /^3b\.\s*Str[ăa]bunica matern[ăa] 2/im, "TMMM"],
];

/** Împarte un text în bucăți, fiecare începând de la o etichetă găsită. */
function bucata(text, re) {
  const m = re.exec(text);
  if (!m) return "";
  const de_la = m.index;
  // până la următorul rând care începe cu o cifră+literă (următoarea etichetă) sau separator
  const rest = text.slice(de_la + m[0].length);
  const urm = /\n\s*(?:\d[ab]?\.|[-–]{3,}|\*|=|\+)/.exec(rest);
  return m[0] + (urm ? rest.slice(0, urm.index) : rest.slice(0, 400));
}

/** Ascendența completă, în codurile registrului. */
export function ascendentaDin(text) {
  const asc = {};
  const iT = text.search(/♂?\s*LINIA TAT[ĂA]LUI/i);
  const iM = text.search(/♀?\s*LINIA MAMEI/i);
  const liniaT = iT >= 0 ? text.slice(iT, iM >= 0 ? iM : undefined) : "";
  const liniaM = iM >= 0 ? text.slice(iM) : "";

  for (const [, re, cod] of HARTA) {
    const s = stramos(bucata(liniaT, re));
    if (s) asc[cod] = s;
    const s2 = stramos(bucata(liniaM, re));
    if (s2) asc["M" + cod.slice(1)] = s2;
  }
  return asc;
}

/** Un genitor de gradul I (tatăl / mama cuibului). */
function genitor(bloc) {
  if (!bloc) return null;
  const nume = (/^\s*\*?\s*(?:Masculul care a montat|Femela montat[ăa])[^\n]*?\t+\s*([^\n]+)/im.exec(bloc)
    || /(?:\(Tat[ăa]l\)|\(Mama\))\s*([^\n]+)/i.exec(bloc) || [])[1];
  return {
    nume: (nume || "").replace(/\s+/g, " ").trim(),
    pedigree: camp(bloc, "Nr\\.\\s*Serie Certificat Pedigree"),
    dataNasterii: dataISO(camp(bloc, "Data Na[șs]terii")),
    microcip: microcip(camp(bloc, "Microcip")),
    proprietar: camp(bloc, "Numele proprietarului"),
    wdf: codWDF(bloc),
  };
}

/** Puii, din secțiunea „DETALII DESPRE PUI". */
export function puiDin(text) {
  const i = text.search(/DETALII DESPRE PUI/i);
  if (i < 0) return [];
  const bloc = text.slice(i);
  // fiecare pui începe cu „01. Numele câinelui:"
  const bucati = bloc.split(/\n\s*(?=\d{2}\.\s*Numele c[âa]inelui)/i).slice(1);
  const out = [];
  for (const b of bucati) {
    const nume = (/Numele c[âa]inelui\s*:\s*([^\n]*)/i.exec(b) || [])[1] || "";
    // numele poate avea codul WDF lipit după o liniuță: „Austin  - WDF.RO150030L25"
    const numeCurat = nume.split(/\s+[-–]\s*WDF/i)[0].replace(/\s+/g, " ").trim();
    const sex = (/Sex\s*:\s*([MF])/i.exec(b) || [])[1] || "";
    const culoare = (/Culoare\s*:\s*([^;\n]*)/i.exec(b) || [])[1] || "";
    const varietate = (/Varietate\s*:\s*([^;\n]*)/i.exec(b) || [])[1] || "";
    const tipPar = (/Tip p[ăa]r\s*:\s*([^;\n]*)/i.exec(b) || [])[1] || "";
    const prop = (/Numele viitorului proprietar\s*:\s*([^\n]*)/i.exec(b) || [])[1] || "";
    const adresa = (/Adresa\s*:\s*([^\n]*)/i.exec(b) || [])[1] || "";
    const curata = (v) => { const s = String(v).replace(/\s+/g, " ").trim(); return /^[-–_\s]*$/.test(s) ? "" : s; };
    out.push({
      nume: numeCurat,
      sex: sex.toUpperCase(),
      culoare: curata(culoare),
      varietate: curata(varietate),
      tipPar: curata(tipPar),
      microcip: microcip((/Microcip\s*:\s*([^\n]*)/i.exec(b) || [])[1]),
      proprietar: curata(prop),
      adresa: curata(adresa),
      wdf: codWDF(b),
    });
  }
  return out;
}

/** Citește un formular întreg. Întoarce datele ȘI lista lipsurilor. */
export function citesteFormular(text) {
  const iT = text.search(/Masculul care a montat/i);
  const iM = text.search(/Femela montat[ăa]/i);
  const iSf = text.search(/LINIA TAT[ĂA]LUI/i);
  const blocT = iT >= 0 ? text.slice(iT, iM >= 0 ? iM : iSf) : "";
  const blocM = iM >= 0 ? text.slice(iM, iSf >= 0 ? iSf : undefined) : "";

  const d = {
    numarCuib: camp(text, "Num[ăa]r cuib"),
    rasa: camp(text, "Rasa c[âa]inilor cuprin[șs]i [îi]n DMF"),
    varietate: camp(text, "Varietate"),
    dataMontei: dataISO(camp(text, "Data Montei")),
    dataFatarii: dataISO(camp(text, "Data F[ăa]t[ăa]rii")),
    afix: camp(text, "AFIX CRESC[ĂA]TOR"),
    beneficiar: camp(text, "Beneficiar"),
    mascul: genitor(blocT),
    femela: genitor(blocM),
    ascendenta: ascendentaDin(text),
    pui: puiDin(text),
  };

  // Părinții sunt pozițiile T și M ale ascendenței. În formular ei stau la „detalii
  // genitori grad I", nu în secțiunile de ascendență — care încep de la bunici. Fără
  // pasul ăsta, ascendența ar avea o gaură exact acolo unde e cel mai sigur cunoscută.
  if (d.mascul?.nume) d.ascendenta.T = { nume: d.mascul.nume, nr: d.mascul.pedigree || "", titluri: "" };
  if (d.femela?.nume) d.ascendenta.M = { nume: d.femela.nume, nr: d.femela.pedigree || "", titluri: "" };
  if (/^[-–_\s]*$/.test(d.varietate)) d.varietate = "";

  // Ce lipsește se spune pe față. Nimic nu se completează din presupuneri.
  const lipsuri = [];
  if (!d.rasa) lipsuri.push("rasa");
  if (!d.dataFatarii) lipsuri.push("data fătării");
  if (!d.mascul?.nume) lipsuri.push("numele tatălui");
  if (!d.femela?.nume) lipsuri.push("numele mamei");
  if (!d.pui.length) lipsuri.push("puii");
  d.pui.forEach((p, i) => {
    if (!p.nume) lipsuri.push(`puiul ${i + 1}: nume`);
    if (!p.sex) lipsuri.push(`puiul ${i + 1}: sex`);
    if (!p.microcip) lipsuri.push(`puiul ${i + 1}: microcip`);
    if (!p.wdf) lipsuri.push(`puiul ${i + 1}: cod WDF`);
  });
  return { date: d, lipsuri };
}
