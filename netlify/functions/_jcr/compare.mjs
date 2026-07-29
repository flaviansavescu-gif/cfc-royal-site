// _jcr/compare.mjs — algoritmi DETERMINIȘTI și explicabili pentru Judge Comparison Room.
// Funcții pure (fără I/O), testabile cu `node --test`. NU folosesc AI; orice similitudine
// semantică ar fi un modul separat, opțional și etichetat (fază ulterioară).

// Scala de calificative WDF, gradabile (ordinale). Indexul mai mic = mai bun.
export const CALIFICATIVE = ["Excellent", "Very Good", "Good", "Sufficient"];
// Calificative speciale (necomparabile pe distanță — doar potrivire exactă).
export const CALIFICATIVE_SPECIALE = ["Insufficient", "Disqualified", "Not Judgeable"];
// Gravitatea defectelor (index crescător = mai grav).
export const GRAVITATI = ["minor", "grav", "eliminator"];

const idxCalificativ = (c) => CALIFICATIVE.indexOf(String(c || "").trim());
const idxGravitate = (g) => GRAVITATI.indexOf(String(g || "").trim());

/** Compară calificativul cursantului cu cel de referință.
 *  Întoarce distanța ordinală (semnată) și un statut explicabil. */
export function comparaCalificativ(student, referinta) {
  const s = String(student || "").trim();
  const r = String(referinta || "").trim();
  if (!s || !r) return { student: s, referinta: r, distanta: null, status: "necompletat", motiv: "Lipsește un calificativ." };
  if (s === r) return { student: s, referinta: r, distanta: 0, status: "acord", motiv: "Calificativ identic cu referința." };
  const is = idxCalificativ(s), ir = idxCalificativ(r);
  if (is === -1 || ir === -1) {
    // cel puțin unul e special (Insufficient/DSQ/NJ) și nu coincid
    return { student: s, referinta: r, distanta: null, status: "dezacord", motiv: "Calificative diferite, cel puțin unul special (necomparabil pe distanță)." };
  }
  const d = is - ir; // >0: cursantul a dat un calificativ mai slab; <0: mai generos
  return {
    student: s, referinta: r, distanta: d,
    status: Math.abs(d) === 1 ? "acord-parțial" : "dezacord",
    motiv: (d > 0 ? "Mai sever cu " : "Mai generos cu ") + Math.abs(d) + " treaptă/trepte față de referință.",
  };
}

/** Compară defectele (liste de {cod, gravitate}) după cod și gravitate.
 *  Statut per defect: acord | acord-parțial | omis | suplimentar. */
export function comparaDefecte(studentDefecte, referintaDefecte) {
  const norm = (arr) => {
    const m = new Map();
    (Array.isArray(arr) ? arr : []).forEach((d) => {
      const cod = String((d && d.cod) || "").trim();
      if (cod) m.set(cod, String((d && d.gravitate) || "").trim());
    });
    return m;
  };
  const S = norm(studentDefecte), R = norm(referintaDefecte);
  const rezultate = [];
  // parcurgem referința (defecte așteptate) + suplimentarele cursantului
  for (const [cod, gR] of R) {
    if (!S.has(cod)) {
      rezultate.push({ cod, status: "omis", gravitateStudent: null, gravitateReferinta: gR, motiv: "Defect din referință, neidentificat de cursant." });
    } else {
      const gS = S.get(cod);
      if (gS === gR) rezultate.push({ cod, status: "acord", gravitateStudent: gS, gravitateReferinta: gR, motiv: "Defect identificat, gravitate corectă." });
      else {
        const d = idxGravitate(gS) - idxGravitate(gR);
        rezultate.push({ cod, status: "acord-parțial", gravitateStudent: gS, gravitateReferinta: gR, motiv: "Defect identificat, gravitate " + (d > 0 ? "supraevaluată" : "subevaluată") + "." });
      }
    }
  }
  for (const [cod, gS] of S) {
    if (!R.has(cod)) rezultate.push({ cod, status: "suplimentar", gravitateStudent: gS, gravitateReferinta: null, motiv: "Defect semnalat de cursant, absent din referință." });
  }
  const acord = rezultate.filter((x) => x.status === "acord").length;
  return {
    detalii: rezultate,
    sumar: {
      acord, partial: rezultate.filter((x) => x.status === "acord-parțial").length,
      omise: rezultate.filter((x) => x.status === "omis").length,
      suplimentare: rezultate.filter((x) => x.status === "suplimentar").length,
      total_referinta: R.size,
    },
  };
}

/** Coeficientul Spearman (ρ) între două clasamente (liste de id, în ordine).
 *  Se calculează pe exemplarele comune. Întoarce null dacă < 2 comune. */
export function spearman(ordineA, ordineB) {
  const rangA = new Map(), rangB = new Map();
  (ordineA || []).forEach((id, i) => rangA.set(String(id), i + 1));
  (ordineB || []).forEach((id, i) => rangB.set(String(id), i + 1));
  const comune = [...rangA.keys()].filter((id) => rangB.has(id));
  const n = comune.length;
  if (n < 2) return null;
  let sumaD2 = 0;
  for (const id of comune) { const d = rangA.get(id) - rangB.get(id); sumaD2 += d * d; }
  return 1 - (6 * sumaD2) / (n * (n * n - 1));
}

/** Coeficientul Kendall (τ) între două clasamente. Pe exemplarele comune. */
export function kendall(ordineA, ordineB) {
  const rangA = new Map(), rangB = new Map();
  (ordineA || []).forEach((id, i) => rangA.set(String(id), i + 1));
  (ordineB || []).forEach((id, i) => rangB.set(String(id), i + 1));
  const comune = [...rangA.keys()].filter((id) => rangB.has(id));
  const n = comune.length;
  if (n < 2) return null;
  let concordante = 0, discordante = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = rangA.get(comune[i]) - rangA.get(comune[j]);
    const b = rangB.get(comune[i]) - rangB.get(comune[j]);
    const s = Math.sign(a) * Math.sign(b);
    if (s > 0) concordante++; else if (s < 0) discordante++;
  }
  const total = (n * (n - 1)) / 2;
  return total === 0 ? null : (concordante - discordante) / total;
}

/** Compară clasamentele. null dacă < 2 exemplare comune (nu are sens). */
export function comparaClasament(studentOrdine, referintaOrdine) {
  const rho = spearman(studentOrdine, referintaOrdine);
  const tau = kendall(studentOrdine, referintaOrdine);
  if (rho === null) return { spearman: null, kendall: null, n: (studentOrdine || []).length, status: "indisponibil", motiv: "Sub 2 exemplare comune — clasamentul nu se compară." };
  const acord = rho >= 0.8;
  return {
    spearman: Number(rho.toFixed(3)), kendall: tau === null ? null : Number(tau.toFixed(3)),
    n: (referintaOrdine || []).length,
    status: acord ? "acord" : rho >= 0.4 ? "acord-parțial" : "dezacord",
    motiv: "Corelație Spearman ρ = " + rho.toFixed(2) + " față de clasamentul de referință.",
  };
}

/** Potrivire deterministă a observațiilor pe criterii/rubrică (fără AI).
 *  Marcheză, per criteriu de referință, dacă cursantul a scris o observație legată. */
export function comparaObservatii(studentObs, referintaObs) {
  const legS = new Set((Array.isArray(studentObs) ? studentObs : []).map((o) => String((o && o.criteriuId) || "")).filter(Boolean));
  const rez = (Array.isArray(referintaObs) ? referintaObs : []).map((o) => {
    const cid = String((o && o.criteriuId) || "");
    const acoperit = cid && legS.has(cid);
    return { criteriuId: cid, eticheta: (o && o.eticheta) || "", status: acoperit ? "acoperit" : "neabordat", motiv: acoperit ? "Cursantul a formulat o observație pe acest criteriu." : "Criteriu din barem neabordat de cursant." };
  });
  return { detalii: rez, sumar: { acoperite: rez.filter((x) => x.status === "acoperit").length, total: rez.length } };
}

/** Comparație completă răspuns-cursant vs. barem-referință. */
export function comparaRaspuns(raspuns, referinta) {
  raspuns = raspuns || {}; referinta = referinta || {};
  return {
    calificativ: comparaCalificativ(raspuns.calificativ, referinta.calificativ),
    defecte: comparaDefecte(raspuns.defecte, referinta.defecte),
    clasament: comparaClasament(raspuns.clasament, referinta.clasament),
    observatii: comparaObservatii(raspuns.observatii, referinta.observatii),
  };
}
