// breed-date.mjs — datele Explorator de standarde CFC-Royal, doar pentru platformă.
//
// DE CE EXISTĂ. Aplicația nu mai e publică: standardele se studiază numai din Școala de
// Arbitraj. Nu ajunge să ascundem butoanele — dacă fișierul de date ar sta la o adresă
// publică, oricine cu linkul l-ar descărca. De aceea datele NU mai sunt un fișier servit
// din `public/`, ci trec prin poarta asta: le primești doar cu un cod valid de lector,
// arbitru sau administrator al Școlii.
//
// POST { cod } -> { ok:true, rol, dataset }   |  401 cod nevalid  |  429 prea multe încercări
import { getStore } from "@netlify/blobs";
import { rolLaIntrare, sha256 } from "./_comun/roluri.mjs";
import { ipClient, verificaLimita, inregistreazaEsec, resetLimita } from "./_comun/limitare.mjs";

// Setul de rase e ÎNCORPORAT în pachetul funcției la construire (import static de JSON,
// pe care bundler-ul îl inline-uiește) — nu e un fișier servit public. Îl scrie tot
// `scripts/importa-standarde-wdf.mjs`, dar în netlify/functions/_breed, nu în `public/`.
import DATASET from "./_breed/breeds.json" with { type: "json" };
import { json } from "./_comun/raspuns.mjs";

/**
 * Cine cere: oricine e în platforma Școlii de Arbitraj — administrator, lector, arbitru
 * ȘI candidat (cod individual sau codul comun de candidați). Aplicația e un instrument de
 * studiu: are sens s-o folosească și cei care se pregătesc, nu doar cei care predau.
 * NU au acces cei DIN AFARA platformei — asta e toată rostul porții.
 */
async function cine(cod) {
  const r = rolLaIntrare(cod);         // admin | lector | acces (codul comun de candidați) | null
  if (r) return { rol: r.rol === "acces" ? "candidat" : r.rol, nume: r.nume || "" };
  const s = getStore("cursuri");
  const arb = await s.get("arbitru/" + sha256(cod), { type: "json" }).catch(() => null);
  if (arb) return { rol: "arbitru", nume: arb.nume || "" };
  const cand = await s.get("candidat/" + sha256(cod), { type: "json" }).catch(() => null);
  if (cand) return { rol: "candidat", nume: cand.nume || "" };
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
    return json({ eroare: "Codul nu deschide aplicația. Intră în Școala de Arbitraj cu codul tău de candidat, lector sau arbitru." }, 401);
  }
  await resetLimita(cheie);
  return json({ ok: true, rol: eu.rol, nume: eu.nume, dataset: DATASET });
};
