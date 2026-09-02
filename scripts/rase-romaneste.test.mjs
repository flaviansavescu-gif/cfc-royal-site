// rase-romaneste.test.mjs — standardele se citesc ÎN ROMÂNEȘTE, peste tot.
//
// Cerut de VP Tehnic și de Arbitraj (02.09.2026), după ce s-a văzut că 17 rase —
// între care AMÂNDOUĂ ciobăneștile românești — aveau standardul încă în engleză, iar
// țările de origine apăreau „Italy", „Germany" pe fiecare fișă.
//
// Proba apără două lucruri diferite:
//   1. DATELE — nicio rubrică de proză a vreunei rase nu mai e în engleză;
//   2. AFIȘAREA — cheile care rămân englezești în date (grupa, țara, valorile
//      enumerate) au toate o traducere în dicționar, altfel ajung crude pe ecran.
//
//   node --test scripts/rase-romaneste.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const R = new URL("../", import.meta.url);
const date = JSON.parse(readFileSync(new URL("netlify/functions/_breed/breeds.json", R), "utf8"));
const rase = date.breeds;
const app = readFileSync(new URL("public/breed-explorer/assets/app.js", R), "utf8");

// Cuvinte englezești de legătură. Granița e pe LITERĂ Unicode, nu `\b`: „ț" nu e
// literă pentru `\w`, deci `\bfor\b` s-ar potrivi în „forță" și ar da fals-pozitiv.
// „dog" lipsește înadins — e cuvânt românesc (tip dog, dog german).
const EN = /(?<!\p{L})(the|and|with|shall|should|must|slightly|well|from|which|their|whose|there)(?!\p{L})/iu;

const PROZA = {
  identity: ["historical_function", "general_impression", "important_proportions", "sexual_dimorphism", "ideal_type_summary", "historical_summary"],
  anatomy: ["head", "skull", "stop", "muzzle", "jaws_teeth", "eyes", "ears", "neck", "topline", "body", "chest", "tail", "forequarters", "hindquarters", "feet", "movement", "coat", "color", "size", "skin"],
  temperament: ["behavior", "ring_attitude", "expression", "temperament_notes"],
};

test("nicio rubrică de standard nu mai e în engleză", () => {
  const rele = [];
  for (const b of rase)
    for (const [sec, campuri] of Object.entries(PROZA))
      for (const k of campuri) {
        const t = (b[sec] || {})[k];
        if (typeof t !== "string" || t.trim().length < 12) continue;
        // Un text românesc poate cuprinde pe drept cuvinte englezești: numele unei
        // culori („black and tan"), al unui trunchi („bull-and-terrier"), al unei rase.
        // De aceea se cer AMÂNDOUĂ semnele: nicio diacritică românească ȘI cuvinte
        // englezești de legătură. Un paragraf întreg netradus nu are cum să aibă „ăâîșț".
        if (!/[ăâîșț]/i.test(t) && EN.test(t))
          rele.push(`${b.wdf_code || b.id} ${b.breed_name} → ${sec}.${k}: „${t.slice(0, 70)}…"`);
      }
  assert.deepEqual(rele, [], `rubrici rămase în engleză:\n  ${rele.join("\n  ")}`);
});

test("ciobăneștile ROMÂNEȘTI sunt în românește — cazul care a pornit totul", () => {
  for (const cod of ["G01-042", "G01-043"]) {
    const b = rase.find((x) => x.wdf_code === cod);
    assert.ok(b, `lipsește rasa ${cod}`);
    for (const k of ["head", "coat", "color", "movement"])
      assert.match(b.anatomy[k], /[ăâîșț]/i, `${b.breed_name} → anatomy.${k} nu e în românește`);
  }
});

// —— Ce rămâne englezesc în DATE trebuie tradus la AFIȘARE ——
// Cheile nu se schimbă: pe ele se potrivesc filtrele, importul WDF și nomenclatorul
// Managerului. Se traduce doar ce vede omul.
const bloc = (de, la) => app.slice(app.indexOf(de), app.indexOf(la));
const cheileDin = (s) => new Set([...s.matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)].map((m) => m[1]));
const I18N = cheileDin(bloc("const I18N", "function tr("));
const VAL = new Set([...bloc("const VAL_LABELS", "function valLabel(").matchAll(/(?:"([^"]+)"|([a-z_ ]+))\s*:/g)]
  .map((m) => (m[1] || m[2] || "").trim().toLowerCase()).filter(Boolean));

const unic = (f) => [...new Set(rase.map(f).filter(Boolean))];

test("fiecare grupă WDF are traducere la afișare", () => {
  const lipsa = unic((b) => b.group).filter((g) => !I18N.has(g));
  assert.deepEqual(lipsa, [], `grupe netraduse: ${lipsa.join(" | ")}`);
});

test("fiecare țară are traducere la afișare — și originea, și patronajul", () => {
  const tari = new Set([...unic((b) => b.country_of_origin), ...unic((b) => (b.identity || {}).owner_country)]);
  // Cele scrise deja românește în date nu au nevoie de intrare în dicționar.
  const lipsa = [...tari].filter((t) => !I18N.has(t) && !/[ăâîșț]/i.test(t));
  assert.deepEqual(lipsa, [], `țări netraduse: ${lipsa.join(" | ")}`);
});

test("fiecare valoare enumerată are etichetă românească", () => {
  const lipsa = [];
  for (const [nume, f] of [
    ["coat_type", (b) => b.coat_type],
    ["functional_type", (b) => b.functional_type],
    ["wdf_status", (b) => b.wdf_status],
    ["difficulty_level", (b) => b.difficulty_level],
  ])
    for (const v of unic(f)) if (!VAL.has(String(v).toLowerCase())) lipsa.push(`${nume}=${v}`);
  assert.deepEqual(lipsa, [], `valori fără etichetă: ${lipsa.join(" | ")}`);
});

test("țara trece prin traducere la fiecare loc unde se afișează", () => {
  // Dacă cineva adaugă un loc nou care scrie `b.country_of_origin` crud, proba cade.
  const crude = [...app.matchAll(/[^r]\(b\.country_of_origin \|\| "—"\)/g)];
  assert.equal(crude.length, 0, "există un loc care afișează țara netradusă");
  assert.ok(app.includes("tr(b.country_of_origin)"), "profilul traduce țara");
});

test("întrebarea de test despre țară se corectează pe valoarea din date, nu pe etichetă", () => {
  // Două scrieri englezești („USA" și „United States") dau același nume românesc;
  // dacă răspunsul s-ar căuta pe eticheta afișată, ar fi două variante corecte.
  assert.ok(app.includes("({ text: tr(c), val: c })"), "opțiunile păstrează valoarea brută");
  assert.ok(app.includes("opts.findIndex((o) => o.val === b.country_of_origin)"), "răspunsul se caută pe valoare");
});
