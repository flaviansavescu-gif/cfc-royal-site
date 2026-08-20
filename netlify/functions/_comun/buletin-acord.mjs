// _comun/buletin-acord.mjs — consimțământul pentru buletin: cum se cere, cum se
// dovedește, cum se retrage.
//
// DE CE. Abonarea la buletin se sprijină pe CONSIMȚĂMÂNT (art. 6 alin. 1 lit. a GDPR).
// Un consimțământ valabil trebuie să fie liber, specific, informat și **neechivoc** —
// iar operatorul trebuie să poată DOVEDI că a fost dat (art. 7 alin. 1). Formularul din
// subsolul site-ului cerea doar adresa: o casetă de text și un buton. Trei lipsuri:
//
//   1. Nicio bifă. Scrierea adresei într-un câmp nu e o manifestare neechivocă de voință
//      pentru primirea de comunicări — e doar o adresă scrisă.
//   2. Nicio verificare a adresei. Oricine putea abona adresa altcuiva, iar acela primea
//      mesaje pe care nu le-a cerut niciodată.
//   3. Nicio dovadă. Dacă cineva ar fi reclamat că n-a cerut buletinul, n-aveam ce arăta.
//
// Aici stau cele trei reparații: textul acordului (o singură sursă, cu versiune),
// jetoanele de confirmare și de dezabonare, și forma dovezii care se păstrează.
//
// DE CE JETOANE ALEATOARE, NU SEMNĂTURI. Un jeton semnat cu o cheie ar fi cerut încă un
// secret în Netlify. Un jeton aleator păstrat în magazie face aceeași treabă și, în plus,
// se poate RETRAGE: după confirmare, jetonul de așteptare dispare, deci linkul nu mai
// poate fi folosit a doua oară.
import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

/** Magazia jetoanelor și a dovezilor. Aceeași în care stau contoarele de acces. */
export const magazie = () => getStore("acces");

/**
 * TEXTUL acordului — o singură sursă. Se afișează lângă bifă ȘI se păstrează în dovadă:
 * la o reclamație trebuie să putem arăta nu doar CĂ omul a bifat, ci CE a bifat.
 * La orice schimbare de conținut se ridică VERSIUNEA (acordurile vechi rămân legate de
 * textul lor, nu de cel nou).
 */
export const TEXT_ACORD =
  "Sunt de acord să primesc pe e-mail buletinul informativ al Clubului Federal Chinologic " +
  "Royal (noutăți, expoziții, anunțuri ale registrului). Îmi pot retrage acordul oricând, " +
  "dintr-un singur clic, din orice mesaj primit.";
export const VERSIUNE_ACORD = "2026-08-17";

/** Cât timp e valabil linkul de confirmare. După aceea, adresa dispare fără urmă. */
export const VALABILITATE_CONFIRMARE_MS = 48 * 3600e3;

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Adresa, adusă la forma de lucru (comparațiile se fac pe ea). */
export const normEmail = (v) => String(v || "").trim().toLowerCase().slice(0, 200);

/** Amprenta adresei — cheia sub care stă dovada. Adresa în clar e ÎN dovadă, nu în cheie. */
export const amprentaEmail = (email) =>
  crypto.createHash("sha256").update(normEmail(email)).digest("hex");

/** Un jeton nou: 32 de caractere din 128 de biți adevărați. */
export const jetonNou = () => crypto.randomBytes(16).toString("hex");

/**
 * Adresa IP, ca amprentă. Dovada consimțământului cere „de unde a venit cererea", dar
 * nu avem nevoie de IP-ul în clar ca s-o putem face: amprenta deosebește două cereri
 * între ele, ceea ce e tot ce trebuie la o reclamație.
 */
export function amprentaIp(req) {
  const h = req.headers;
  const ip =
    h.get("x-nf-client-connection-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "necunoscut";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

// ——— Cheile din magazie ———
export const cheieAsteptare = (jeton) => "buletin-asteptare/" + jeton;
export const cheieDezabonare = (jeton) => "buletin-dezabonare/" + jeton;
export const cheieDovada = (email) => "buletin-acord/" + amprentaEmail(email);

/**
 * Jetonul de dezabonare al unui abonat al BULETINULUI ȘCOLII: îl face dacă nu-l are,
 * îl întoarce dacă îl are. Folosit și la abonare (buletin-cursuri), și la trimiterea
 * din fundal (buletin-trimite-background) — de aceea stă aici, în locul comun.
 * `store` e magazia „cursuri" (acolo stau abonații); jetoanele stau în magazia „acces".
 */
export async function jetonDezabonare(store, cheie, abonat) {
  if (abonat?.jetonDezabonare) return abonat.jetonDezabonare;
  const jeton = jetonNou();
  try {
    await magazie().setJSON(cheieDezabonare(jeton), { email: abonat.email, lista: "scoala" });
    await store.setJSON(cheie, { ...abonat, jetonDezabonare: jeton });
  } catch (err) {
    console.error("Jetonul de dezabonare nu s-a putut păstra:", err);
    return null;
  }
  return jeton;
}

/** A expirat cererea de confirmare? */
export const expirat = (cerere, acum = Date.now()) => {
  const t = Date.parse(cerere?.cerut || "");
  return !Number.isFinite(t) || acum - t > VALABILITATE_CONFIRMARE_MS;
};

/**
 * Ritmul îngăduit unei adrese IP la abonare: nu e o poartă de autentificare, deci pragul
 * nu apără un secret. Apără OAMENII: fără el, cineva putea trimite de la aceeași mașină
 * mii de cereri de confirmare către adrese străine — fiecare, un e-mail nesolicitat
 * plecat de la adresa oficială a asociației.
 */
export const MAX_CERERI = 5;
export const FEREASTRA_CERERI_MS = 3600e3; // într-o oră

/** @returns {Promise<boolean>} mai are voie să ceară? */
export async function poateCere(s, ampIp) {
  try {
    const cheie = "buletin-ritm/" + ampIp;
    const acum = Date.now();
    const r = (await s.get(cheie, { type: "json" })) || { n: 0, de: acum };
    if (!r.de || acum - r.de > FEREASTRA_CERERI_MS) { r.n = 0; r.de = acum; }
    if (r.n >= MAX_CERERI) return false;
    r.n += 1;
    await s.setJSON(cheie, r);
    return true;
  } catch (err) {
    // Apărarea nu are voie să devină ea însăși cauza unei căderi.
    console.error("Ritmul abonărilor nu s-a putut citi:", err);
    return true;
  }
}
