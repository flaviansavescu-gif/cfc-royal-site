// _comun/poarta-etica.mjs — poarta Codului Etic: fără asumarea versiunii CURENTE, formarea e închisă.
//
// Hotărârea (23.08.2026): candidații, arbitrii și lectorii au acces la formare DOAR cu
// Codul Etic asumat — pe versiunea curentă (un text pe care nu l-ai văzut nu te poate
// lega). Evidența asumărilor există de mult (cod-etic/<versiune>/<id>); aici ea devine
// poartă, nu doar îndemn.
//
// CE RĂMÂNE LIBER, dinadins:
//   • drumul spre asumare (cod-etic stare/asuma) — altfel nimeni n-ar mai putea intra;
//   • contestațiile examenului — drept procedural, nu beneficiu de formare;
//   • tipărirea actelor DEJA emise — actul e câștigat sub regulile de atunci;
//   • buletinul și anunțurile — canalele prin care omul află ce are de făcut;
//   • codul COMUN de acces (fără identitate personală — n-are dosar de asumare).
//
// FAIL-OPEN pe avarie: dacă magazia nu răspunde și asumarea nu se poate CITI, omul
// trece — asumarea e consemnată permanent, iar un sughiț de infrastructură nu e motiv
// să închizi școala (aceeași filozofie ca la comutatorul de urgență). Poarta închide
// doar pe „am citit și NU e asumat".
import { VERSIUNE } from "../cod-etic.mjs";

/**
 * Refuză acțiunea dacă identitatea personală dată nu are asumată versiunea curentă.
 * @param store magazia „cursuri"
 * @param id    insigna candidatului/arbitrului (sha256 al codului) sau slug-ul lectorului;
 *              gol/null = fără identitate personală → poarta NU se aplică (alte porți decid)
 * @param json  fabrica de răspunsuri a funcției
 * @returns {Promise<Response|null>} refuzul 403, sau null dacă trece
 */
export async function refuzaFaraCodEtic(store, id, json) {
  const insigna = String(id || "").trim();
  if (!insigna) return null;
  try {
    const a = await store.get(`cod-etic/${VERSIUNE}/${insigna}`, { type: "json" });
    if (a) return null;
  } catch (err) {
    console.error("Poarta etică nu a putut citi asumarea — trece (fail-open):", err?.message || err);
    return null;
  }
  return json({
    eroare: `Accesul la formare cere asumarea Codului Etic (versiunea ${VERSIUNE}). ` +
      "Intră pe pagina de asumare din platformă și confirmă — durează un minut.",
    trebuieAsumat: true,
    versiune: VERSIUNE,
  }, 403);
}
