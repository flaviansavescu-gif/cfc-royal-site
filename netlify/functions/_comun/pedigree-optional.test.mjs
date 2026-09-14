// pedigree-optional.test.mjs — la expozițiile din lista EXPOZITII_PEDIGREE_OPTIONAL (14.09.2026:
// doar „Cupa Bucegi"), numărul de pedigree e opțional pe formular INDIFERENT de bifa de
// tipicitate. Regula generală rămâne neatinsă la celelalte expoziții. Formularul și serverul
// citesc aceeași listă, deci nu pot diverge.
//   node --test netlify/functions/_comun/pedigree-optional.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pedigreeOptional, EXPOZITII_PEDIGREE_OPTIONAL } from "./pedigree-optional.mjs";

const server = readFileSync(new URL("../inscriere-expo.mjs", import.meta.url), "utf8");
const formular = readFileSync(new URL("../../../src/components/InscriereExpo.astro", import.meta.url), "utf8");

test("excepția e DOAR pentru Cupa Bucegi; orice altă expoziție păstrează regula", () => {
  assert.deepEqual([...EXPOZITII_PEDIGREE_OPTIONAL], ["cmttz0fa10000ks28lgagj4h7"]);
  assert.equal(pedigreeOptional("cmttz0fa10000ks28lgagj4h7"), true);
  assert.equal(pedigreeOptional("cms9cemmu0001ksh09fuvrosh"), false, "CACIB Iași: regula veche");
  assert.equal(pedigreeOptional(undefined), false);
});

test("serverul trimite formularului `pedigreeOptional` și sare verificarea doar acolo", () => {
  assert.ok(server.includes('import { pedigreeOptional } from "./_comun/pedigree-optional.mjs"'));
  assert.ok(server.includes("pedigreeOptional: pedigreeOptional(c.showId) || undefined"), "GET: câmpul pleacă spre formular");
  assert.match(server, /if \(!pedigreeOptional\(showId\) && String\(d\.pedigreeTipicitate \|\| ""\) !== "1" && String\(d\.pedigree \|\| ""\)\.trim\(\)\.length < 2\)/);
  assert.ok(server.includes("numărul de pedigree este obligatoriu. Dacă exemplarul nu are acte, bifează pedigree de tipicitate."), "mesajul vechi rămâne pentru celelalte expoziții");
});

test("formularul: steluța dispare, câmpul spune că e opțional, trimiterea trece fără număr", () => {
  assert.ok(formular.includes('<b class="req ie-ped-star">*</b></span><input data-f="pedigree" />'), "steluța e un element care se poate ascunde");
  assert.ok(formular.includes("stea.hidden = tip.checked || optional"), "steluța se ascunde la tipicitate sau la expoziția cu excepție");
  assert.ok(formular.includes("ped.placeholder = optional && !tip.checked ? txtPedOptional : \"\""), "textul din câmp explică");
  assert.ok(formular.includes("(tip || pedigree.length >= 2 || !!expoCurenta()?.pedigreeOptional)"), "validarea la trimitere respectă excepția");
  assert.ok(formular.includes('showSel.addEventListener("change", () => blocuri().forEach((b) => b.__sinc && b.__sinc()))'), "la schimbarea expoziției se reface");
  assert.ok(formular.includes("opțional la această expoziție — completează dacă are"), "textul RO");
  assert.ok(formular.includes("optional at this show — fill in if the dog has one"), "textul EN");
});
