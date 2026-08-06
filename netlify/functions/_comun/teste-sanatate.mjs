// _comun/teste-sanatate.mjs — nomenclatorul testelor de sănătate ale câinilor de
// reproducție (Faza 1 a stratului de sănătate din registrul genealogic).
//
// Aici sunt DOAR tipurile de test, rezultatele permise și calculul insignei publice.
// Regulile pe rasă („ce test e obligatoriu") și porțile la emiterea pedigree-ului NU
// intră în Faza 1 — abia în Faza 2. Modulul e pur (fără magazie), ca să fie testabil.

/**
 * Tipurile de test. `rezultate` = lista închisă de rezultate acceptate; `null` înseamnă
 * rezultat liber (ex. un test genetic specific rasei, unde valoarea variază).
 * `insigna(rezultat)` produce eticheta scurtă de pe fișa publică.
 */
export const TIPURI_TEST = {
  hd: {
    nume: "Displazie de șold (HD)",
    rezultate: ["A", "B", "C", "D", "E"],
    insigna: (r) => "HD-" + r,
  },
  ed: {
    nume: "Displazie de cot (ED)",
    rezultate: ["0", "1", "2", "3"],
    insigna: (r) => "ED-" + r,
  },
  ochi: {
    nume: "Examen oftalmologic",
    rezultate: ["liber", "afectat"],
    insigna: (r) => (r === "liber" ? "Ochi: liber" : "Ochi: afectat"),
  },
  adn: {
    nume: "Profil ADN",
    rezultate: ["depus"],
    insigna: () => "ADN depus",
  },
  genetic: {
    nume: "Test genetic (specific rasei)",
    rezultate: null, // rezultat liber
    insigna: (r) => "Genetic: " + r,
  },
};

export const TIPURI_TEST_LISTA = Object.keys(TIPURI_TEST);

/** E un tip de test cunoscut? */
export function tipValid(tip) {
  return Object.prototype.hasOwnProperty.call(TIPURI_TEST, String(tip || ""));
}

/**
 * Validează o pereche (tip, rezultat). Întoarce { ok:true, rezultat } cu rezultatul
 * normalizat, sau { eroare }.
 */
export function valideaza(tip, rezultat) {
  const t = TIPURI_TEST[String(tip || "")];
  if (!t) return { eroare: "Tip de test necunoscut." };
  const r = String(rezultat == null ? "" : rezultat).trim();
  if (!r) return { eroare: "Lipsește rezultatul testului." };
  if (t.rezultate && !t.rezultate.includes(r))
    return { eroare: `Rezultat nepermis pentru „${t.nume}". Acceptate: ${t.rezultate.join(", ")}.` };
  return { ok: true, rezultat: r };
}

/** Numele complet al tipului (pentru interfețe). */
export function numeTest(tip) {
  const t = TIPURI_TEST[String(tip || "")];
  return t ? t.nume : String(tip || "");
}

/** Insigna scurtă pentru fișa publică, ex. „HD-A", „Ochi: liber". */
export function insignaTest(tip, rezultat) {
  const t = TIPURI_TEST[String(tip || "")];
  if (!t) return "";
  try {
    return t.insigna(String(rezultat == null ? "" : rezultat).trim());
  } catch {
    return "";
  }
}

// ————————————————————— Recomandarea de calitate (Faza 2) —————————————————————
//
// NU impunem teste și NU inventăm reguli pe rasă. Doar RĂSPLĂTIM: un câine cu teste
// verificate și rezultate bune primește „Recomandat pentru montă — CFC-Royal".
//
// Ce înseamnă „rezultat bun" (FAVORABIL) — praguri uzuale, nu impuse nimănui:
//   • HD: A, B, C bune; D, E nu.        • ED: 0, 1 bune; 2, 3 nu.
//   • ochi: „liber" bun; „afectat" nu.  • ADN: „depus" bun (profil pe dosar).
//   • test genetic: rezultat liber — nu îl putem judeca automat -> NEUTRU.

const REZULTATE_BUNE = {
  hd: ["A", "B", "C"],
  ed: ["0", "1"],
  ochi: ["liber"],
  adn: ["depus"],
};

/**
 * E favorabil rezultatul? `true` (bun), `false` (nu), `null` (neutru — nu se poate judeca,
 * ex. un test genetic cu rezultat liber).
 */
export function favorabil(tip, rezultat) {
  const t = String(tip || "");
  if (t === "genetic") return null;
  const bune = REZULTATE_BUNE[t];
  if (!bune) return null;
  return bune.includes(String(rezultat == null ? "" : rezultat).trim());
}

/**
 * Din testele VERIFICATE ale unui câine, decide recomandarea de calitate.
 * Regula (cea cerută): cel puțin un test judecabil favorabil ȘI niciun test nefavorabil.
 * @param {Array<{tip,rezultat,stare?}>} teste
 * @returns {{ acordata:boolean, favorabile:number, nefavorabile:number }}
 */
export function recomandareDin(teste) {
  let favorabile = 0, nefavorabile = 0;
  for (const t of teste || []) {
    if (t.stare && t.stare !== "verificat") continue; // doar verificate
    const f = favorabil(t.tip, t.rezultat);
    if (f === true) favorabile++;
    else if (f === false) nefavorabile++;
  }
  return { acordata: favorabile >= 1 && nefavorabile === 0, favorabile, nefavorabile };
}
