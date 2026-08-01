// Probele citirii: numele cheilor, socoteala și jetonul de fundal.
//
// Cele două de la urmă țin minte defecte adevărate, găsite la analiza de securitate:
// urma citirii rămânea în magazie după ștergerea dosarului, iar funcția de fundal era o
// adresă publică. Prima costa date orfane în fiecare copie de siguranță; a doua, bani.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLAFON_ZI, ABANDONAT_MS, MODEL, PRET,
  cheiaZilei, cheiaStarii, cheiaJetonului, cheiaUrmei, cheileCitirii,
  jetonNou, amprenta, egal, costul, inCenti,
} from "./citire-documente.mjs";

test("cheile citirii stau toate sub prefixul „citire/”", () => {
  // Prefixul comun nu e cosmetică: după el se recunosc cheile la curățenie și la
  // inventarul magaziei.
  for (const c of [cheiaZilei("2026-08-01"), cheiaStarii("x"), cheiaJetonului("x"), cheiaUrmei("x")]) {
    assert.ok(c.startsWith("citire/"), c);
  }
});

test("cheileCitirii le cuprinde pe TOATE cele legate de un dosar", () => {
  // Dacă apare o cheie nouă și nu intră aici, ștergerea dosarului o lasă în urmă — iar
  // arhiva, care ia tot ce e în magazie, o duce în fiecare copie de siguranță, la
  // nesfârșit, pentru un dosar care nu mai există. Exact ce s-a întâmplat cu urma.
  const ale = cheileCitirii("AB12");
  assert.ok(ale.includes(cheiaStarii("AB12")));
  assert.ok(ale.includes(cheiaJetonului("AB12")));
  assert.ok(ale.includes(cheiaUrmei("AB12")));
  // Socoteala zilei NU e a unui dosar: ea rămâne, e a asociației.
  assert.ok(!ale.some((c) => c.startsWith("citire/zi/")));
});

test("ziua se ia din data de azi când nu se dă alta", () => {
  assert.equal(cheiaZilei("2026-08-01"), "citire/zi/2026-08-01");
  assert.match(cheiaZilei(), /^citire\/zi\/\d{4}-\d{2}-\d{2}$/);
});

test("jetonul e lung și nu se repetă", () => {
  const a = jetonNou(), b = jetonNou();
  assert.equal(a.length, 64);          // 32 de octeți în hexazecimal
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]+$/);
});

test("în magazie se ține amprenta, nu jetonul", () => {
  const j = jetonNou();
  const a = amprenta(j);
  assert.notEqual(a, j);
  assert.equal(a.length, 64);
  assert.equal(amprenta(j), a, "aceeași intrare, aceeași amprentă");
});

test("comparația jetonului nu se oprește la prima literă diferită", () => {
  // Timp constant: o comparație obișnuită spune, prin durată, cât din jeton s-a ghicit.
  assert.ok(egal("abc", "abc"));
  assert.ok(!egal("abc", "abd"));
  assert.ok(!egal("abc", "abcd"));
  assert.ok(!egal("", "a"));
  assert.ok(egal("", ""));
});

test("costul e cel al modelului folosit", () => {
  assert.equal(MODEL, "claude-opus-5");
  // 7450 intrare + 2300 ieșire — măsurat pe cuibul 26.
  const c = costul(7450, 2300);
  assert.ok(c > 0.09 && c < 0.10, "un dosar costă vreo 10 cenți, nu 1 și nu 100: " + c);
  assert.match(inCenti(c), /^~9\.\d+ cenți$/);
});

test("plafonul și răbdarea au valori omenești", () => {
  assert.ok(PLAFON_ZI >= 1, "sub un dolar pe zi ar opri lucrul obișnuit");
  // Măsurat: 36 de secunde pentru două documente. Răbdarea trebuie să fie mult peste,
  // dar nu atât încât un dosar să rămână blocat o zi.
  assert.ok(ABANDONAT_MS > 60e3, "prea puțin: o citire normală ar fi socotită moartă");
  assert.ok(ABANDONAT_MS <= 15 * 60e3, "prea mult: dosarul ar rămâne blocat degeaba");
});

test("prețul e cel publicat pentru Opus 5", () => {
  assert.equal(PRET.intrare * 1_000_000, 5);
  assert.equal(PRET.iesire * 1_000_000, 25);
});

console.log("citire-documente: toate probele trecute");
