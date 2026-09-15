// arbitri-formular.test.mjs — rândul „Arbitri invitați" de pe formularul de înscriere
// (15.09.2026): numele vin din Manager (bifați la publicare sau, în lipsă, arbitrii
// ringurilor); când nu e niciunul, formularul spune „arbitrii vor fi anunțați în curând",
// nu ascunde rândul. Numele se pun cu textContent, niciodată ca HTML.
//   node --test netlify/functions/_comun/arbitri-formular.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const formular = readFileSync(new URL("../../../src/components/InscriereExpo.astro", import.meta.url), "utf8");
const server = readFileSync(new URL("../inscriere-expo.mjs", import.meta.url), "utf8");

test("fără arbitri anunțați, rândul rămâne vizibil cu mențiunea „în curând” (RO și EN)", () => {
  assert.ok(formular.includes("listaArbitri.textContent = arbitri.length ? arbitri.join(\" · \") : txtArbitriCurand;"));
  assert.ok(formular.includes('"arbitrii vor fi anunțați în curând"'));
  assert.ok(formular.includes('"the judges will be announced shortly"'));
  assert.ok(formular.includes("if (!e) { randArbitri.hidden = true; return; }"), "fără expoziție aleasă, rândul dispare");
});

test("numele arbitrilor se pun ca text, nu ca HTML", () => {
  const bloc = formular.slice(formular.indexOf("function aratArbitrii()"), formular.indexOf("showSel.addEventListener(\"change\", aratArbitrii)"));
  assert.ok(!bloc.includes("innerHTML"));
});

test("serverul trimite formularului lista de arbitri din config-ul publicat de Manager", () => {
  assert.ok(server.includes("arbitri: c.arbitri || [],"));
});
