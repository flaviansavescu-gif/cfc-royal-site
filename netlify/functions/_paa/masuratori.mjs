// _paa/masuratori.mjs — motorul de măsurători pentru Photo Anatomy Annotator.
// Funcții PURE (fără I/O), testabile cu `node --test`. Coordonate normalizate 0..1;
// `aspect` = lățime/înălțime al imaginii, pentru distanțe corecte în spațiul imaginii
// (componenta x se scalează cu aspect ca totul să fie exprimat în „unități de înălțime").
//
// AVERTISMENT metodologic: toate rezultatele sunt estimări 2D dintr-o fotografie și
// NU constituie o evaluare oficială.

const num = (v) => (typeof v === "number" && isFinite(v) ? v : NaN);

/** Distanța euclidiană între două puncte normalizate, în unități de înălțime a imaginii. */
export function distanta(a, b, aspect = 1) {
  if (!a || !b) return NaN;
  const dx = (num(a.x) - num(b.x)) * (aspect || 1);
  const dy = num(a.y) - num(b.y);
  return Math.sqrt(dx * dx + dy * dy);
}

/** Unghiul (grade) la vârful B, format de segmentele BA și BC (corectat cu aspect). */
export function unghiABC(a, b, c, aspect = 1) {
  if (!a || !b || !c) return NaN;
  const asp = aspect || 1;
  const ux = (num(a.x) - num(b.x)) * asp, uy = num(a.y) - num(b.y);
  const vx = (num(c.x) - num(b.x)) * asp, vy = num(c.y) - num(b.y);
  const mu = Math.hypot(ux, uy), mv = Math.hypot(vx, vy);
  if (mu === 0 || mv === 0) return NaN;
  let cos = (ux * vx + uy * vy) / (mu * mv);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Procent: 100 × valoare / referință. */
export function procent(valoare, referinta) {
  const r = num(referinta);
  if (r === 0 || isNaN(r) || isNaN(num(valoare))) return NaN;
  return (100 * num(valoare)) / r;
}

/** Raport simplu x/y. */
export function raport(x, y) {
  const yy = num(y);
  if (yy === 0 || isNaN(yy) || isNaN(num(x))) return NaN;
  return num(x) / yy;
}

/** Rotunjire la n zecimale (implicit 1), pentru afișare. */
export const rotunjeste = (v, n = 1) => (isNaN(num(v)) ? null : Math.round(v * 10 ** n) / 10 ** n);

/** Statutul unei valori față de o metrică de standard.
 *  metric: { min, max, tinta, severitate, unitate }
 *  -> { status: "conform"|"neconform"|"informativ"|"neconcludent", motiv } */
export function statusInterval(valoare, metric) {
  const v = num(valoare);
  if (isNaN(v)) return { status: "neconcludent", motiv: "Valoare indisponibilă sau reper lipsă." };
  metric = metric || {};
  const min = metric.min == null ? null : num(metric.min);
  const max = metric.max == null ? null : num(metric.max);
  if ((min == null || isNaN(min)) && (max == null || isNaN(max))) {
    return { status: "informativ", motiv: "Metrică fără interval definit — doar informativ." };
  }
  const subMin = min != null && !isNaN(min) && v < min;
  const pesteMax = max != null && !isNaN(max) && v > max;
  if (subMin || pesteMax) {
    return { status: "neconform", motiv: "Valoarea " + rotunjeste(v) + " este " + (subMin ? "sub minimul " + min : "peste maximul " + max) + "." };
  }
  return { status: "conform", motiv: "Valoarea " + rotunjeste(v) + " se încadrează în interval" + (min != null ? " [" + min + (max != null ? "–" + max : "") + "]" : "") + "." };
}

/** Metricile MVP, din distanțe deja măsurate (în aceleași unități). Fiecare = procent față
 *  de înălțimea la greabăn, plus raportul craniu-bot. Valorile lipsă -> NaN. */
export function metriciMVP(d) {
  d = d || {};
  return {
    indice_corporal: procent(d.lungime_corp, d.inaltime_greaban),
    adancime_torace: procent(d.adancime_torace, d.inaltime_greaban),
    segment_membru_anterior: procent(d.segment_membru_anterior, d.inaltime_greaban),
    raport_craniu_bot: raport(d.lungime_craniu, d.lungime_bot),
  };
}
