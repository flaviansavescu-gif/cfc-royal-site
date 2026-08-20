// _comun/raspuns.mjs — răspunsul JSON al funcțiilor, dintr-un singur loc.
//
// Același `const json = ...` era scris de mână în ~30 de fișiere. O schimbare de
// politică (un antet nou, alt charset) cerea 30 de edituri — acum cere una.
//
// `no-store` e implicitul potrivit aici: funcțiile răspund cu date personale sau cu
// stări care se schimbă (coada registraturii, progresul la teste), care nu au voie să
// rămână în cache-ul browserului sau al unui proxy. Funcțiile care VOR cache pe un
// răspuns public (ex. rezultatele publicate) își declară antetul lor, local.

/** Răspuns JSON: obiect -> Response cu charset și Cache-Control: no-store. */
export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
