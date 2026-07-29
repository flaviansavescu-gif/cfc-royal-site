// =========================================================================
// repetitie.mjs — regulile modului repetiție, scoase din funcție ca să poată fi probate.
//
// Ștergerea unei repetiții mătură tot ce ține de o expoziție: înscrieri, dovezi de plată,
// verificările registraturii, auditul. Pe o expoziție ADEVĂRATĂ ar fi o catastrofă
// tăcută — nimeni n-ar băga de seamă până în ziua în care cineva caută dovada unei plăți.
//
// O regulă atât de scumpă nu are ce căuta îngropată într-un `if` dintr-o funcție de 500
// de rânduri, unde nu poate fi probată decât citind-o cu ochii. Stă aici, singură, și e
// probată pe fapte: i se dau configurații și se vede ce răspunde.
// =========================================================================

/** Expoziția e marcată ca repetiție? Un singur loc unde se citește marcajul. */
export const eRepetitie = (config) => config?.repetitie === true;

/**
 * Se poate șterge? Răspunde cu motivul, nu doar cu da/nu — mesajul ajunge la om.
 *
 * REGULA: marcajul trebuie PUS ÎNAINTE, printr-o altă acțiune. Ștergerea nu și-l poate
 * pune singură; altfel paza ar fi o ușă cu cheia lăsată în broască.
 */
export function poateSterge(config) {
  if (!config) {
    return { ok: false, status: 404, eroare: "Expoziția nu e publicată online." };
  }
  if (!eRepetitie(config)) {
    return {
      ok: false, status: 403,
      eroare: "Expoziția nu e marcată ca repetiție. Ștergerea se face doar la repetiții.",
    };
  }
  return { ok: true };
}

/**
 * Tot ce ține de o expoziție, pe prefixe. Fiecare e legat de showId: un prefix rămas
 * fără showId ar mătura toate expozițiile deodată.
 */
export function prefixeleExpozitiei(showId) {
  const id = String(showId || "");
  if (!id) throw new Error("Ștergere fără showId — refuzată.");
  return [
    { prefix: "coada/" + id + "/", camp: "coada" },
    { prefix: "dovada/" + id + "/", camp: "dovezi" },
    { prefix: "verificare/" + id + "/", camp: "verificari" },
    { prefix: "audit/" + id + "/", camp: "audit" },
    { prefix: "proprietar/" + id + "/", camp: "proprietari" },
  ];
}

/** Cheile singuratice (nu prefixe) ale unei expoziții. */
export const cheileExpozitiei = (showId) => ["rezultate/" + showId, "config/" + showId];

/**
 * O repetiție nu apare în formularul public decât dacă cererea o cere anume, și NU apare
 * în calendar niciodată. Calendarul e pagina publică a asociației; acolo nu intră o probă
 * în nicio împrejurare.
 */
export const seVedeInFormular = (config, cuRepetitii) => !eRepetitie(config) || cuRepetitii === true;
export const seVedeInCalendar = (config) => !eRepetitie(config);
