// _comun/roluri.mjs — SURSA UNICĂ de adevăr pentru rolurile și codurile platformei.
//
// IMPORTANT: amprentele (SHA-256 ale codurilor) trăiesc DOAR aici, pe server.
// Nu se mai publică în HTML — pagina de intrare verifică codul prin funcția
// `acces-cursuri`, iar paginile se deschid pe baza ROLULUI (care nu e secret).
//
// Când se schimbă un lector (cod, nume, competențe pe grupe), se modifică
// EXCLUSIV aici. `src/data/cursuri.ts` păstrează doar datele publice
// (slug, nume, rol afișat, materiale) și NU mai conține amprente.
import { createHash, timingSafeEqual } from "node:crypto";

export const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

/** Comparație în timp constant, ca să nu se poată deduce amprenta din durata răspunsului. */
export function egal(a, b) {
  const x = Buffer.from(String(a || ""), "utf8");
  const y = Buffer.from(String(b || ""), "utf8");
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/**
 * Codul de ADMINISTRATOR — acces total la platformă.
 *
 * AICI ȘI NICĂIERI ALTUNDEVA. Amprenta a fost copiată, la un moment dat, în zece funcții
 * care nu importau de aici. Consecința nu era vizibilă până în ziua schimbării codului:
 * ar fi trebuit modificate unsprezece fișiere, iar oricare uitat ar fi continuat să
 * accepte codul VECHI. O revocare care nu revocă peste tot nu e o revocare.
 *
 * `ADMIN_HASH_ENV` permite schimbarea codului DIN NETLIFY, fără atingerea codului sursă
 * și fără publicare: pui amprenta nouă în variabila de mediu și codul vechi moare în
 * aceeași clipă, în toate funcțiile deodată. Valoarea de mai jos rămâne ca rezervă, ca
 * platforma să funcționeze și fără variabilă — dar odată pusă variabila, ea are ultimul
 * cuvânt.
 *
 * Amprenta nouă se obține din codul dorit cu:
 *   node -e "console.log(require('crypto').createHash('sha256').update('CODUL').digest('hex'))"
 */
const ADMIN_HASH_IMPLICIT = "66c260e81fd07dae6c76578609d8e4982cb92bd510a7fde396069de586bd2bfb";

const dinMediu = String(process.env.ADMIN_HASH || "").trim().toLowerCase();
export const ADMIN_HASH = /^[0-9a-f]{64}$/.test(dinMediu) ? dinMediu : ADMIN_HASH_IMPLICIT;

if (dinMediu && dinMediu !== ADMIN_HASH) {
  console.error("ADMIN_HASH din mediu nu e o amprentă SHA-256 validă (64 de cifre hexazecimale) — se folosește cea din cod.");
}

/** Codul COMUN de candidați (acces la zona de curs fără cod individual). */
export const ACCES_HASH = "48493761ba33bce0e9919789a88582a482179869fa76dbbaa93be7d67dad5470";

/**
 * Lectorii. `grupe` = competențele WDF pe grupe, derivate din prezentările lor
 * (folosite la orientarea candidaților spre lector). "all" = All Breed.
 */
export const LECTORI = [
  { slug: "flavian-savescu", nume: "Flavian-Sergiu Savescu", hash: "1604036be0bc0d666209789a9599257419813a13750b950734da13faa3330d1d", grupe: "all" },
  { slug: "mihail-cosmin-neagu", nume: "Mihail Cosmin Neagu", hash: "21048e2893df687a5195519e5d665440c99a6060e11044fb2509b886ca0cc8b9", grupe: "all" },
  { slug: "georgeta-mihaela-chivu", nume: "Georgeta Mihaela Chivu", hash: "ddd1b278ddf55141d8f2bca8857160b38cc64024e3f5b4368cbebee329442817", grupe: "all" },
  { slug: "mihail-sorin-iacob", nume: "Mihail Sorin Iacob", hash: "d3c043092f13a97d4d83dd0df96be08162ec7e26ea7241dc1da685c8d89e1b18", grupe: "all" },
  { slug: "andreea-daniela-popescu", nume: "Andreea-Daniela Popescu", hash: "3a7948f0609b92e2a9a46075b909600eec39244f36bc2477c32f9bbc1484f697", grupe: [3, 5, 9] },
  { slug: "alexandru-paul-ciolac", nume: "Alexandru Paul Ciolac", hash: "eb393a27cbaf6fd51833e060e8a421912f17b1b12ea8c499e2084305397cc1d7", grupe: [2, 3, 4, 6, 8] },
];

/**
 * E codul acesta al administratorului?
 *
 * De preferat comparației cu `ADMIN_HASH`: primește CODUL, nu amprenta, face singură
 * hașurarea și compară în timp constant. Cine o folosește nu mai are ce copia greșit.
 */
export function esteAdmin(cod) {
  return egal(sha256(cod || ""), ADMIN_HASH);
}

export const TOATE_GRUPELE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Grupele pe care le acoperă un lector (listă de numere). */
export function grupeLector(slug) {
  const l = LECTORI.find((x) => x.slug === slug);
  if (!l) return [];
  return l.grupe === "all" ? TOATE_GRUPELE.slice() : Array.isArray(l.grupe) ? l.grupe.slice() : [];
}

/** Lectorii cu competențele lor, pentru sugestii de repartizare. */
export function lectoriCuGrupe() {
  return LECTORI.map((l) => ({ slug: l.slug, nume: l.nume, grupe: grupeLector(l.slug), allBreed: l.grupe === "all" }));
}

/**
 * STRICT — doar administrator sau lector. Aceasta e funcția folosită de TOATE
 * funcțiile care acordă drepturi de administrare (JCR, PAA, interese).
 * Întoarce {rol:'admin'} | {rol:'lector',slug,nume} | null.
 *
 * ATENȚIE: nu recunoaște codul COMUN de candidați — altfel `cereLector` l-ar
 * accepta ca lector (escaladare de privilegii).
 */
export function actorDinCod(cod) {
  const h = sha256(cod || "");
  if (egal(h, ADMIN_HASH)) return { rol: "admin", hash: h };
  const l = LECTORI.find((x) => egal(x.hash, h));
  if (l) return { rol: "lector", slug: l.slug, nume: l.nume, hash: h };
  return null;
}

/**
 * PENTRU POARTA DE INTRARE — recunoaște în plus codul COMUN de candidați.
 * Se folosește EXCLUSIV în `acces-cursuri` (stabilirea rolului la autentificare),
 * niciodată pentru a acorda drepturi de administrare.
 */
export function rolLaIntrare(cod) {
  const a = actorDinCod(cod);
  if (a) return a;
  if (egal(sha256(cod || ""), ACCES_HASH)) return { rol: "acces" };
  return null;
}
