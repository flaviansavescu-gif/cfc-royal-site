// material-protejat.mjs — servirea paginilor manualului de studiu individual.
//
// DE CE EXISTĂ: manualul NU stă în `public/`. Un fișier din `public/` e accesibil
// oricui îi ghicește adresa — poarta de rol din pagini nu apără fișierele statice.
// Aici paginile sunt imagini private, incluse în pachetul funcției (netlify.toml,
// `included_files`), și pleacă spre browser DOAR după verificarea rolului.
//
// FILIGRANUL se coace în pixeli, pe server, la fiecare cerere: numele cititorului,
// repetat în diagonală, semitransparent. Nu e un strat CSS (acela s-ar șterge din
// devtools într-o secundă) — e parte din imagine. Originalul curat nu ajunge niciodată
// la client. Dacă o pagină apare unde nu trebuie, filigranul spune de la cine a plecat.
//
// Reglaje (variabile de mediu, fără redeploy de cod):
//   FILIGRAN_ACTIV      "0" îl oprește cu totul (implicit: pornit)
//   FILIGRAN_OPACITATE  opacitatea, 0–1 (implicit: 0.04)
//
// POST { actiune:"info", cod?|cid? }        -> { pagini, titlu, module:[...] }
// POST { actiune:"pagina", n, cod?|cid? }   -> image/webp (filigranat)
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getStore } from "@netlify/blobs";
import sharp from "sharp";
import opentype from "opentype.js";
import { rolLaIntrare, sha256 } from "./_comun/roluri.mjs";

const PAGINI = 128;
const TITLU = "Noțiuni de bază în arbitrajul chinologic — manual pentru studiu individual";

// Modulele interne ale manualului (pentru navigare în vizualizator).
const MODULE = [
  { nr: 1, titlu: "Introducere", start: 2, sfarsit: 8 },
  { nr: 2, titlu: "Anatomia câinelui", start: 9, sfarsit: 39 },
  { nr: 3, titlu: "Exteriorul câinelui", start: 40, sfarsit: 81 },
  { nr: 4, titlu: "Dentiția", start: 82, sfarsit: 89 },
  { nr: 5, titlu: "Expoziția canină", start: 90, sfarsit: 102 },
  { nr: 6, titlu: "Metodica de arbitraj", start: 103, sfarsit: 115 },
  { nr: 7, titlu: "Etică și deontologie", start: 116, sfarsit: 121 },
  { nr: 8, titlu: "Sinteze și autoevaluare", start: 122, sfarsit: 128 },
];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

// —— Fișierele incluse în pachet: rădăcina diferă între `netlify dev` și Lambda,
//    așa că încercăm pe rând variantele și o ținem minte pe prima care merge.
let radacina = null;
const RADACINI = [process.cwd(), path.join(process.cwd(), ".."), "/var/task"];
async function citesteFisier(relativ) {
  if (radacina) return readFile(path.join(radacina, relativ));
  let ultima = null;
  for (const r of RADACINI) {
    try {
      const buf = await readFile(path.join(r, relativ));
      radacina = r;
      return buf;
    } catch (err) { ultima = err; }
  }
  throw ultima || new Error("Fișier negăsit: " + relativ);
}

// —— Fontul filigranului: îl transformăm în contururi (path-uri), ca să nu depindem
//    de fonturile sistemului. Lambda nu are fonturi instalate; un <text> SVG ar ieși gol.
let fontPromise = null;
function font() {
  if (!fontPromise) {
    fontPromise = citesteFisier("material-studiu/filigran.ttf").then((buf) =>
      opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
    );
  }
  return fontPromise;
}

// Paginile au toate aceleași dimensiuni, iar cititorul e același pe durata lecturii:
// stratul compus o dată se refolosește la paginile următoare. Fără asta, l-am reconstrui
// (mii de contururi) la fiecare pagină răsfoită.
const cacheStrat = new Map();

/** Stratul de filigran: textul repetat în diagonală, ca un tapet, peste toată pagina. */
async function stratFiligran(text, latime, inaltime, opacitate, culoare) {
  const cheie = [text, latime, inaltime, opacitate, culoare].join("|");
  const gata = cacheStrat.get(cheie);
  if (gata) return gata;
  const f = await font();
  const marime = Math.round(latime / 26);
  const d = f.getPath(text, 0, 0, marime).toPathData(1);
  const latText = f.getAdvanceWidth(text, marime);

  const pasX = latText + marime * 2.2;
  const pasY = marime * 4.5;
  const bucati = [];
  // Grila depășește pagina, ca rotația să nu lase colțuri goale.
  for (let y = -inaltime; y < inaltime * 2; y += pasY) {
    let decalaj = (Math.round(y / pasY) % 2) * (pasX / 2); // rânduri alternate, ca la cărămizi
    for (let x = -latime; x < latime * 2; x += pasX) {
      bucati.push(`<g transform="translate(${Math.round(x + decalaj)},${Math.round(y)})"><path d="${d}"/></g>`);
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${latime}" height="${inaltime}" viewBox="0 0 ${latime} ${inaltime}">` +
    `<g transform="rotate(-30 ${latime / 2} ${inaltime / 2})" fill="${culoare}" fill-opacity="${opacitate}">` +
    bucati.join("") +
    `</g></svg>`;
  // Rasterizăm o singură dată: desenul SVG are mii de contururi, iar redesenarea lui la
  // fiecare pagină ar costa mai mult decât tot restul prelucrării. Suprapunerea unui
  // strat deja rasterizat e ieftină.
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  if (cacheStrat.size > 8) cacheStrat.clear(); // instanța e partajată între cititori
  cacheStrat.set(cheie, buf);
  return buf;
}

/** Cine citește? Numele real ajunge în filigran — de aceea îl luăm din registru, nu din browser. */
async function cititor(body) {
  // Cod individual de candidat (id = amprenta codului, stabilită la intrare).
  const cid = String(body.cid || "").trim();
  if (cid) {
    try {
      const c = await getStore("cursuri").get("candidat/" + cid, { type: "json" });
      if (c) return { rol: "candidat", nume: String(c.nume || "").trim() || "Candidat" };
    } catch (err) {
      console.error("Căutare candidat eșuată:", err);
    }
  }
  // Coduri fixe. `rolLaIntrare` acceptă și codul COMUN de candidați — corect aici,
  // fiindcă materialul e comun; nu acordă niciun drept de administrare.
  const cod = String(body.cod || "").trim();
  if (cod) {
    const r = rolLaIntrare(cod);
    if (r?.rol === "admin") return { rol: "admin", nume: "Administrator CFC-Royal" };
    if (r?.rol === "lector") return { rol: "lector", nume: r.nume };
    if (r?.rol === "acces") return { rol: "acces", nume: "Acces cu cod comun" };
    // Arbitru (membru al Colegiului care nu e lector) — cod individual din registru.
    try {
      const a = await getStore("cursuri").get("arbitru/" + sha256(cod), { type: "json" });
      if (a) return { rol: "arbitru", nume: String(a.nume || "").trim() || "Arbitru" };
    } catch (err) {
      console.error("Căutare arbitru eșuată:", err);
    }
  }
  return null;
}

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const cine = await cititor(body);
  if (!cine) return json({ eroare: "Material disponibil doar cu cod de acces valid." }, 403);

  if (body.actiune === "info") return json({ pagini: PAGINI, titlu: TITLU, module: MODULE });

  if (body.actiune === "pagina") {
    const n = parseInt(body.n, 10);
    if (!Number.isInteger(n) || n < 1 || n > PAGINI) return json({ eroare: "Pagină inexistentă." }, 404);

    let imagine;
    try {
      imagine = await citesteFisier("material-studiu/pagini/p" + String(n).padStart(3, "0") + ".webp");
    } catch (err) {
      console.error("Pagina lipsește din pachet:", err);
      return json({ eroare: "Pagina nu a putut fi citită." }, 500);
    }

    const activ = process.env.FILIGRAN_ACTIV !== "0";
    if (activ) {
      const op = Math.min(1, Math.max(0, parseFloat(process.env.FILIGRAN_OPACITATE ?? "0.04") || 0.04));
      const data = new Date().toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
      const text = `${cine.nume} · ${data}`;
      try {
        const meta = await sharp(imagine).metadata();
        // Paginile manualului au fundal verde închis; un filigran închis ar fi invizibil pe
        // ele. Alegem culoarea după luminanța medie a paginii, ca să se vadă în ambele cazuri.
        const st = await sharp(imagine).stats();
        const [r, g, b] = st.channels;
        const lum = r.mean * 0.299 + g.mean * 0.587 + b.mean * 0.114;
        const culoare = lum < 128 ? "#FFFFFF" : "#0B1F17";
        const strat = await stratFiligran(text, meta.width || 1920, meta.height || 1080, op, culoare);
        imagine = await sharp(imagine)
          .composite([{ input: strat, blend: "over" }])
          .webp({ quality: 82 })
          .toBuffer();
      } catch (err) {
        // Fără filigran nu servim: materialul ar circula nesemnat.
        console.error("Filigran eșuat:", err);
        return json({ eroare: "Materialul nu poate fi afișat momentan." }, 500);
      }
    }

    return new Response(imagine, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Robots-Tag": "noindex, noimageindex",
      },
    });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
};

// Doar pentru teste locale.
export const _test = { stratFiligran, MODULE, PAGINI };
