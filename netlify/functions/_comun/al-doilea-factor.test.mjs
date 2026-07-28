// A doua cheie — testele părții care hotărăște cine intră.
//
// Aici greșelile nu se văd: o verificare prea îngăduitoare arată exact ca una corectă,
// până în ziua în care cineva intră cu ea. De aceea se testează refuzurile, nu
// acceptările: expirarea, jetonul de alt rol, codul greșit, încercările epuizate.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  codNumeric, jetonNou, amprenta, dispozitivValid, verificaOtp,
  deschideIntrarea, confirmaIntrarea, expiraLa, dispozitivCunoscut, operational,
  OTP_INCERCARI, OTP_MINUTE, DISPOZITIV_ZILE, DISPOZITIV_MS, OTP_MS,
} from "./al-doilea-factor.mjs";

const T0 = Date.parse("2026-08-01T10:00:00.000Z");
const sha = (s) => amprenta(s);

/** Magazie de probă. */
function magazie() {
  const date = new Map();
  return {
    date,
    async setJSON(k, v) { date.set(k, JSON.parse(JSON.stringify(v))); },
    async get(k) { return date.has(k) ? date.get(k) : null; },
    async delete(k) { date.delete(k); },
  };
}

// ————————————————————— codul de șase cifre —————————————————————

test("codul are exact șase cifre, inclusiv când e mic", () => {
  for (let i = 0; i < 200; i++) {
    const c = codNumeric();
    assert.match(c, /^\d{6}$/, `cod invalid: ${c}`);
  }
});

test("codurile nu se repetă la fiecare apel", () => {
  const set = new Set(Array.from({ length: 100 }, () => codNumeric()));
  assert.ok(set.size > 90, `prea multe repetări: ${set.size}/100`);
});

test("jetonul de dispozitiv are 64 de caractere hexazecimale (32 de octeți)", () => {
  const j = jetonNou();
  assert.match(j, /^[0-9a-f]{64}$/);
  assert.notEqual(j, jetonNou());
});

// ————————————————————— dispozitivul —————————————————————

test("dispozitiv valid: rol potrivit și neexpirat", () => {
  const d = { rol: "admin", expira: new Date(T0 + 1000).toISOString() };
  assert.equal(dispozitivValid(d, "admin", T0), true);
});

test("un jeton de REGISTRATURĂ nu deschide administrarea", () => {
  const d = { rol: "registratura", expira: new Date(T0 + 1e9).toISOString() };
  assert.equal(dispozitivValid(d, "admin", T0), false, "escaladare de privilegii");
  assert.equal(dispozitivValid(d, "registratura", T0), true);
});

test("dispozitivul expirat nu mai e valid", () => {
  const d = { rol: "admin", expira: new Date(T0 - 1).toISOString() };
  assert.equal(dispozitivValid(d, "admin", T0), false);
});

test("lipsa înregistrării sau a datei de expirare = refuz", () => {
  assert.equal(dispozitivValid(null, "admin", T0), false);
  assert.equal(dispozitivValid({}, "admin", T0), false);
  assert.equal(dispozitivValid({ rol: "admin" }, "admin", T0), false);
  assert.equal(dispozitivValid({ rol: "admin", expira: "aiurea" }, "admin", T0), false);
});

// ————————————————————— codul din e-mail —————————————————————

const inreg = (otp, extra = {}) => ({
  rol: "admin", otpAmprenta: sha(otp),
  expira: new Date(T0 + OTP_MS).toISOString(), incercari: 0, ...extra,
});

test("codul bun trece", () => {
  assert.deepEqual(verificaOtp(inreg("123456"), "123456", T0), { ok: true });
});

test("codul bun trece și scris cu spații", () => {
  assert.deepEqual(verificaOtp(inreg("123456"), "123 456", T0), { ok: true });
});

test("codul greșit spune câte încercări au mai rămas", () => {
  const r = verificaOtp(inreg("123456"), "000000", T0);
  assert.ok(r.eroare);
  assert.equal(r.incercariRamase, OTP_INCERCARI - 1);
});

test("codul expirat e refuzat, oricât de corect ar fi", () => {
  const r = verificaOtp(inreg("123456"), "123456", T0 + OTP_MS + 1);
  assert.ok(r.eroare);
  assert.equal(r.expirat, true);
  assert.match(r.eroare, new RegExp(String(OTP_MINUTE)));
});

test("după încercările epuizate nu mai merge nici codul bun", () => {
  const r = verificaOtp(inreg("123456", { incercari: OTP_INCERCARI }), "123456", T0);
  assert.ok(r.eroare);
  assert.equal(r.expirat, true);
});

test("fără înregistrare, refuz", () => {
  assert.ok(verificaOtp(null, "123456", T0).eroare);
});

// ————————————————————— fluxul întreg —————————————————————

test("intrarea: cod bun -> jeton; intrarea se consumă", async () => {
  const s = magazie();
  const { id, otp } = await deschideIntrarea(s, { rol: "admin", cine: "Administrator", email: "a@b.ro" });
  assert.ok(s.date.has("intrare/" + id));

  const r = await confirmaIntrarea(s, id, otp);
  assert.equal(r.ok, true);
  assert.equal(r.rol, "admin");
  assert.match(r.jeton, /^[0-9a-f]{64}$/);
  assert.equal(s.date.has("intrare/" + id), false, "intrarea trebuie consumată");
  assert.ok(s.date.has("dispozitiv/" + amprenta(r.jeton)), "dispozitivul trebuie înregistrat");
});

test("acelasi cod NU merge a doua oară", async () => {
  const s = magazie();
  const { id, otp } = await deschideIntrarea(s, { rol: "admin", cine: "A", email: "a@b.ro" });
  await confirmaIntrarea(s, id, otp);
  const iar = await confirmaIntrarea(s, id, otp);
  assert.ok(iar.eroare, "intrarea consumată nu se mai poate folosi");
});

test("codul se ghicește greu: după 5 greșeli, intrarea moare", async () => {
  const s = magazie();
  const { id, otp } = await deschideIntrarea(s, { rol: "admin", cine: "A", email: "a@b.ro" });
  const gresit = otp === "000000" ? "111111" : "000000";
  for (let i = 0; i < OTP_INCERCARI; i++) await confirmaIntrarea(s, id, gresit);
  const r = await confirmaIntrarea(s, id, otp);
  assert.ok(r.eroare, "după încercările epuizate nu mai merge nici codul bun");
});

test("în magazie NU stau nici codul, nici jetonul — doar amprente", async () => {
  const s = magazie();
  const { id, otp } = await deschideIntrarea(s, { rol: "admin", cine: "A", email: "a@b.ro" });
  const brutIntrare = JSON.stringify([...s.date.values()]);
  assert.ok(!brutIntrare.includes(otp), "codul din e-mail nu are ce căuta în magazie");

  const r = await confirmaIntrarea(s, id, otp);
  const brutDispozitiv = JSON.stringify([...s.date.values()]);
  assert.ok(!brutDispozitiv.includes(r.jeton), "jetonul nu are ce căuta în magazie");
});

test("dispozitivul se naște cu termen de 30 de zile", async () => {
  const s = magazie();
  const { id, otp } = await deschideIntrarea(s, { rol: "registratura", cine: "Ana", email: "a@b.ro" });
  const r = await confirmaIntrarea(s, id, otp);
  const d = s.date.get("dispozitiv/" + amprenta(r.jeton));
  assert.equal(d.rol, "registratura");
  const zile = Math.round((Date.parse(d.expira) - Date.now()) / 86400000);
  assert.equal(zile, DISPOZITIV_ZILE);
  assert.equal(DISPOZITIV_MS, DISPOZITIV_ZILE * 24 * 3600e3);
});

test("expiraLa calculează de la momentul dat", () => {
  assert.equal(expiraLa(60e3, T0), new Date(T0 + 60e3).toISOString());
});

// ————————————————————— invariantul care s-a rupt în producție —————————————————————
//
// Poarta de INTRARE spunea „nu pot trimite codul pe e-mail, intră fără el", iar poarta
// ACȚIUNILOR spunea „n-ai dispozitiv recunoscut, ieși". Administratorul intra și era dat
// afară imediat, la prima cerere — cu un mesaj care îi spunea, pe deasupra, că i s-a
// revocat codul. O apărare pe jumătate pornită nu apără nimic și blochează pe toată
// lumea. Testul de aici ține cele două porți legate.

test("dacă mecanismul NU e operațional, poarta acțiunilor nu-l cere", async () => {
  const cheieVeche = process.env.BREVO_API_KEY;
  const opritVechi = process.env.FARA_AL_DOILEA_FACTOR;
  try {
    delete process.env.BREVO_API_KEY;          // fără poștă nu se poate trimite niciun cod
    delete process.env.FARA_AL_DOILEA_FACTOR;
    assert.equal(operational(), false, "fără poștă, mecanismul nu e operațional");
    // Magazie care ar ARUNCA dacă ar fi întrebată: dovedește că nici n-o atingem.
    const interzisa = { async get() { throw new Error("nu trebuia întrebată magazia"); } };
    assert.equal(await dispozitivCunoscut(interzisa, "", "admin"), true);
    assert.equal(await dispozitivCunoscut(interzisa, "", "registratura"), true);
  } finally {
    if (cheieVeche === undefined) delete process.env.BREVO_API_KEY; else process.env.BREVO_API_KEY = cheieVeche;
    if (opritVechi === undefined) delete process.env.FARA_AL_DOILEA_FACTOR; else process.env.FARA_AL_DOILEA_FACTOR = opritVechi;
  }
});

test("oprit din mediu: la fel, poarta acțiunilor nu cere nimic", async () => {
  const cheieVeche = process.env.BREVO_API_KEY;
  const opritVechi = process.env.FARA_AL_DOILEA_FACTOR;
  try {
    process.env.BREVO_API_KEY = "cheie-de-proba";
    process.env.FARA_AL_DOILEA_FACTOR = "1";
    assert.equal(operational(), false);
    const interzisa = { async get() { throw new Error("nu trebuia întrebată magazia"); } };
    assert.equal(await dispozitivCunoscut(interzisa, "orice", "admin"), true);
  } finally {
    if (cheieVeche === undefined) delete process.env.BREVO_API_KEY; else process.env.BREVO_API_KEY = cheieVeche;
    if (opritVechi === undefined) delete process.env.FARA_AL_DOILEA_FACTOR; else process.env.FARA_AL_DOILEA_FACTOR = opritVechi;
  }
});

test("operațional: poarta CHIAR cere dispozitivul", async () => {
  const cheieVeche = process.env.BREVO_API_KEY;
  const opritVechi = process.env.FARA_AL_DOILEA_FACTOR;
  try {
    process.env.BREVO_API_KEY = "cheie-de-proba";
    delete process.env.FARA_AL_DOILEA_FACTOR;
    assert.equal(operational(), true);
    const s = magazie();
    assert.equal(await dispozitivCunoscut(s, "", "admin"), false, "fără jeton, refuz");
    assert.equal(await dispozitivCunoscut(s, "inventat", "admin"), false, "jeton inventat, refuz");

    const { id, otp } = await deschideIntrarea(s, { rol: "admin", cine: "A", email: "a@b.ro" });
    const r = await confirmaIntrarea(s, id, otp);
    assert.equal(await dispozitivCunoscut(s, r.jeton, "admin"), true, "jetonul născut aici trebuie acceptat");
  } finally {
    if (cheieVeche === undefined) delete process.env.BREVO_API_KEY; else process.env.BREVO_API_KEY = cheieVeche;
    if (opritVechi === undefined) delete process.env.FARA_AL_DOILEA_FACTOR; else process.env.FARA_AL_DOILEA_FACTOR = opritVechi;
  }
});
