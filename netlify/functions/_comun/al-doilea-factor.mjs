// _comun/al-doilea-factor.mjs — a doua cheie pentru rolurile grele ale registrului.
//
// PROBLEMA. Un singur cod deschidea tot: dosarele, certificatele, arhiva cu scanuri de
// acte. Codul se dictează la telefon, se scrie pe hârtie, ajunge într-un mesaj. Cine îl
// află — o dată, oricum — are registrul, de oriunde, pentru totdeauna.
//
// CE APĂRĂM, DE FAPT. Nu pagina de intrare: ACȚIUNILE. O apărare pusă doar la intrare
// e teatru — cine are codul cheamă funcțiile direct și n-a văzut niciodată pagina. De
// aceea fiecare cerere privilegiată trebuie să poarte și jetonul de dispozitiv.
//
// CUM MERGE.
//   1. Cod bun, dispozitiv necunoscut -> se trimite un cod de șase cifre pe e-mailul
//      asociației (sau al registratorului) și se deschide o „intrare în așteptare".
//   2. Codul din e-mail, introdus corect -> se naște un JETON DE DISPOZITIV, ținut de
//      browser. Valabil 30 de zile; după aceea, iar e-mail.
//   3. Orice acțiune privilegiată cere COD + JETON. Lipsa jetonului = refuz.
//
// În stocare stau doar AMPRENTE, ca la coduri: nici codul din e-mail, nici jetonul nu
// se pot citi înapoi din magazie.
//
// SCĂPAREA DE URGENȚĂ. Dacă e-mailul cade cu totul, `FARA_AL_DOILEA_FACTOR=1` în
// Netlify oprește mecanismul. E o variabilă de mediu dinadins: ca s-o pui, îți trebuie
// deja contul Netlify — adică o cheie mai tare decât cea pe care o ocolești.
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { postaConfigurata } from "./posta.mjs";

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

/** Cât ține un dispozitiv recunoscut. */
export const DISPOZITIV_ZILE = 30;
/** Cât ține codul primit pe e-mail. */
export const OTP_MINUTE = 10;
/** Câte încercări are omul la codul din e-mail. */
export const OTP_INCERCARI = 5;

/** Rolurile care cer a doua cheie. Membrii nu: ei își văd doar propriile dosare. */
export const ROLURI_PROTEJATE = ["admin", "registratura"];

export const opritDinMediu = () => String(process.env.FARA_AL_DOILEA_FACTOR || "") === "1";

/**
 * Poate mecanismul să funcționeze, cu adevărat?
 *
 * REGULA CARE LIPSEA, ȘI CARE A ÎNCUIAT ADMINISTRATORUL AFARĂ. Poarta de intrare
 * spunea „nu pot trimite codul, intră fără el", iar poarta acțiunilor spunea „n-ai
 * dispozitiv recunoscut, ieși". Omul intra și era dat afară imediat, la prima cerere.
 *
 * O apărare pe jumătate pornită e mai rea decât una oprită: nu apără nimic și blochează
 * pe toată lumea. Dacă nu e operațională, e OPRITĂ PESTE TOT — la intrare și la acțiuni,
 * deodată.
 */
export const operational = () => !opritDinMediu() && postaConfigurata();

/** Șase cifre, din generatorul criptografic — nu din Math.random. */
export function codNumeric() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Jeton de dispozitiv: 32 de octeți. Se dă o dată; în magazie rămâne amprenta. */
export function jetonNou() {
  return randomBytes(32).toString("hex");
}

export const amprenta = (x) => sha256(x);

function egal(a, b) {
  const x = Buffer.from(String(a || ""), "utf8");
  const y = Buffer.from(String(b || ""), "utf8");
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

// ————————————————————— logica, fără magazie (testabilă) —————————————————————

/**
 * E valid dispozitivul?
 * @param {object|null} inreg  ce scrie în magazie despre el
 * @param {string} rol         rolul cerut acum
 */
export function dispozitivValid(inreg, rol, acum = Date.now()) {
  if (!inreg) return false;
  if (inreg.rol !== rol) return false;                     // un jeton de registratură nu deschide adminul
  const expira = Date.parse(inreg.expira || "");
  return Number.isFinite(expira) && expira > acum;
}

/**
 * Verifică codul primit pe e-mail.
 * @returns {{ok: true}|{eroare: string, incercariRamase?: number, expirat?: boolean}}
 */
export function verificaOtp(inreg, otpDat, acum = Date.now()) {
  if (!inreg) return { eroare: "Intrarea nu mai există. Ia-o de la capăt." };
  const expira = Date.parse(inreg.expira || "");
  if (!Number.isFinite(expira) || expira <= acum) {
    return { eroare: `Codul din e-mail a expirat (era valabil ${OTP_MINUTE} minute). Ia-o de la capăt.`, expirat: true };
  }
  if ((inreg.incercari || 0) >= OTP_INCERCARI) {
    return { eroare: "Prea multe încercări greșite. Ia-o de la capăt.", expirat: true };
  }
  const dat = String(otpDat || "").replace(/\D/g, "");
  if (!egal(sha256(dat), inreg.otpAmprenta || "")) {
    const ramase = OTP_INCERCARI - ((inreg.incercari || 0) + 1);
    return {
      eroare: ramase > 0
        ? `Cod greșit. Mai ai ${ramase} ${ramase === 1 ? "încercare" : "încercări"}.`
        : "Cod greșit. Ai epuizat încercările — ia-o de la capăt.",
      incercariRamase: Math.max(0, ramase),
    };
  }
  return { ok: true };
}

/** Momentul în care expiră o intrare în așteptare / un dispozitiv. */
export const expiraLa = (ms, acum = Date.now()) => new Date(acum + ms).toISOString();
export const OTP_MS = OTP_MINUTE * 60e3;
export const DISPOZITIV_MS = DISPOZITIV_ZILE * 24 * 3600e3;

// ————————————————————— partea cu magazie —————————————————————

/**
 * Poarta acțiunilor: cererea poartă un dispozitiv recunoscut pentru rolul cerut?
 * Întoarce `true` și când mecanismul e oprit din mediu — dar atunci a decis un om
 * care are deja acces la Netlify.
 */
export async function dispozitivCunoscut(store, jeton, rol) {
  // Nu cerem a doua cheie acolo unde nu o putem da. Vezi `operational`.
  if (!operational()) return true;
  const j = String(jeton || "").trim();
  if (!j) return false;
  try {
    const inreg = await store.get("dispozitiv/" + amprenta(j), { type: "json" });
    return dispozitivValid(inreg, rol);
  } catch (err) {
    // Magazia nu răspunde: NU deschidem. A doua cheie n-are voie să cedeze prima.
    console.error("Verificarea dispozitivului a eșuat:", err);
    return false;
  }
}

/** Deschide o intrare în așteptare și întoarce codul de trimis pe e-mail. */
export async function deschideIntrarea(store, { rol, cine, email }) {
  const otp = codNumeric();
  const id = randomBytes(16).toString("hex");
  await store.setJSON("intrare/" + id, {
    rol, cine: String(cine || "").slice(0, 120), email: String(email || "").slice(0, 200),
    otpAmprenta: sha256(otp),
    incercari: 0,
    expira: expiraLa(OTP_MS),
    creat: new Date().toISOString(),
  });
  return { id, otp };
}

/**
 * Confirmă intrarea. La reușită naște jetonul de dispozitiv (întors o singură dată).
 */
export async function confirmaIntrarea(store, id, otp) {
  const cheie = "intrare/" + String(id || "").slice(0, 64);
  const inreg = await store.get(cheie, { type: "json" }).catch(() => null);
  const r = verificaOtp(inreg, otp);

  if (!r.ok) {
    if (inreg && !r.expirat) {
      await store.setJSON(cheie, { ...inreg, incercari: (inreg.incercari || 0) + 1 }).catch(() => {});
    } else if (inreg) {
      await store.delete(cheie).catch(() => {});
    }
    return { eroare: r.eroare };
  }

  await store.delete(cheie).catch(() => {});          // de unică folosință
  const jeton = jetonNou();
  await store.setJSON("dispozitiv/" + amprenta(jeton), {
    rol: inreg.rol, cine: inreg.cine,
    creat: new Date().toISOString(),
    expira: expiraLa(DISPOZITIV_MS),
  });
  return { ok: true, rol: inreg.rol, cine: inreg.cine, jeton };
}
