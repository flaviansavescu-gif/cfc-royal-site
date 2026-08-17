// _comun/microcip.mjs — microcipul: întreg în casă, mascat în stradă.
//
// DE CE. Microcipul e numărul unic de identificare al animalului și, prin el, o
// legătură directă cu stăpânul: cu el se caută în bazele veterinare, se revendică un
// exemplar, se contestă o proprietate. Fișa publică a câinelui și verificarea prin cod
// QR îl scoteau ÎNTREG, la o adresă fără nicio poartă — deci oricine putea culege
// cipurile tuturor câinilor din registru, unul câte unul.
//
// Nu îl scoatem cu totul: cine ține certificatul în mână trebuie să poată verifica pe
// loc că hârtia și fișa vorbesc despre același câine. Ultimele patru cifre ajung pentru
// asta și nu ajung pentru nimic altceva — nu se poate căuta cu ele într-o bază
// veterinară, nu se poate revendica un câine cu ele.
//
// Registratura, administratorul și crescătorul își văd mai departe cipul întreg: ei au
// cod și temei. Masca e doar pentru răspunsurile publice.

/** Forma de lucru a cipului: fără spații și fără cratime. */
export const normCip = (v) => String(v || "").replace(/[\s-]/g, "");

/**
 * Cipul, așa cum are voie să iasă în lume: doar ultimele patru cifre.
 * `985141001234821` -> `···········4821`
 *
 * Gol rămâne gol (nu inventăm un cip acolo unde nu e), iar un cip mai scurt decât patru
 * caractere se ascunde în întregime — patru cifre dintr-un număr de cinci nu mai e mască.
 */
export function mascheazaCip(v) {
  const c = normCip(v);
  if (!c) return "";
  if (c.length <= 4) return "·".repeat(c.length);
  return "·".repeat(c.length - 4) + c.slice(-4);
}
