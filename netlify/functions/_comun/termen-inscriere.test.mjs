// termen-inscriere.test.mjs — când se închid înscrierile online.
//
// Regula pare banală, dar a fost greșită și a costat: se făcea
// `limita.setHours(23, 59, 59, 999)` pe termen. Două urmări, amândouă în defavoarea
// organizatorului:
//
//   1. ORA ANUNȚATĂ ERA ARUNCATĂ. Prima expoziție adevărată — C.A.C.I.B. Iași, ediția I —
//      anunță „ultima înscriere: 31 august, ora 21:00". Cu vechea regulă, formularul
//      primea înscrieri toată seara după ora aceea.
//   2. „SFÂRȘITUL ZILEI" ERA DUPĂ CEASUL SERVERULUI. `setHours` lucrează în fusul mașinii,
//      iar funcțiile merg pe UTC. Sfârșitul zilei de 31 august (UTC) cade pe 1 septembrie,
//      ora 3 dimineața la Iași — aproape șase ore de înscrieri primite după ce omul citise
//      pe site că s-au închis.
//
// De aceea probele de mai jos țin fusuri orare diferite, nu doar ore.
//
// Rulează: node netlify/functions/_comun/termen-inscriere.test.mjs
import { inchisPentruInscrieri } from "../inscriere-expo.mjs";

let rau = 0;
const t = (nume, bun, info) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + (!bun && info != null ? " -> " + info : ""));
};

/** Rulează o probă cu ceasul oprit la un moment anume. */
function laMomentul(iso, fn) {
  const Real = Date;
  const fix = new Real(iso).getTime();
  // eslint-disable-next-line no-global-assign
  Date = class extends Real {
    constructor(...a) { return a.length ? new Real(...a) : new Real(fix); }
    static now() { return fix; }
  };
  try { return fn(); } finally { Date = Real; }
}

// Termenul primei expoziții: 31 august 2026, ora 21:00 la Iași (EEST, UTC+3) = 18:00 UTC.
const TERMEN = "2026-08-31T18:00:00.000Z";
const expo = { deschis: true, termen: TERMEN };

console.log("— ora anunțată chiar se aplică —");
t("cu un minut înainte de 21:00, e deschis",
  laMomentul("2026-08-31T17:59:00.000Z", () => inchisPentruInscrieri(expo)) === false);
t("la 21:01, e închis",
  laMomentul("2026-08-31T18:01:00.000Z", () => inchisPentruInscrieri(expo)) === true);

console.log("\n— greșeala veche: sfârșitul zilei, după ceasul serverului —");
t("la 22:30 ora Iașiului NU mai primește (înainte primea)",
  laMomentul("2026-08-31T19:30:00.000Z", () => inchisPentruInscrieri(expo)) === true);
t("la 1 septembrie 02:00 ora Iașiului NU mai primește (înainte primea)",
  laMomentul("2026-08-31T23:00:00.000Z", () => inchisPentruInscrieri(expo)) === true);

console.log("\n— momentul nu depinde de fusul mașinii —");
{
  // Aceleași două momente, judecate cu procesul pus pe alt fus orar. Rezultatul trebuie
  // să fie identic: comparăm momente, nu ore de perete.
  const inainte = "2026-08-31T17:59:00.000Z";
  const dupa = "2026-08-31T18:01:00.000Z";
  const vechiTZ = process.env.TZ;
  for (const tz of ["UTC", "Europe/Bucharest", "America/New_York", "Pacific/Auckland"]) {
    process.env.TZ = tz;
    t(`pe ${tz}: deschis înainte, închis după`,
      laMomentul(inainte, () => inchisPentruInscrieri(expo)) === false &&
      laMomentul(dupa, () => inchisPentruInscrieri(expo)) === true);
  }
  if (vechiTZ === undefined) delete process.env.TZ; else process.env.TZ = vechiTZ;
}

console.log("\n— celelalte cazuri —");
t("o expoziție închisă manual rămâne închisă, oricât de departe e termenul",
  laMomentul("2026-01-01T00:00:00.000Z", () => inchisPentruInscrieri({ deschis: false, termen: TERMEN })) === true);
t("fără config, e închis", inchisPentruInscrieri(null) === true);
t("fără `deschis`, e închis", inchisPentruInscrieri({ termen: TERMEN }) === true);
// Un termen ilizibil nu are voie să închidă înscrierile din greșeală: mai bine rămâne
// deschis și se vede, decât să se închidă tăcut și nimeni să nu se poată înscrie.
t("termen ilizibil NU închide", inchisPentruInscrieri({ deschis: true, termen: "aiurea" }) === false);

console.log(rau ? `\n  ${rau} probe căzute\n` : "\n  Toate probele au trecut.\n");
process.exit(rau ? 1 : 0);
