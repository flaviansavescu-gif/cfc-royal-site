// _comun/secret.mjs — verificarea secretului comun mașină-la-mașină (EXPO_SYNC_SECRET),
// dintr-un singur loc și în TIMP CONSTANT.
//
// DE CE. Secretul dintre manager și site păzește lucruri grele: import în registru,
// rescrieri de pedigree, declanșarea copiei, publicarea paginilor de rezultate. Era
// comparat cu `!==` în vreo opt funcții — o comparație care se oprește la prima diferență,
// deci scurge, teoretic, câte ceva despre secret prin durata răspunsului. La un secret de
// mare entropie atacul e practic imposibil, dar consecvența nu strică: peste tot la fel,
// în timp constant, ca la codurile de acces.
import { timingSafeEqual } from "node:crypto";

/**
 * Secretul primit e cel așteptat? Întoarce `false` (fail-closed) dacă secretul din mediu
 * lipsește — fără el, nimic nu trece — sau dacă lungimile diferă.
 */
export function secretEgal(dat, asteptat) {
  const s = String(asteptat == null ? "" : asteptat);
  if (!s) return false;
  const x = Buffer.from(String(dat == null ? "" : dat), "utf8");
  const y = Buffer.from(s, "utf8");
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}
