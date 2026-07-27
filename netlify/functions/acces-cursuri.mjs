// acces-cursuri.mjs — POARTA DE INTRARE a platformei, verificată pe SERVER.
//
// Înainte, codurile de administrator și de lector se verificau în browser, iar
// amprentele lor (SHA-256) ajungeau în HTML-ul public — cine le lua putea sparge
// un cod scurt offline, fără limită de încercări. Acum:
//   • amprentele stau doar pe server (_comun/roluri.mjs);
//   • fiecare încercare trece pe aici și e limitată pe adresă (_comun/limitare.mjs);
//   • pagina primește înapoi doar ROLUL (care nu e secret) și destinația.
//
// POST { cod } -> { rol, slug?, nume?, id?, dest }   |  401 cod greșit  |  429 prea multe încercări
import { getStore } from "@netlify/blobs";
import { sha256, rolLaIntrare } from "./_comun/roluri.mjs";
import { ipClient, verificaLimita, inregistreazaEsec, resetLimita } from "./_comun/limitare.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const cod = String(body.cod || "").trim();
  if (!cod) return json({ eroare: "Cod lipsă." }, 400);

  // —— Limitare: aceeași adresă nu poate încerca la nesfârșit ——
  const cheie = ipClient(req);
  const lim = await verificaLimita(cheie);
  if (!lim.permis)
    return json({ eroare: "Prea multe încercări. Reîncearcă peste " + Math.ceil(lim.dupaSecunde / 60) + " minute." }, 429);

  // —— 1) Coduri fixe: administrator, lector, cod comun de candidați ——
  const fix = rolLaIntrare(cod);
  if (fix) {
    await resetLimita(cheie);
    if (fix.rol === "admin") return json({ rol: "admin", dest: "/cursuri/admin/" });
    if (fix.rol === "lector") return json({ rol: "lector", slug: fix.slug, nume: fix.nume, dest: "/cursuri/lector/" + fix.slug + "/" });
    return json({ rol: "acces", dest: "/cursuri/module/" });
  }

  // —— 2) Cod individual de candidat (registrul din store-ul „cursuri") ——
  const id = sha256(cod);
  let cand = null;
  try { cand = await getStore("cursuri").get("candidat/" + id, { type: "json" }); }
  catch (err) { console.error("Căutare candidat eșuată:", err); }

  if (cand) {
    await resetLimita(cheie);
    // Evidența intrărilor (prima / ultima), fără a bloca autentificarea la eroare.
    try {
      const acum = new Date().toISOString();
      if (!cand.prima_logare) cand.prima_logare = acum;
      cand.ultima_logare = acum;
      delete cand.cod;   // curăță fișele vechi, scrise când codul se păstra
      await getStore("cursuri").setJSON("candidat/" + id, cand);
    } catch (err) { console.error("Nu am putut marca intrarea candidatului:", err); }
    return json({ rol: "candidat", id, nume: cand.nume, dest: "/cursuri/module/" });
  }

  // —— 3) Cod de ARBITRU (membru al Colegiului care nu e lector): acces de studiu,
  //       fără teste. Registrul e administrat din panou (arbitri-cursuri).
  let arb = null;
  try { arb = await getStore("cursuri").get("arbitru/" + id, { type: "json" }); }
  catch (err) { console.error("Căutare arbitru eșuată:", err); }

  if (arb) {
    await resetLimita(cheie);
    try {
      const acum = new Date().toISOString();
      if (!arb.prima_logare) arb.prima_logare = acum;
      arb.ultima_logare = acum;
      delete arb.cod;
      await getStore("cursuri").setJSON("arbitru/" + id, arb);
    } catch (err) { console.error("Nu am putut marca intrarea arbitrului:", err); }
    return json({ rol: "arbitru", nume: arb.nume, dest: "/cursuri/arbitru/" });
  }

  const ramase = await inregistreazaEsec(cheie);
  return json({ eroare: "Cod incorect.", incercariRamase: ramase }, 401);
};
