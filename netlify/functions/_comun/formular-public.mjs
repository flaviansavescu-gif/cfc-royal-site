// _comun/formular-public.mjs — apărarea formularelor deschise oricui.
//
// Un formular public e o ușă prin care oricine scrie în magazia noastră și, de multe
// ori, declanșează un e-mail. Fără limită, un singur robot poate umple coada de
// înscrieri cu mii de câini inventați, poate consuma cota de e-mail a asociației și
// poate face administrarea imposibilă exact în săptămâna în care contează.
//
// Două apărări, amândouă ieftine:
//
//   CAPCANA — un câmp pe care omul nu-l vede, deci nu-l completează. Roboții completează
//   tot ce găsesc. Când e plin, răspundem cu SUCCES prefăcut: dacă am răspunde cu eroare,
//   robotul ar afla că a fost prins și ar încerca altfel.
//
//   LIMITA — un număr de trimiteri pe fereastră de timp, pe adresă IP. Pragurile sunt
//   generoase, ca la autentificare: o adresă e împărțită de tot biroul sau de toți
//   abonații unui operator mobil, iar o familie cu trei câini trebuie să poată înscrie
//   trei câini.
//
// Dacă limitarea însăși dă eroare, cererea TRECE. Apărarea n-are voie să devină ea
// însăși cauza unei căderi în ziua înscrierilor.
import { createHash } from "node:crypto";

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

/** Adresa clientului, amprentată — nu ținem IP-uri în clar. */
export function amprentaIp(req) {
  const h = req.headers;
  const ip =
    h.get("x-nf-client-connection-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "necunoscut";
  return sha256(ip).slice(0, 32);
}

/** Capcana e plină? Atunci cererea vine de la un robot. */
export function eRobot(body, camp = "website") {
  return String(body?.[camp] ?? "").trim().length > 0;
}

/**
 * Verifică și numără o trimitere.
 *
 * @returns {Promise<{permis: boolean, ramase?: number, dupaSecunde?: number}>}
 */
export async function limiteazaTrimiterile(store, prefix, req, { max = 10, fereastraMs = 3600e3 } = {}) {
  let cheie;
  try {
    cheie = prefix + "/" + amprentaIp(req);
    const acum = Date.now();
    const c = await store.get(cheie, { type: "json" });
    const inFereastra = c && acum - c.de < fereastraMs;

    if (inFereastra && c.n >= max) {
      return { permis: false, dupaSecunde: Math.ceil((c.de + fereastraMs - acum) / 1000) };
    }
    await store.setJSON(cheie, inFereastra ? { n: c.n + 1, de: c.de } : { n: 1, de: acum });
    return { permis: true, ramase: max - ((inFereastra ? c.n : 0) + 1) };
  } catch (err) {
    // Magazia nu răspunde: lăsăm omul să se înscrie. Mai bine o cerere nenumărată
    // decât o expoziție la care nimeni nu se poate înscrie.
    console.error("Limitarea formularului public a eșuat (cererea trece):", err);
    return { permis: true };
  }
}

/** Câte minute până se poate reîncerca, în cuvinte pentru om. */
export function minuteText(secunde) {
  const m = Math.max(1, Math.ceil((secunde || 0) / 60));
  return m === 1 ? "un minut" : m + " de minute";
}
