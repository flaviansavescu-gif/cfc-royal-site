// culoare-roba.test.mjs — culoarea robei e OBLIGATORIE la înscriere (decizia din
// 02.09.2026, după 7 fișe „date de catalog incomplete" la Iași); PĂRINȚII rămân
// OPȚIONALI cu bună știință — pedigree-ul de tipicitate nu îi are trecuți pe act.
// Probele statice țin amândouă jumătățile deciziei lipite de cod.
//   node --test netlify/functions/_comun/culoare-roba.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync(new URL("../inscriere-expo.mjs", import.meta.url), "utf8");
const formular = readFileSync(new URL("../../../src/components/InscriereExpo.astro", import.meta.url), "utf8");

test("serverul REFUZĂ înscrierea fără culoarea robei (are ultimul cuvânt)", () => {
  assert.match(server, /culoareRoba[\s\S]{0,80}trim\(\)\.length < 2/);
  assert.ok(server.includes("culoarea robei este obligatorie"), "mesajul pe limba omului există");
});

test("serverul NU cere părinții (tipicitatea nu-i are pe act)", () => {
  assert.ok(!/eroare:.*(tat[aă]l|mama).*(obligator)/i.test(server), "niciun refuz pe tată/mamă");
});

test("formularul marchează culoarea ca obligatorie și o validează per câine", () => {
  assert.match(formular, /T\.culoareRoba\} \*<\/span><input data-f="culoareRoba" required/);
  assert.ok(formular.includes('culoareRoba.length >= 2'), "validarea per câine o cuprinde");
  assert.ok(formular.includes("culoarea robei (se tipărește în catalogul oficial)"), "atenționarea o numește");
});

test("părinții rămân fără steluță și fără required în formular", () => {
  assert.match(formular, /T\.tata\}<\/span><input data-f="tata" \/>/);
  assert.match(formular, /T\.mama\}<\/span><input data-f="mama" \/>/);
});
