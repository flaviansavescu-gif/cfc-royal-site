// material-curs.mjs — suporturile de curs ale lectorilor, servite doar cu cod de platformă.
//
// DE CE EXISTĂ. Fișierele astea stăteau în `public/cursuri-materiale/`, adică erau
// descărcabile de oricine le nimerea adresa: `cfc-royal.ro/cursuri-materiale/<lector>/
// <fisier>.pdf`. Paginile Școlii aveau poartă de rol, fișierele nu — iar o poartă pusă
// pe pagină nu apără nimic dacă lucrul de apărat se poate lua direct. Singura măsură era
// un `Disallow` în robots.txt, care nu e o măsură: le ascunde de motoarele de căutare
// politicoase, nu de oameni.
//
// Aceeași soluție ca la manualul de studiu individual: fișierele NU se mai publică (nu
// sunt în `dist/`), ci se includ în pachetul funcției (netlify.toml, `included_files`),
// iar funcția le dă numai după verificarea rolului.
//
// FĂRĂ FILIGRAN, spre deosebire de manual. Manualul e un material cu drepturi ale
// altcuiva, care nu are voie să circule; suporturile de curs sunt scrise de lectorii
// noștri pentru cursanții noștri — nu vrem să le urmărim, vrem doar să nu fie publice.
//
// POST { actiune:"fisier", fisier:"<lector>/<nume>.pdf", cod?|cid? } -> fișierul
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { cititorCursuri } from "./_comun/cititor-cursuri.mjs";

const RADACINA_MATERIALE = "cursuri-materiale";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

/** Rădăcina pachetului diferă între `netlify dev` și Lambda — o găsim o dată. */
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

const TIPURI = {
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * Calea cerută, curățată. DOUĂ apărări, nu una:
 *   1. forma — exact „<dosar>/<fisier>.<ext>", numai caractere sigure, o singură bară.
 *      Aici cad din start „..", barele inverse, caracterele codificate procentual.
 *   2. rezultatul — după alipire, calea rezolvată trebuie să rămână SUB dosarul
 *      materialelor. E plasa de siguranță pentru cazul în care regula de mai sus s-ar
 *      dovedi într-o zi mai îngăduitoare decât credem.
 *
 * @returns {string|null} calea relativă bună de citit, sau `null`
 */
export function caleSigura(cerut) {
  const c = String(cerut || "").trim().replace(/^\/+/, "").replace(/^cursuri-materiale\//, "");
  if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9._-]*\.(pdf|md|txt)$/i.test(c)) return null;
  if (c.includes("..")) return null;

  const baza = path.resolve(RADACINA_MATERIALE);
  const tinta = path.resolve(path.join(RADACINA_MATERIALE, c));
  if (tinta !== baza && !tinta.startsWith(baza + path.sep)) return null;
  return path.join(RADACINA_MATERIALE, c);
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const cine = await cititorCursuri(body);
  if (!cine) return json({ eroare: "Materialele de curs sunt disponibile doar cu cod de acces valid." }, 403);

  const relativ = caleSigura(body.fisier);
  if (!relativ) return json({ eroare: "Material inexistent." }, 400);

  let buf;
  try {
    buf = await citesteFisier(relativ);
  } catch (err) {
    console.error("Material de curs negăsit:", relativ, err);
    return json({ eroare: "Material inexistent." }, 404);
  }

  const ext = path.extname(relativ).toLowerCase();
  return new Response(buf, {
    headers: {
      "Content-Type": TIPURI[ext] || "application/octet-stream",
      // `inline`: se deschide în cititorul browserului, ca înainte. Numele rămâne cel
      // real, ca omul să știe ce a deschis dacă îl salvează.
      "Content-Disposition": `inline; filename="${path.basename(relativ)}"`,
      "Cache-Control": "private, max-age=0, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
});
