// _comun/index-public.mjs — invalidarea indexului public al registrului (cartea răsfoibilă).
//
// DE CE. Indexul de la /registru-public/ se reconstruia DOAR pe ceas (TTL 5 min): la
// expirare, primul vizitator plătea scanarea întregului registru — 6,9 s măsurat, în
// creștere liniară cu registrul, periculos de aproape de plafonul de 10 s al funcțiilor.
//
// ACUM: indexul se reface doar când registrul CHIAR se schimbă — fiecare scriere care
// atinge sursa lui (emitere/anulare de certificat, import istoric, dosar de sănătate,
// canisă aprobată) cheamă `invalideazaIndexPublic`, iar TTL-ul rămâne doar plasă de
// siguranță, mult mai rar. Între schimbări, nimeni nu mai plătește scanarea.
//
// Ștergerea nu aruncă niciodată: operația principală a reușit deja, iar un index rămas
// o vreme în urmă e mai puțin grav decât o emitere transformată în eroare.

export const CHEIE_INDEX_PUBLIC = "registru-public/index";

/** Șterge indexul cachedat: următoarea vizită îl reconstruiește cu datele proaspete. */
export async function invalideazaIndexPublic(s) {
  await s.delete(CHEIE_INDEX_PUBLIC).catch(() => {});
}
