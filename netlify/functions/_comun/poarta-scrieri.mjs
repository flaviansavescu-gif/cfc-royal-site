// _comun/poarta-scrieri.mjs — comutatorul de urgență al scrierilor publice.
//
// DE CE. Până acum, la o problemă gravă descoperită în mers (o breșă, un defect care
// murdărește registrul), administratorul nu avea cum opri depunerile fără o publicare
// de cod. Paznicul de intruziune povestește, nu oprește — hotărâre bună, rămasă în
// picioare. Aici e cealaltă jumătate: când OMUL hotărăște, are butonul.
//
// CE ÎNCHIDE: doar SCRIERILE venite din public — depunerea de DMF, testele de sănătate,
// cererile de afix, înscrierile la expoziții. CITITUL rămâne deschis (fișele, cartea de
// origini, rezultatele), iar registratura, administratorul și Managerul lucrează normal:
// mentenanța nu are voie să oprească chiar oamenii care repară.
//
// FAIL-OPEN cu bună știință: dacă magazia nu răspunde, poarta se consideră DESCHISĂ.
// Un comutator de urgență care se blochează singur pe „închis" ar fi el însuși o avarie.
import { getStore } from "@netlify/blobs";

export const CHEIE_POARTA = "poarta-scrieri";

/** Starea porții. { inchis, motiv?, de?, deCatre? } — sau { inchis: false } la orice necaz. */
export async function starePoarta() {
  try {
    const p = await getStore("acces").get(CHEIE_POARTA, { type: "json" });
    return p?.inchis ? p : { inchis: false };
  } catch (err) {
    console.error("Poarta scrierilor nu s-a putut citi (rămâne deschisă):", err?.message || err);
    return { inchis: false };
  }
}

/**
 * Refuzul politicos, gata de întors din handler:
 *   const oprit = await refuzaDacaInchis();
 *   if (oprit) return oprit;
 * `json` vine ca parametru ca modulul să nu tragă după el răspunsul comun în teste.
 */
export async function refuzaDacaInchis(json) {
  const p = await starePoarta();
  if (!p.inchis) return null;
  return json({
    eroare:
      "Registrul primește momentan doar citiri — o mentenanță scurtă, pornită de administrator." +
      (p.motiv ? " Motiv: " + p.motiv : "") +
      " Reveniți în scurt timp; nimic din ce ați pregătit nu se pierde.",
  }, 503);
}
