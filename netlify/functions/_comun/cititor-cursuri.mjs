// _comun/cititor-cursuri.mjs — cine are voie să citească materialele Școlii.
//
// Aceeași întrebare se pune în două locuri: la manualul de studiu individual
// (`material-protejat`) și la suporturile de curs ale lectorilor (`material-curs`).
// Un singur răspuns, într-un singur loc: dacă mâine se adaugă un rol sau se retrage
// unul, se schimbă aici — nu în două funcții care ar putea rămâne diferite.
//
// Numele real contează, nu doar dreptul de a intra: la manual ajunge în filigran, iar
// aici e ceea ce se consemnează despre cine a cerut materialul.
import { getStore } from "@netlify/blobs";
import { rolLaIntrare, sha256 } from "./roluri.mjs";

/**
 * `id` = identitatea PERSONALĂ în evidența asumărilor Codului Etic (insigna candidatului/
 * arbitrului, slug-ul lectorului) — `null` pentru admin și codul comun, care n-au dosar
 * personal. Pe el se sprijină poarta etică.
 * @returns {Promise<{rol:string, nume:string, id:string|null}|null>} cine citește, sau `null` dacă nimeni
 */
export async function cititorCursuri(body) {
  // Cod individual de candidat. M1: câmpul `cid` poartă CODUL, nu insigna (care ajungea
  // în listele lectorilor); serverul calculează insigna cu sha256.
  const cid = String(body?.cid || "").trim();
  if (cid) {
    try {
      const c = await getStore("cursuri").get("candidat/" + sha256(cid), { type: "json" });
      if (c) return { rol: "candidat", nume: String(c.nume || "").trim() || "Candidat", id: sha256(cid) };
    } catch (err) {
      console.error("Căutare candidat eșuată:", err);
    }
  }
  // Coduri fixe. `rolLaIntrare` acceptă și codul COMUN de candidați — corect aici,
  // fiindcă materialul e comun; nu acordă niciun drept de administrare.
  const cod = String(body?.cod || "").trim();
  if (cod) {
    const r = rolLaIntrare(cod);
    if (r?.rol === "admin") return { rol: "admin", nume: "Administrator CFC-Royal", id: null };
    if (r?.rol === "lector") return { rol: "lector", nume: r.nume, id: r.slug };
    if (r?.rol === "acces") return { rol: "acces", nume: "Acces cu cod comun", id: null };
    // Arbitru (membru al Colegiului care nu e lector) — cod individual din registru.
    try {
      const a = await getStore("cursuri").get("arbitru/" + sha256(cod), { type: "json" });
      if (a) return { rol: "arbitru", nume: String(a.nume || "").trim() || "Arbitru", id: sha256(cod) };
    } catch (err) {
      console.error("Căutare arbitru eșuată:", err);
    }
  }
  return null;
}
