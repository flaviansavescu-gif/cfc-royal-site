// =========================================================================
// drepturi-registru.mjs — cine ce poate face în administrarea accesului la registru.
//
// Până acum totul stătea după o singură poartă: administratorul, și numai el. Dar
// munca de secretariat — cererile de acces, codurile de membru, cotizația — se
// sprijină pe date pe care le are REGISTRATURA, nu administratorul. Verificarea
// trebuie să stea unde stau datele.
//
// REGULA DE FOND: **registratura dă acces, administratorul îl ia.**
// Un rol care poate și acorda, și revoca, se poate desprinde singur de sub control.
// De aceea ștergerea unui membru, codurile de registratură, anularea certificatelor,
// arhiva și curățenia rămân exclusiv la administrator.
//
// DREPTUL DE A DA CODURI e al unui singur registrator, nu al funcției: se pune pe fișa
// lui (`poateDaAcces`), din panoul administratorului. Ceilalți lucrează dosarele și
// verifică înscrierile, dar nu deschid uși.
//
// Tabelul e un fișier de date, separat de funcție, tocmai ca să poată fi citit dintr-o
// privire și probat fără să pornim nimic. O poartă pe care n-o poți citi nu e o poartă.
// =========================================================================

/** Ce poate face ORICE registrator. Muncă de secretariat, fără drept de a acorda acces. */
export const ALE_REGISTRATURII = new Set([
  "cereri",         // cine a solicitat acces — lista lor se umple, e treaba lor
  "cerere-sterge",  // închiderea unei cereri rezolvate
  "membri",         // lista membrilor, cu starea cotizației
  "jurnal",         // propriile fapte (funcția filtrează; vezi `jurnalDoarAleMele`)
  "jurnal-fapte",   // felurile de faptă, pentru filtrul din pagină
]);

/** Ce poate face DOAR registratorul cu drept de a da acces. Acestea deschid uși. */
export const CU_DREPT_DE_ACCES = new Set([
  "membru-adauga",     // generează codul unui membru nou
  "membru-cotizatie",  // marchează cotizația la zi
  "trimite-cod",       // trimite codul pe e-mail
]);

/**
 * Restul rămâne al administratorului. Nu-l enumerăm: orice acțiune care nu e explicit
 * dată registraturii e a lui. Așa, o acțiune NOUĂ e implicit închisă, nu implicit
 * deschisă — greșeala se face în partea sigură.
 */
export function poateFace(actiune, eu) {
  if (!eu) return false;
  if (eu.rol === "admin") return true;
  if (eu.rol !== "registratura") return false;
  if (ALE_REGISTRATURII.has(actiune)) return true;
  if (CU_DREPT_DE_ACCES.has(actiune)) return eu.poateDaAcces === true;
  return false;
}

/** Registratura își vede în jurnal doar propriile fapte, nu tot registrul. */
export function jurnalDoarAleMele(eu) {
  return !!eu && eu.rol === "registratura";
}

/** Mesajul de refuz, pe înțelesul celui care-l primește. */
export function motivRefuz(actiune, eu) {
  if (eu && eu.rol === "registratura" && CU_DREPT_DE_ACCES.has(actiune)) {
    return "Codurile de acces le generează registratorul desemnat. Cere-i administratorului acest drept.";
  }
  return "Nu ai dreptul la această operațiune.";
}

/**
 * Antet pus pe refuzurile de DREPT, ca limitatorul să nu le socotească încercări de
 * spargere.
 *
 * „Nu ești cine spui" și „ești cine spui, dar n-ai voie aici" sunt două lucruri diferite.
 * Primul e semnal de atac și trebuie numărat. Al doilea e un om care apasă un buton la
 * care nu are drept — dacă îl numărăm, îl împingem spre blocare pentru o greșeală
 * nevinovată. Dispozitivul nerecunoscut rămâne numărat: acolo chiar e un semnal.
 */
export const ANTET_REFUZ_DREPT = "x-refuz-drept";
