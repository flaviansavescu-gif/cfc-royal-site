// decizie.test.mjs — decizia asupra licențierii (15.09.2026): din grupele și rasele alese de
// candidat, conducerea SCOATE ce nu rămâne la licențiere; alegerea candidatului rămâne
// neatinsă, iar Consiliul Director primește amândouă listele (copiere / .txt).
//   node --test netlify/functions/_interese/decizie.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fn = readFileSync(new URL("../interese-rase.mjs", import.meta.url), "utf8");
const admin = readFileSync(new URL("../../../src/pages/cursuri/admin/index.astro", import.meta.url), "utf8");

test("funcția: acțiuni admin decizie-salveaza / decizie-sterge, doar cu profil existent, sanitizate, jurnalizate", () => {
  assert.ok(fn.includes('actiune === "decizie-salveaza" || actiune === "decizie-sterge"'));
  assert.ok(fn.includes('return json({ eroare: "Candidatul nu are profil de interese." }, 404)'));
  assert.ok(fn.includes("const d = curataDecizie(body);"), "intrarea trece prin curataDecizie");
  assert.ok(fn.includes('await st.setJSON("decizie/" + cid, decizie)') && fn.includes('await st.delete("decizie/" + cid)'));
  assert.ok(fn.includes('await audit("interese-decizie", actor,') && fn.includes('await audit("interese-decizie-sterge", actor, cid)'));
  // Acțiunile stau DUPĂ poarta de admin + dispozitiv (nu le poate chema un lector).
  assert.ok(fn.indexOf('if (!esteAdmin) return json({ eroare: "Necesită cod de administrator." }, 403)') < fn.indexOf('actiune === "decizie-salveaza"'));
});

test("alegerea candidatului rămâne neatinsă: decizia stă separat și supraviețuiește re-salvării profilului", () => {
  assert.ok(!/decizie[\s\S]{0,200}setJSON\("profil\//.test(fn.slice(fn.indexOf('actiune === "decizie-salveaza"'))), "decizia nu scrie în profil/");
  assert.ok(fn.includes('const decizie = await citeste("decizie/" + cand.id);'), "la salvarea profilului de către candidat, decizia se recitește");
  assert.ok(fn.includes("randIndex(p, alocare, decizie)") && fn.includes("randIndex(p, al, dec)"));
});

test("panoul: „Reținute pentru licențiere” cu ✕ pe grupe și rase, restabilire, copiere pentru Consiliu", () => {
  assert.ok(admin.includes("card.appendChild(randDecizie(c));"));
  assert.ok(admin.includes('"Reținute pentru licențiere: "'));
  assert.ok(admin.includes('actiune: "decizie-salveaza", tinta: c.cid, grupeScoase, raseScoase'));
  assert.ok(admin.includes('actiune: "decizie-sterge", tinta: c.cid'));
  assert.ok(admin.includes("Restabilește alegerea candidatului"));
  assert.ok(admin.includes("Scoate grupa (și rasele ei) din licențiere") && admin.includes("Scoate rasa din licențiere"));
  assert.ok(admin.includes("📋 Copiază pentru Consiliu") && admin.includes('id="a-int-copy-all"') && admin.includes('id="a-int-dl-all"'));
  assert.ok(admin.includes('"candidati-grupe-rase-consiliu.txt"'));
});

test("textul pentru Consiliu poartă și alegerea, și ce rămâne, și ce s-a scos", () => {
  for (const s of ['"CANDIDAT: "', '"Ales de candidat: "', '"Reținute pentru licențiere"', '"  Scoase: "', '"Lector principal: "']) assert.ok(admin.includes(s), s);
});

test("oglinda client a lui aplicaDecizie: grupa scoasă scoate și rasele ei", () => {
  const bloc = admin.slice(admin.indexOf("function retinute(c)"), admin.indexOf("async function salveazaDecizie"));
  assert.ok(bloc.includes("!gS.has(r.g) && !rS.has(cheiaRasei(r))"));
});
