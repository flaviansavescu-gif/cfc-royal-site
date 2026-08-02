// canise.mjs — regulile afixului, într-un singur loc.
//
// Afixul e semnătura canisei: două canise cu „acelasi nume" scris altfel — CARPAȚI,
// Carpati, C a r p a t i — ar fi, în fapt, același afix. De aceea unicitatea nu se
// judecă pe litere, ci pe forma NORMALIZATĂ: fără diacritice, fără spații și cratime,
// fără mărunțișuri de tastatură. Regulamentul de înregistrare a caniselor cere ca
// afixul să fie deosebit de cele existente; aici e definiția lui „deosebit".

/** Litere îngăduite într-un afix: litere (cu diacritice), cifre, spațiu, cratimă, apostrof. */
const INGADUIT = /^[\p{L}\p{N}\s\-']+$/u;

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();

/**
 * Forma sub care se compară afixele: MAJUSCULE, fără diacritice, fără spații/cratime.
 * „Vulturii Carpaților" și „VULTURII-CARPATILOR" sunt același afix.
 */
export function normalizeazaAfix(afix) {
  return taie(afix, 60)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // diacriticele combinate
    .replace(/ă/gi, "a").replace(/â/gi, "a").replace(/î/gi, "i")
    .replace(/ș|ş/gi, "s").replace(/ț|ţ/gi, "t")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * E o propunere de afix pe care o putem măcar judeca?
 * Nu hotărăște frumusețea numelui — doar oprește ce nu poate fi un afix: gol, prea
 * scurt ca să deosebească ceva, prea lung ca să încapă pe un act, semne străine.
 */
export function afixValid(afix) {
  const a = taie(afix, 80);
  if (a.length < 3) return { ok: false, motiv: "prea scurt (cel puțin 3 litere)" };
  if (a.length > 40) return { ok: false, motiv: "prea lung (cel mult 40 de semne)" };
  if (!INGADUIT.test(a)) return { ok: false, motiv: "conține semne neîngăduite (doar litere, cifre, spații, cratime)" };
  if (normalizeazaAfix(a).length < 3) return { ok: false, motiv: "prea puține litere" };
  return { ok: true };
}

/**
 * Verdictul unei variante față de afixele deja luate.
 *
 * `ocupate` e o hartă normalizat -> eticheta purtătorului (ex. „canisa CARPAȚI, membru
 * V. Ionescu"). Verdictul SPUNE cine îl poartă: registratura hotărăște cu ochii pe
 * fapte, nu pe un „ocupat" sec.
 */
export function verdictAfix(varianta, ocupate) {
  const v = afixValid(varianta);
  if (!v.ok) return { stare: "invalid", motiv: v.motiv };
  const n = normalizeazaAfix(varianta);
  if (ocupate.has(n)) return { stare: "ocupat", deCine: ocupate.get(n) };
  return { stare: "liber" };
}

/**
 * Frâna după respingere: o cerere nouă se primește abia după 24 de ore.
 *
 * Fără ea, un membru respins putea depune iar și iar, în aceeași oră — fiecare cerere
 * umplând coada registraturii și trimițând e-mailuri. Frâna nu pedepsește: îi dă omului
 * răgaz să citească motivul respingerii și să vină cu variante gândite, nu cu aceleași.
 */
export const RACIRE_DUPA_RESPINGERE_MS = 24 * 3600e3;

/** Poate depune o cerere nouă, față de cea mai NOUĂ cerere a lui de până acum? */
export function poateDepuneDinNou(cerereVeche, acum = Date.now()) {
  if (!cerereVeche || cerereVeche.stare !== "respinsa") return { ok: true };
  const la = Date.parse(cerereVeche.hotarata || cerereVeche.creat || "");
  if (!Number.isFinite(la)) return { ok: true };   // dată ilizibilă: nu blocăm din greșeală
  const trecut = acum - la;
  if (trecut >= RACIRE_DUPA_RESPINGERE_MS) return { ok: true };
  return { ok: false, oreRamase: Math.max(1, Math.ceil((RACIRE_DUPA_RESPINGERE_MS - trecut) / 3600e3)) };
}

/** Cheile unei cereri de canisă — numite aici ca formularul și registratura să nu se despartă. */
export const cheiaCererii = (id) => "canisa-cerere/" + id;
export const cheiaCanisei = (afixNorm) => "canisa/" + afixNorm;
export const PREFIX_CERERI = "canisa-cerere/";
export const PREFIX_CANISE = "canisa/";
