// Teste pentru motorul de măsurători PAA. Rulează: node --test netlify/functions/_paa/masuratori.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { distanta, unghiABC, procent, raport, statusInterval, metriciMVP, rotunjeste } from "./masuratori.mjs";

const aprox = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, a + " ≈ " + b);

test("distanta: verticală pură (aspect irelevant pe y)", () => {
  aprox(distanta({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.8 }, 2), 0.6);
});

test("distanta: orizontală se scalează cu aspect", () => {
  aprox(distanta({ x: 0.2, y: 0.5 }, { x: 0.7, y: 0.5 }, 2), 0.5 * 2);
});

test("distanta: reper lipsă -> NaN", () => {
  assert.ok(isNaN(distanta(null, { x: 0, y: 0 })));
});

test("unghiABC: unghi drept = 90°", () => {
  aprox(unghiABC({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, 1), 90, 1e-4);
});

test("unghiABC: coliniar = 180°", () => {
  aprox(unghiABC({ x: 0, y: 0 }, { x: 0, y: 0.5 }, { x: 0, y: 1 }, 1), 180, 1e-4);
});

test("procent: 100·x/ref", () => {
  aprox(procent(0.6, 0.5), 120);
  assert.ok(isNaN(procent(1, 0)));
});

test("raport", () => {
  aprox(raport(3, 2), 1.5);
  assert.ok(isNaN(raport(1, 0)));
});

test("statusInterval: conform / neconform / informativ / neconcludent", () => {
  const m = { min: 100, max: 110 };
  assert.equal(statusInterval(105, m).status, "conform");
  assert.equal(statusInterval(95, m).status, "neconform");
  assert.equal(statusInterval(120, m).status, "neconform");
  assert.equal(statusInterval(105, { tinta: 105 }).status, "informativ");
  assert.equal(statusInterval(NaN, m).status, "neconcludent");
  assert.equal(statusInterval(null, m).status, "neconcludent");
});

test("metriciMVP: indici corecți", () => {
  const r = metriciMVP({ lungime_corp: 1.1, inaltime_greaban: 1.0, adancime_torace: 0.5, segment_membru_anterior: 0.55, lungime_craniu: 0.12, lungime_bot: 0.1 });
  aprox(r.indice_corporal, 110);
  aprox(r.adancime_torace, 50);
  aprox(r.segment_membru_anterior, 55);
  aprox(r.raport_craniu_bot, 1.2);
});

test("rotunjeste", () => {
  assert.equal(rotunjeste(1.234, 1), 1.2);
  assert.equal(rotunjeste(NaN), null);
});
