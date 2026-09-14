// pedigree-optional.mjs — expozițiile la care NUMĂRUL DE PEDIGREE e opțional pe formular,
// indiferent de bifa „Doresc pedigree de tipicitate" (decizia VP Tehnic și de Arbitraj,
// 14.09.2026, DOAR pentru „Cupa Bucegi" — Străjerii Munților, 3 octombrie 2026).
//
// Regula generală rămâne: un câine fără pedigree se înscrie pe traseul de tipicitate (bifa),
// altfel numărul e obligatoriu. Aici stă excepția, într-un singur loc, citit și de formular
// (prin GET, câmpul `pedigreeOptional`) și de server (la validarea fiecărui câine) — ca cele
// două să nu poată diverge. Pentru altă expoziție: adaugă showId-ul ei din manager.
export const EXPOZITII_PEDIGREE_OPTIONAL = new Set([
  "cmttz0fa10000ks28lgagj4h7", // C.A.C.I.B. WDF - „Cupa Bucegi" Străjerii Munților - Ediția I (03.10.2026)
]);

/** La această expoziție numărul de pedigree e opțional, chiar fără bifa de tipicitate? */
export const pedigreeOptional = (showId) => EXPOZITII_PEDIGREE_OPTIONAL.has(String(showId || ""));
