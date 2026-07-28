// =========================================================================
// taxa-expo.mjs — cât costă înscrierea unui câine la o expoziție.
//
// Tariful asociației nu taxează pe clasă de concurs, ci pe trei întrebări:
//   1. Ce fel de expoziție e (C.A.C. sau C.A.C.I.B.)?  → grila expoziției
//   2. Proprietarul e membru?                          → coloana
//   3. E primul lui câine la această expoziție?        → rândul
// Peste ele, reducerea de student se aplică sumei finale.
//
// Funcție pură, fără magazie și fără rețea: se poate testa direct și e aceeași
// regulă în formularul public (browser), în funcția de pe server și în manager.
// Sursa cifrelor rămâne src/data/tarife.ts; aici e doar aritmetica.
// =========================================================================

/** Grila unei expoziții, așa cum o publică managerul. */
export const GRILA_GOALA = {
  membru: { primul: 0, urmatorii: 0 },
  nemembru: { primul: 0, urmatorii: 0 },
  scutite: [],   // clase fără taxă (ex. baby, puppy), dacă asociația hotărăște așa
  student: 0,    // procentul reducerii pentru studenți
};

const nr = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Aduce orice formă venită din afară la structura așteptată. Nu aruncă niciodată. */
export function normalizeazaGrila(brut) {
  const g = brut && typeof brut === "object" ? brut : {};
  const rand = (x) => ({
    primul: nr(x && x.primul),
    urmatorii: nr(x && x.urmatorii),
  });
  return {
    membru: rand(g.membru),
    nemembru: rand(g.nemembru),
    scutite: Array.isArray(g.scutite) ? g.scutite.map(String) : [],
    student: Math.min(100, nr(g.student)),
  };
}

/** Grila chiar cere plată de la cineva? Dacă nu, formularul nu arată deloc secțiunea. */
export function grilaAreTaxe(grila) {
  const g = normalizeazaGrila(grila);
  return g.membru.primul > 0 || g.membru.urmatorii > 0 ||
         g.nemembru.primul > 0 || g.nemembru.urmatorii > 0;
}

/**
 * Taxa pentru o înscriere.
 * @param grila      grila expoziției (publicată de manager)
 * @param declaratii { membru, primul, student, clasa }
 * @returns suma în lei, rotunjită la leu
 */
export function calculeazaTaxa(grila, declaratii = {}) {
  const g = normalizeazaGrila(grila);
  const { membru = false, primul = true, student = false, clasa = "" } = declaratii;

  if (clasa && g.scutite.includes(String(clasa))) return 0;

  const coloana = membru ? g.membru : g.nemembru;
  const baza = primul ? coloana.primul : coloana.urmatorii;
  if (!baza) return 0;

  const reducere = student ? g.student : 0;
  return Math.round((baza * (100 - reducere)) / 100);
}

/**
 * Calea veche: taxa pe clasă de concurs ({ deschisa: 100, ... }).
 *
 * Expozițiile publicate ÎNAINTE de schimbare rămân exact cum au fost anunțate —
 * nu convertim grila veche în cea nouă, fiindcă orice conversie ar schimba suma
 * cerută unor oameni care au văzut deja alt preț pe formular. O expoziție trece
 * la grila nouă doar când managerul o publică din nou.
 */
export function taxaVeche(taxe, clasa) {
  return nr((taxe || {})[clasa]);
}

export function areTaxeVechi(taxe) {
  return Object.values(taxe || {}).some((v) => nr(v) > 0);
}
