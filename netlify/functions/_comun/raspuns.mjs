// _comun/raspuns.mjs — răspunsul JSON al funcțiilor, dintr-un singur loc.
//
// Același `const json = ...` era scris de mână în ~30 de fișiere. O schimbare de
// politică (un antet nou, alt charset) cerea 30 de edituri — acum cere una.
//
// `no-store` e implicitul potrivit aici: funcțiile răspund cu date personale sau cu
// stări care se schimbă (coada registraturii, progresul la teste), care nu au voie să
// rămână în cache-ul browserului sau al unui proxy. Funcțiile care VOR cache pe un
// răspuns public (ex. rezultatele publicate) își declară antetul lor, local.

/**
 * Răspuns JSON: obiect -> Response cu charset și Cache-Control: no-store.
 *
 * Opțiuni (rar folosite — implicitul acoperă aproape tot):
 *   lizibil — JSON cu indentare, pentru uneltele citite de OM (panouri, depanare);
 *   antete  — anteturi în plus sau în loc (ex. registrul public își pune propriul
 *             Cache-Control, fiindcă răspunsul lui e chiar gândit pentru cache).
 */
export const json = (body, status = 200, { lizibil = false, antete = {} } = {}) =>
  new Response(JSON.stringify(body, null, lizibil ? 2 : 0), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...antete },
  });
