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
export const felActului = (p) =>
  (["rezultat", "diploma", "legitimatie"].includes(p?.k) ? p.k : "certificat");

/** Numele felului, cu articulare corectă pentru rândul de stare. */
const NUMELE = {
  rezultat: { valid: "Rezultat confirmat", anulat: "Rezultat ANULAT", nu: "Rezultat neconfirmat" },
  diploma: { valid: "Diplomă autentică", anulat: "Diplomă ANULATĂ", nu: "Diplomă neconfirmată" },
  legitimatie: { valid: "Legitimație autentică", anulat: "Legitimație ANULATĂ", nu: "Legitimație neconfirmată" },
  certificat: { valid: "Certificat autentic", anulat: "Certificat ANULAT", nu: "Certificat neconfirmat" },
};

/** Cum se numește identificatorul, pe înțelesul cititorului. */
export const etichetaCod = (fel) => (fel === "rezultat" ? "Cod rezultat" : "Serie");

/** Rândul de stare, cel scris mare pe cartonaș. */
export function textStare(fel, stare) {
  const n = NUMELE[fel] || NUMELE.certificat;
  if (stare === "anulat") return "⚠ " + n.anulat;
  if (stare === "valid") return "✓ " + n.valid;
  return "✕ " + n.nu;
}

/** Explicația de sub cartonaș, când actul e valabil. */
export function notaValid(fel) {
  if (fel === "diploma") {
    return (
      "Această diplomă a fost emisă de Școala de Arbitraj a Asociației Club Federal " +
      "Chinologic – Royal, la absolvirea programului de formare, și confirmată prin " +
      "semnătură digitală. Arbitrii certificați se regăsesc în registrul public de pe " +
      "cfc-royal.ro/arbitri/."
    );
  }
  if (fel === "legitimatie") {
    return (
      "Această legitimație atestă calitatea de arbitru al Asociației Club Federal " +
      "Chinologic – Royal, cu grupele WDF înscrise pe act, și e confirmată prin " +
      "semnătură digitală. Dacă i s-ar fi retras dreptul de arbitraj, aici ar scrie " +
      "ANULATĂ. Registrul public al arbitrilor: cfc-royal.ro/arbitri/."
    );
  }
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
  if (fel === "diploma" || fel === "legitimatie") {
    return (
      `Actul ${cod} a fost ANULAT de Colegiul de Arbitri și nu mai este valabil. ` +
      "Scrie la contact@cfc-royal.ro pentru lămuriri."
    );
  }
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
