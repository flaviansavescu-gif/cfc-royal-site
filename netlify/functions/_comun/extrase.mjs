// extrase.mjs — regulile extraselor oficiale din registre, într-un singur loc.
//
// Un extras e ca extrasul de cont de la bancă: întregul registru sau doar pozițiile
// dintre două numere, pe hârtie, cu antet și semnături. Regulile de aici răspund la
// două întrebări: CINE poate cere un extras și CE interval a cerut de fapt.

/**
 * Cine poate cere un extras: administratorul și registratorul cu dreptul de a genera
 * coduri — exact oamenii cărora asociația le-a încredințat cheile. Ceilalți
 * registratori lucrează dosarele, dar nu scot registrul pe hârtie: un extras e o
 * fotografie a întregii evidențe, nu o unealtă de lucru pe un dosar.
 */
export const poateCereExtras = (eu) =>
  eu?.rol === "admin" || (eu?.rol === "registratura" && eu?.registrator?.poateDaAcces === true);

/** Numărul dintr-un text de evidență: „WDF-0077" -> 77, „25" -> 25. Ilizibil -> null. */
export function numarDinText(v) {
  const n = parseInt(String(v == null ? "" : v).replace(/\D+/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Intervalul cerut: amândouă capetele goale = tot registrul; un singur capăt = de la
 * el încolo (sau până la el). Capete întoarse pe dos sunt o greșeală de tastare, nu o
 * cerere — se refuză cu motiv, nu se „repară" în tăcere.
 */
export function intervalulCerut(deLa, panaLa) {
  const citeste = (v) => {
    const s = String(v == null ? "" : v).trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isInteger(n) && n > 0 ? n : NaN;
  };
  const a = citeste(deLa), b = citeste(panaLa);
  if (Number.isNaN(a) || Number.isNaN(b))
    return { eroare: "Capetele intervalului trebuie să fie numere întregi pozitive." };
  if (a != null && b != null && a > b)
    return { eroare: "Intervalul e întors: primul număr trebuie să fie cel mic." };
  return { deLa: a, panaLa: b };
}

/** E numărul în intervalul cerut? Capetele lipsă nu îngrădesc. */
export const inInterval = (nr, deLa, panaLa) =>
  nr != null && (deLa == null || nr >= deLa) && (panaLa == null || nr <= panaLa);

/** Citiri din magazie în valuri mărunte: destule deodată cât să nu se aștepte la
 *  rând, destul de puține cât să nu sufoce funcția. */
export async function inValuri(lista, cateOdata, lucreaza) {
  const out = [];
  for (let i = 0; i < lista.length; i += cateOdata)
    out.push(...await Promise.all(lista.slice(i, i + cateOdata).map(lucreaza)));
  return out;
}
