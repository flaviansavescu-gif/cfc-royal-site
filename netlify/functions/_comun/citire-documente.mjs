// =========================================================================
// citire-documente.mjs — numele cheilor și socoteala banilor, într-un singur loc.
//
// Poarta (`registratura-citeste.mjs`) și lucrătorul (`…-background.mjs`) trebuie să
// vorbească despre ACELEAȘI chei. Scrise de două ori, se despart la prima schimbare —
// iar despărțirea arată ca „citirea nu se mai termină niciodată", fiindcă unul scrie
// unde celălalt nu se uită.
// =========================================================================

/** Prețul modelului, ca să spunem costul în bani, nu doar în jetoane. */
export const MODEL = "claude-opus-5";
export const PRET = { intrare: 5 / 1_000_000, iesire: 25 / 1_000_000 };   // USD per jeton

/**
 * Plafon de cheltuială pe zi. Un dosar costă vreo 10 cenți, deci plafonul nu stă în calea
 * lucrului obișnuit — stă în calea greșelii: un buton apăsat în buclă, sau un cod de
 * registratură ajuns unde nu trebuie. Prima oprire trebuie să fie una omenească.
 */
export const PLAFON_ZI = Number(process.env.CITIRE_PLAFON_ZI || 5);   // USD

/**
 * După atâta timp, o citire „în lucru" se socotește moartă.
 *
 * Măsurat pe cuibul 26: 36 de secunde pentru două documente. Cinci minute lasă loc și
 * pentru un act mult mai încărcat, dar nu blochează dosarul o zi întreagă dacă funcția
 * de fundal a căzut.
 */
export const ABANDONAT_MS = 5 * 60e3;

export const cheiaZilei = (zi) => "citire/zi/" + (zi || new Date().toISOString().slice(0, 10));
export const cheiaStarii = (id) => "citire/stare/" + id;
export const cheiaJetonului = (id) => "citire/jeton/" + id;
export const cheiaUrmei = (id) => "citire/urma/" + id;

/** Toate cheile lăsate în urmă de o citire, pentru curățenie la ștergerea dosarului. */
export const cheileCitirii = (id) => [cheiaStarii(id), cheiaJetonului(id), cheiaUrmei(id)];

const octetiHex = (n) => {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
};

/** 32 de octeți: jetonul e singura cheie a funcției de fundal, deci trebuie neghicibil. */
export const jetonNou = () => octetiHex(32);

/** Aceeași amprentă ca peste tot în registru — sincronă, ca să nu ceară await. */
export { sha256 as amprenta } from "./roluri.mjs";

/**
 * Comparație în timp constant, ca la codurile de acces: o comparație obișnuită se oprește
 * la prima literă diferită, iar diferența de timp spune cât din jeton a fost ghicit.
 */
export function egal(a, b) {
  const x = String(a || ""), y = String(b || "");
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

/** Cât costă o cerere, în dolari. */
export const costul = (jIn, jOut) => jIn * PRET.intrare + jOut * PRET.iesire;

/** Cenții, spuși pe înțeles. */
export const inCenti = (usd) => `~${(usd * 100).toFixed(2)} cenți`;
