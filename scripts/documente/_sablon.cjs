/**
 * _sablon.cjs — cărămizile comune ale documentelor de ședință.
 *
 * DE CE EXISTĂ. Aceleași o sută de rânduri — antetul cu siglele, casetele colorate,
 * tabelele, articolele numerotate — au fost scrise de trei ori, pentru trei documente.
 * A patra oară s-ar fi despărțit: unul cu marginea de 1270, altul de 1300, și n-ar mai fi
 * arătat a acte ale aceleiași asociații.
 *
 * Ce se schimbă aici se schimbă în toate documentele deodată. Ăsta e și rostul, și
 * primejdia: înainte de a umbla la marginea paginii, regenerează-le pe toate.
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, Header, Footer, PageNumber,
} = require("docx");

// Paleta asociației, aceeași ca pe site (src/styles/tokens.css) și ca pe certificate.
const VERDE = "1F4D3A", AURIU = "9C7A2E", ROSU = "8C1D2F", GRI = "5A5F5C";
const MARCA = "C:/FLAVIAN/Asociația Chinologică CARAȘ-SEVERIN/cfcr-expo-manager/public/marca";

const LAT = 9360;   // lățimea utilă a paginii A4 cu marginile de mai jos, în DXA

/** Un fragment de text: șir simplu sau { text, bold, italics, color }. */
const R = (b, size) => (typeof b === "string"
  ? new TextRun({ text: b, size })
  : new TextRun({ size, ...b }));

/** Paragraf obișnuit. */
const px = (b, o = {}) => new Paragraph({
  spacing: { after: o.after ?? 120, line: 290 },
  indent: o.indent, alignment: o.align,
  children: (Array.isArray(b) ? b : [b]).map((x) => R(x, o.size ?? 20)),
});

/** Alineat: „(1) …" — forma din toate regulamentele casei. */
const al = (n, b) => px([{ text: "(" + n + ") " }, ...(Array.isArray(b) ? b : [b])]);

/** Literă: „a) …", retrasă. */
const lit = (l, b) => px([{ text: l + ") " }, ...(Array.isArray(b) ? b : [b])],
  { indent: { left: 340 }, after: 80 });

/** Rând gol, când trebuie aer între un tabel și ce urmează. */
const gol = (a = 120) => new Paragraph({ spacing: { after: a }, children: [] });

const capitol = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 190 }, keepNext: true,
  border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: AURIU, space: 6 } },
  children: [new TextRun({ text: t, size: 26, bold: true, color: VERDE, font: "Georgia" })],
});

const articol = (nr, t) => new Paragraph({
  heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 110 }, keepNext: true,
  children: [
    new TextRun({ text: "Art. " + nr + ". ", size: 22, bold: true, color: AURIU, font: "Georgia" }),
    new TextRun({ text: t, size: 22, bold: true, color: VERDE, font: "Georgia" }),
  ],
});

/**
 * Loc de hotărât de Consiliu: roșu, în paranteze unghiulare.
 * Se vede de la doi metri — tocmai ca să nu pățească ce a pățit Codul Etic, publicat cu
 * „[data]” în el.
 */
const H = (x) => ({ text: "\u27E8" + x + "\u27E9", bold: true, color: ROSU });

/** Casetă cu bară colorată la stânga, pentru ce nu are voie să treacă neobservat. */
const caseta = (randuri, culoare = VERDE, fond = "F6FAF7") => new Table({
  columnWidths: [LAT], width: { size: LAT, type: WidthType.DXA },
  borders: {
    top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE },
    left: { style: BorderStyle.SINGLE, size: 18, color: culoare },
  },
  rows: [new TableRow({ children: [new TableCell({
    width: { size: LAT, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: fond },
    margins: { top: 150, bottom: 150, left: 220, right: 220 },
    children: randuri.map((r, i) => new Paragraph({
      spacing: { after: i === randuri.length - 1 ? 0 : 90, line: 290 },
      children: (Array.isArray(r) ? r : [r]).map((x) => R(x, 20)),
    })),
  })] })],
});

/** Tabel cu antet verde. Lățimile trebuie să însumeze lățimea tabelului. */
const tabel = (capete, randuri, latimi) => new Table({
  columnWidths: latimi, width: { size: latimi.reduce((a, b) => a + b, 0), type: WidthType.DXA },
  borders: {
    top: { style: BorderStyle.SINGLE, size: 4, color: "BFC7C2" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "BFC7C2" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "BFC7C2" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "BFC7C2" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "D5DBD7" },
    insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "D5DBD7" },
  },
  rows: [
    new TableRow({ tableHeader: true, children: capete.map((c, i) => new TableCell({
      width: { size: latimi[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: VERDE },
      margins: { top: 100, bottom: 100, left: 130, right: 130 },
      children: [new Paragraph({ children: [new TextRun({ text: c, size: 18, bold: true, color: "FFFFFF" })] })],
    })) }),
    ...randuri.map((r) => new TableRow({ children: r.map((c, i) => new TableCell({
      width: { size: latimi[i], type: WidthType.DXA },
      margins: { top: 100, bottom: 100, left: 130, right: 130 },
      children: [new Paragraph({
        spacing: { line: 275 },
        children: (Array.isArray(c) ? c : [c]).map((x) => R(x, 18)),
      })],
    })) })),
  ],
});

/** Rândul de semnături de la finalul actelor de ședință. */
const semnaturi = () => px(
  "Președinte: ...........................................          " +
  "Secretar de ședință: ...........................................          Data: ......................");

/**
 * Documentul întreg. Titlul, subtitlul și cuprinsul vin de la cel care cheamă;
 * antetul, subsolul, marginile și fonturile sunt aceleași pentru toate.
 */
function actDeSedinta({ titlu, titlu2, subtitlu, subsolText, proiect = true, cuprins }) {
  const sigla = fs.readFileSync(MARCA + "/cfcr.png");
  const siglaWdf = fs.readFileSync(MARCA + "/wdf.png");

  const antet = new Header({ children: [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [
      new ImageRun({ type: "png", data: sigla, transformation: { width: 42, height: 42 } }),
      new TextRun({ text: "    ", size: 20 }),
      new ImageRun({ type: "png", data: siglaWdf, transformation: { width: 85, height: 35 } }),
    ] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 30 }, children: [new TextRun({
      text: "ASOCIAȚIA CLUB FEDERAL CHINOLOGIC – ROYAL",
      size: 16, bold: true, color: VERDE, characterSpacing: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: AURIU, space: 6 } },
      children: [new TextRun({ text: subtitlu, size: 14, color: GRI })] }),
  ] });

  const subsol = new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: "D5DBD7", space: 6 } },
    children: [
      new TextRun({ text: subsolText + "          ", size: 14, color: GRI }),
      new TextRun({ children: ["pag. ", PageNumber.CURRENT, " din ", PageNumber.TOTAL_PAGES], size: 14, color: GRI }),
    ],
  })] });

  const cap = [];
  if (proiect) cap.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 160, after: 60 },
    children: [new TextRun({ text: "PROIECT", size: 22, bold: true, color: ROSU, characterSpacing: 40 })] }));
  for (const t of [titlu, titlu2].filter(Boolean)) cap.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: t, size: 30, bold: true, color: VERDE, font: "Georgia" })] }));

  return new Document({
    creator: "Asociația Club Federal Chinologic – Royal",
    title: (proiect ? "PROIECT — " : "") + titlu + (titlu2 ? " " + titlu2 : ""),
    description: "Document de lucru pentru dezbaterea Consiliului Director",
    styles: { default: { document: { run: { font: "Calibri", size: 20, color: "1A1A1A" } } } },
    sections: [{
      properties: { page: {
        size: { width: 11906, height: 16838 },   // A4
        margin: { top: 1900, bottom: 1250, left: 1270, right: 1270, header: 540, footer: 540 },
      } },
      headers: { default: antet }, footers: { default: subsol },
      children: [...cap, ...cuprins],
    }],
  });
}

/** Scrie documentul unde spune primul argument din linia de comandă. */
async function scrie(doc, cale) {
  if (!cale) { console.error("Spune unde să scriu documentul."); process.exit(1); }
  const b = await Packer.toBuffer(doc);
  fs.writeFileSync(cale, b);
  console.log("scris:", cale, "(" + Math.round(b.length / 1024) + " KB)");
}

module.exports = {
  VERDE, AURIU, ROSU, GRI, LAT,
  px, al, lit, gol, capitol, articol, H, caseta, tabel, semnaturi,
  actDeSedinta, scrie,
  AlignmentType, Paragraph, TextRun,
};
