// Recomprimă imaginile supraponderale din public/images, PE LOC, fără schimbarea
// dimensiunilor în pixeli (deci fără nicio modificare de cod sau layout).
//   node _recomprima-imagini.mjs          → probă pe uscat (arată ce-ar face)
//   node _recomprima-imagini.mjs --scrie  → scrie fișierele
// Reguli: > 120 KB; foto webp q72, afișe/bannere cu text q78, jpg q75 (mozjpeg).
// Se scrie DOAR dacă scade cu ≥ 15% — altfel originalul rămâne neatins.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SCRIE = process.argv.includes("--scrie");
const PRAG_KB = 120;
const CASTIG_MIN = 0.15;

// Afișele și bannerele au text mărunt — calitate mai mare, ca literele să rămână curate.
const eText = (f) => /[\\/](afise|bannere)[\\/]/.test(f) || /calendar-expozitional|certificat/.test(f);

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
  );

let inainte = 0, dupa = 0, scrise = 0, sarite = 0;
for (const f of walk("public/images").filter((f) => /\.(webp|jpe?g)$/i.test(f))) {
  const kb = fs.statSync(f).size / 1024;
  if (kb <= PRAG_KB) continue;
  const eWebp = /\.webp$/i.test(f);
  const q = eWebp ? (eText(f) ? 78 : 72) : 75;
  // Sursa se citește în memorie: pe Windows, sharp ține altfel fișierul deschis
  // și suprascrierea aceluiași drum eșuează.
  let s = sharp(fs.readFileSync(f));
  // Fotografiile de galerie din articole coboară la max 1280px pe latura lungă:
  // în grilă apar mici, iar în lightbox 1280 rămâne generos. Documentele (certificat)
  // și restul imaginilor își păstrează dimensiunile.
  if (/[\\/]articole[\\/]/.test(f) && !eText(f))
    s = s.resize(1280, 1280, { fit: "inside", withoutEnlargement: true });
  const buf = eWebp
    ? await s.webp({ quality: q, effort: 6 }).toBuffer()
    : await s.jpeg({ quality: q, mozjpeg: true }).toBuffer();
  const kbNou = buf.length / 1024;
  const castig = 1 - kbNou / kb;
  inainte += kb;
  if (castig >= CASTIG_MIN) {
    dupa += kbNou;
    scrise++;
    if (SCRIE) fs.writeFileSync(f, buf);
    console.log(
      `${SCRIE ? "SCRIS " : "AR SCRIE"}  ${Math.round(kb)}KB -> ${Math.round(kbNou)}KB  (-${Math.round(castig * 100)}%)  q${q}  ${f.split(path.sep).join("/")}`,
    );
  } else {
    dupa += kb;
    sarite++;
    console.log(`PASTRAT   ${Math.round(kb)}KB (câștig doar ${Math.round(castig * 100)}%)  ${f.split(path.sep).join("/")}`);
  }
}
console.log(
  `\nTOTAL: ${Math.round(inainte)}KB -> ${Math.round(dupa)}KB  (${scrise} ${SCRIE ? "scrise" : "de scris"}, ${sarite} păstrate)`,
);
