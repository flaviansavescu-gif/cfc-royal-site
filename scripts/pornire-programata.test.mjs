// pornire-programata.test.mjs — plasa de rezervă a programatorului Netlify (02.09.2026).
//
// Incidentul: programatorul Netlify n-a mai pornit monitor-flux și paznic-veghe ore în șir,
// fără incident anunțat; codul, magazia și funcțiile erau bune. De atunci paznicul din
// GitHub Actions le pornește el, la fiecare rulare. Proba ține lipite regulile:
//   1. funcția e de FUNDAL (răspunde 202 pe loc; monitor-flux poate depăși 10 s);
//   2. pornește AMÂNDOUĂ handlerele, fiecare în plasa lui (un eșec nu-l oprește pe celălalt);
//   3. prag global — o pornire la 5 minute — ca să nu poată abuza nimeni;
//   4. paznicul o cheamă la fiecare rulare, best-effort, FĂRĂ secrete în workflow.
//   node --test scripts/pornire-programata.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const R = new URL("../", import.meta.url);
const fn = readFileSync(new URL("netlify/functions/pornire-programata-background.mjs", R), "utf8");
const yml = readFileSync(new URL(".github/workflows/paznic.yml", R), "utf8");

test("e funcție de fundal și răspunde 202 pe loc", () => {
  assert.ok(fn.includes('new Response(null, { status: 202 })'), "răspunde 202");
  // Numele cu -background e ceea ce face Netlify s-o trateze ca fundal (15 min, nu 10 s).
  assert.ok(yml.includes("pornire-programata-background"), "paznicul cheamă varianta de fundal");
});

test("pornește amândouă funcțiile programate, fiecare în plasa ei", () => {
  assert.ok(fn.includes('import monitorFlux from "./monitor-flux.mjs"'));
  assert.ok(fn.includes('import paznicVeghe from "./paznic-veghe.mjs"'));
  assert.ok(fn.includes('await ruleaza("monitor-flux", monitorFlux)'));
  assert.ok(fn.includes('await ruleaza("paznic-veghe", paznicVeghe)'));
  const corpRuleaza = fn.slice(fn.indexOf("async function ruleaza"), fn.indexOf("export default"));
  assert.ok(corpRuleaza.includes("try {") && corpRuleaza.includes("catch (err)"), "fiecare rulare are plasa ei");
});

test("prag global: o pornire la 5 minute, ținut în magazie", () => {
  assert.ok(fn.includes("PRAG_PORNIRE_MS = 5 * 60 * 1000"));
  assert.ok(fn.includes("acum - la < PRAG_PORNIRE_MS"), "se compară cu ultima pornire");
  assert.ok(fn.includes("setJSON(CHEIE_ULTIMA_PORNIRE"), "pornirea lasă urmă");
  // Fail-open dacă magazia nu poate fi citită: rezerva nu are voie să tacă.
  assert.ok(fn.includes("pornesc oricum"), "magazia capricioasă nu oprește rezerva");
});

test("paznicul o cheamă la fiecare rulare, best-effort, fără secrete", () => {
  const pas = yml.slice(yml.indexOf("Pornire de rezerva a functiilor programate"));
  assert.ok(pas.includes("if: always()"), "rulează și când o verificare a căzut");
  assert.ok(pas.includes("|| true"), "nu dublează alarma dacă Netlify e jos");
  assert.ok(!yml.includes("secrets."), "regula casei: paznicul din Actions nu ține secrete");
});

test("funcțiile programate rămân programate și în Netlify (dublura e voită)", () => {
  const mf = readFileSync(new URL("netlify/functions/monitor-flux.mjs", R), "utf8");
  const pv = readFileSync(new URL("netlify/functions/paznic-veghe.mjs", R), "utf8");
  assert.ok(mf.includes('export const config = { schedule: "*/15 * * * *" }'));
  assert.ok(pv.includes('export const config = { schedule: "*/30 * * * *" }'));
  // Și amândouă bat inima ÎNAINTE de orice altceva — așa se vede că au rulat.
  assert.ok(mf.includes('await bateInima("monitor-flux")') && pv.includes('await bateInima("paznic-veghe")'));
});
