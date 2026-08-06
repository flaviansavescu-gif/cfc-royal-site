// breed-date.mjs — datele CFCR Breed Standards Explorer, doar pentru platformă.
//
// DE CE EXISTĂ. Aplicația nu mai e publică: standardele se studiază numai din Școala de
// Arbitraj. Nu ajunge să ascundem butoanele — dacă fișierul de date ar sta la o adresă
// publică, oricine cu linkul l-ar descărca. De aceea datele NU mai sunt un fișier servit
// din `public/`, ci trec prin poarta asta: le primești doar cu un cod valid de lector,
// arbitru sau administrator al Școlii.
//
// POST { cod } -> { ok:true, rol, dataset }   |  401 cod nevalid  |  429 prea multe încercări
import { getStore } from "@netlify/blobs";
import { createRequire } from "node:module";
import { actorDinCod, sha256 } from "./_comun/roluri.mjs";
import { ipClient, verificaLimita, inregistreazaEsec, resetLimita } from "./_comun/limitare.mjs";

// Setul de rase e legat în pachetul funcției (nu e servit public). Îl scrie tot
// `scripts/importa-standarde-wdf.mjs`, dar aici, nu în `public/`.
const require = createRequire(import.meta.url);
const DATASET = require("./_breed/breeds.json");

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

/**
 * Cine cere: administrator, lector (coduri fixe din roluri.mjs) sau arbitru (registrul
 * Colegiului din magazia „cursuri"). Candidații NU au acces aici — aplicația e, deocamdată,
 * pentru cei care predau și arbitrează. (Se poate lărgi la candidați cu o singură linie.)
 */
async function cine(cod) {
  const a = actorDinCod(cod);          // admin | lector | null
  if (a) return { rol: a.rol, nume: a.nume || "" };
  const arb = await getStore("cursuri").get("arbitru/" + sha256(cod), { type: "json" }).catch(() => null);
  if (arb) return { rol: "arbitru", nume: arb.nume || "" };
  return null;
}

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const cod = String(body.cod || "").trim();

  // Limitare pe adresă: fără ea, un cod scurt s-ar putea ghici prin încercări repetate.
  const cheie = ipClient(req);
  const lim = await verificaLimita(cheie);
  if (!lim.permis)
    return json({ eroare: "Prea multe încercări. Reîncearcă peste " + Math.ceil(lim.dupaSecunde / 60) + " minute." }, 429);

  if (!cod) return json({ eroare: "Cod lipsă." }, 400);
  const eu = await cine(cod);
  if (!eu) {
    await inregistreazaEsec(cheie);
    return json({ eroare: "Codul nu deschide aplicația. Intră cu codul tău de lector sau arbitru din Școala de Arbitraj." }, 401);
  }
  await resetLimita(cheie);
  return json({ ok: true, rol: eu.rol, nume: eu.nume, dataset: DATASET });
};
