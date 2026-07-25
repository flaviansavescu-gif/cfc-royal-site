// _comun/limitare.mjs — limitarea încercărilor de autentificare (anti-forță brută).
//
// Codurile platformei sunt scurte prin natura lor (se dictează la telefon), deci
// singura apărare reală împotriva enumerării este limitarea încercărilor.
// Contorul stă în Blobs, pe adresa IP a clientului, cu fereastră glisantă.
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const store = () => getStore("acces");

// Pragurile sunt DELIBERAT generoase. Contorul e pe adresă IP, iar o adresă e
// împărțită de tot biroul, toată casa sau toți abonații unui operator mobil —
// un prag mic îi blochează pe toți din cauza greșelilor unuia singur.
//
// Aritmetica arată că nu pierdem nimic: un cod de candidat are 8 caractere din
// 31 posibile = 852 de miliarde de variante. Cu 20 de încercări la 5 minute
// (~5.760 pe zi) epuizarea lor ar dura peste 400.000 de ani. Limitarea trebuie
// doar să facă enumerarea imposibilă, nu să pedepsească omul care greșește codul.
export const MAX_ESECURI = 20;         // încercări greșite permise…
export const FEREASTRA_MS = 10 * 60e3; // …în zece minute
export const BLOCARE_MS = 5 * 60e3;    // cât ține blocarea după depășire

/** Adresa clientului, așa cum o pune Netlify în fața funcției. */
export function ipClient(req) {
  const h = req.headers;
  const ip =
    h.get("x-nf-client-connection-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "necunoscut";
  // Nu stocăm IP-ul în clar — doar o amprentă, suficientă pentru numărare.
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Verifică dacă adresa mai are dreptul să încerce.
 * Întoarce { permis:true } sau { permis:false, dupaSecunde }.
 */
export async function verificaLimita(cheie) {
  try {
    const r = await store().get("limita/" + cheie, { type: "json" });
    if (!r) return { permis: true };
    const acum = Date.now();
    if (!r.blocatPana || r.blocatPana <= acum) return { permis: true };

    // Nimeni nu așteaptă mai mult decât prevede politica ACTUALĂ. Dacă pragurile se
    // relaxează, o blocare înregistrată sub regulile vechi se scurtează efectiv —
    // rescriem termenul, nu doar mesajul. Se întâmplă o singură dată per blocare.
    if (r.blocatPana - acum > BLOCARE_MS) {
      r.blocatPana = acum + BLOCARE_MS;
      try { await store().setJSON("limita/" + cheie, r); } catch (e) { /* mesajul rămâne corect oricum */ }
    }
    return { permis: false, dupaSecunde: Math.ceil((r.blocatPana - acum) / 1000) };
  } catch (err) {
    // Dacă store-ul nu răspunde, NU blocăm autentificarea legitimă.
    console.error("Citire limită eșuată:", err);
    return { permis: true };
  }
}

/**
 * Înregistrează o încercare greșită; blochează adresa la depășirea pragului.
 * Întoarce câte încercări au mai rămas (sau -1 dacă nu s-a putut număra) —
 * folosit în răspuns, ca utilizatorul să știe unde se află, și ca semnal de
 * diagnostic: dacă numărul nu scade, înseamnă că scrierea în Blobs nu reușește.
 */
export async function inregistreazaEsec(cheie) {
  try {
    const acum = Date.now();
    const r = (await store().get("limita/" + cheie, { type: "json" })) || { n: 0, de: acum };
    // Fereastră glisantă: dacă a trecut fereastra de la prima încercare, o luăm de la capăt.
    if (!r.de || acum - r.de > FEREASTRA_MS) { r.n = 0; r.de = acum; r.blocatPana = 0; }
    r.n = (r.n || 0) + 1;
    let ramase = MAX_ESECURI - r.n;
    if (r.n >= MAX_ESECURI) { r.blocatPana = acum + BLOCARE_MS; r.n = 0; r.de = acum; ramase = 0; }
    await store().setJSON("limita/" + cheie, r);
    return ramase;
  } catch (err) { console.error("Scriere limită eșuată:", err); return -1; }
}

/** Autentificare reușită — ștergem contorul adresei. */
export async function resetLimita(cheie) {
  try { await store().delete("limita/" + cheie); } catch (err) { console.error(err); }
}
