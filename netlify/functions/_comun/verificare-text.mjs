// =========================================================================
// verificare-text.mjs — ce SCRIE pagina de verificare, pentru fiecare fel de act.
//
// Sistemul verifică două lucruri deosebite cu același mecanism: certificate numerotate și
// rezultate împărtășite (imaginea pe care expozantul o pune pe Facebook). Până acum pagina
// spunea „Certificat autentic" pentru amândouă — iar un exemplar cu „Excelent" și fără
// titlu chiar n-are certificat. Cuvintele contează aici mai mult decât oriunde: pagina
// asta există tocmai ca să spună adevărul despre un act.
//
// Formulările stau în modulul lor, nu împrăștiate prin funcție și prin pagină, ca să poată
// fi probate și ca să nu se despartă una de alta la prima modificare.
// =========================================================================

/** Felul actului, dedus din pachetul semnat. Lipsa câmpului = certificat, ca înainte. */
export const felActului = (p) => (p?.k === "rezultat" ? "rezultat" : "certificat");

/** Cum se numește identificatorul, pe înțelesul cititorului. */
export const etichetaCod = (fel) => (fel === "rezultat" ? "Cod rezultat" : "Serie");

/** Rândul de stare, cel scris mare pe cartonaș. */
export function textStare(fel, stare) {
  if (stare === "anulat") return fel === "rezultat" ? "⚠ Rezultat ANULAT" : "⚠ Certificat ANULAT";
  if (stare === "valid") return fel === "rezultat" ? "✓ Rezultat confirmat" : "✓ Certificat autentic";
  return fel === "rezultat" ? "✕ Rezultat neconfirmat" : "✕ Certificat neconfirmat";
}

/** Explicația de sub cartonaș, când actul e valabil. */
export function notaValid(fel) {
  if (fel === "rezultat") {
    return (
      "Acest rezultat a fost înregistrat de Asociația Club Federal Chinologic – Royal la " +
      "expoziția de mai sus și confirmat prin semnătură digitală. Dacă titlul ar fi fost " +
      "retras între timp, aici ar scrie ANULAT. Situația completă a exemplarului se vede " +
      "pe fișa lui din cartea de origini."
    );
  }
  return (
    "Acest certificat a fost emis de Asociația Club Federal Chinologic – Royal și " +
    "confirmat prin semnătură digitală."
  );
}

/** Explicația când actul a fost invalidat de delegat. */
export function motivAnulare(fel, cod) {
  if (fel === "rezultat") {
    return (
      `Rezultatul ${cod} a fost INVALIDAT. Titlul de pe imaginea împărtășită nu mai este ` +
      "valabil — fie a fost retras de delegatul World Dog Federation, fie situația " +
      "exemplarului s-a schimbat. Scrie la contact@cfc-royal.ro pentru lămuriri."
    );
  }
  return (
    `Actul ${cod} a fost ANULAT de delegatul World Dog Federation. ` +
    "Certificatul nu mai este valabil."
  );
}
