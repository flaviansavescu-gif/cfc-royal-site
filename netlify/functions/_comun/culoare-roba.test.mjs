// culoare-roba.test.mjs — culoarea robei e OBLIGATORIE la înscriere (decizia din
// 02.09.2026, după 7 fișe „date de catalog incomplete" la Iași), iar din 10.09.2026 și
// TIPUL robei (păr scurt / lung / sârmos…), câmp separat — amatorii nu știau ce să scrie
// la „robă" (3 întrebări la Iași), deci etichetele îl TRADUC („culoarea blănii", „tip de
// blană") fără să renunțe la termenul chinologic. PĂRINȚII rămân OPȚIONALI cu bună
// știință — pedigree-ul de tipicitate nu îi are trecuți pe act.
//   node --test netlify/functions/_comun/culoare-roba.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync(new URL("../inscriere-expo.mjs", import.meta.url), "utf8");
const formular = readFileSync(new URL("../../../src/components/InscriereExpo.astro", import.meta.url), "utf8");

test("serverul REFUZĂ înscrierea fără culoarea robei și fără tipul robei (are ultimul cuvânt)", () => {
  assert.match(server, /culoareRoba[\s\S]{0,80}trim\(\)\.length < 2/);
  assert.ok(server.includes("culoarea robei (a blănii) este obligatorie"), "mesajul pe limba omului există");
  assert.match(server, /tipRoba[\s\S]{0,80}trim\(\)\.length < 2/);
  assert.ok(server.includes("tipul robei (tipul de blană: păr scurt, păr lung, păr sârmos…) este obligatoriu"), "mesajul pentru tipul robei există");
  assert.ok(server.includes("tipRoba: String(d.tipRoba || \"\").trim().slice(0, 120) || null"), "tipul robei pleacă în fișă, spre manager");
});

test("serverul NU cere părinții (tipicitatea nu-i are pe act)", () => {
  assert.ok(!/eroare:.*(tat[aă]l|mama).*(obligator)/i.test(server), "niciun refuz pe tată/mamă");
});

test("formularul traduce termenul chinologic și cere amândouă câmpurile, cu exemple la tip", () => {
  assert.ok(formular.includes('culoareRoba: "Culoarea robei (culoarea blănii)"'), "eticheta traduce „roba”, fără s-o înlocuiască");
  assert.ok(formular.includes('tipRoba: "Tipul robei (tip de blană)"'), "câmp separat pentru tipul robei");
  assert.ok(formular.includes('tipRobaPh: "ex.: păr scurt, păr lung, păr sârmos"'), "exemplele stau în câmp");
  assert.match(formular, /T\.culoareRoba\} \*<\/span><input data-f="culoareRoba" required/);
  assert.match(formular, /T\.tipRoba\} \*<\/span><input data-f="tipRoba" required minlength="2" placeholder=\{T\.tipRobaPh\}/);
  assert.ok(formular.includes('culoareRoba.length >= 2 && tipRoba.length >= 2'), "validarea per câine le cuprinde pe amândouă");
  assert.ok(formular.includes("culoarea robei și tipul robei (se tipăresc în catalogul oficial)"), "atenționarea le numește");
  assert.ok(formular.includes('tipRoba: val("tipRoba")'), "tipul robei pleacă în cerere");
});

test("părinții rămân fără steluță și fără required în formular", () => {
  assert.match(formular, /T\.tata\}<\/span><input data-f="tata" \/>/);
  assert.match(formular, /T\.mama\}<\/span><input data-f="mama" \/>/);
});
