// dovada-plata.test.mjs — dovada plății se șterge din cloud abia când e ÎMPLINIT amândouă:
// importată în Manager ȘI verificată de registratură (cazurile LISA/A-ROSA, 02.09.2026 —
// înainte, importul rapid lăsa registratura cu un buton mort).
//   node --test netlify/functions/_comun/dovada-plata.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { magazieFalsa } from "./_harness.mjs";
import { stergeDovezileIncheiate } from "./dovada-plata.mjs";

const SHOW = "expo1";
const DOVADA = "dovada/expo1/plata-1.jpg";
const fisa = (sufix, extra = {}) => ["coada/" + SHOW + "/" + sufix, { numeCaine: sufix, dovadaKey: DOVADA, ...extra }];
const marcaj = (sufix, stare) => ["verificare/" + SHOW + "/" + sufix, { stare }];

test("importată dar NEverificată → dovada RĂMÂNE (registratura încă are nevoie de ea)", async () => {
  const s = magazieFalsa(Object.fromEntries([fisa("lisa", { importat: true }), [DOVADA, "poza"]]));
  const sterse = await stergeDovezileIncheiate(s, SHOW, [DOVADA]);
  assert.equal(sterse, 0);
  assert.ok(s._map.has(DOVADA), "dovada e încă în cloud");
});

test("verificată dar NEimportată → dovada RĂMÂNE (managerul încă n-are copia lui)", async () => {
  const s = magazieFalsa(Object.fromEntries([fisa("lisa"), marcaj("lisa", "verificat"), [DOVADA, "poza"]]));
  assert.equal(await stergeDovezileIncheiate(s, SHOW, [DOVADA]), 0);
  assert.ok(s._map.has(DOVADA));
});

test("importată + verificată → dovada se ȘTERGE (treaba ei s-a încheiat)", async () => {
  const s = magazieFalsa(Object.fromEntries([fisa("lisa", { importat: true }), marcaj("lisa", "verificat"), [DOVADA, "poza"]]));
  assert.equal(await stergeDovezileIncheiate(s, SHOW, [DOVADA]), 1);
  assert.ok(!s._map.has(DOVADA), "dovada a plecat din cloud");
});

test("«de lămurit» NU e încheiere — dovada rămâne", async () => {
  const s = magazieFalsa(Object.fromEntries([fisa("lisa", { importat: true }), marcaj("lisa", "lamurit"), [DOVADA, "poza"]]));
  assert.equal(await stergeDovezileIncheiate(s, SHOW, [DOVADA]), 0);
  assert.ok(s._map.has(DOVADA));
});

test("dovadă comună unui LOT: se șterge abia când TOȚI câinii au încheiat-o", async () => {
  const s = magazieFalsa(Object.fromEntries([
    fisa("lisa", { importat: true }), marcaj("lisa", "verificat"),
    fisa("rex", { importat: true }),                    // fratele de lot, încă neverificat
    [DOVADA, "poza"],
  ]));
  assert.equal(await stergeDovezileIncheiate(s, SHOW, [DOVADA]), 0, "fratele de lot o mai ține");
  s._map.set("verificare/" + SHOW + "/rex", { stare: "verificat" });
  assert.equal(await stergeDovezileIncheiate(s, SHOW, [DOVADA]), 1, "acum toți au încheiat");
  assert.ok(!s._map.has(DOVADA));
});

test("FAIL-SAFE: o citire care aruncă → nu se șterge NIMIC", async () => {
  const s = magazieFalsa(Object.fromEntries([fisa("lisa", { importat: true }), marcaj("lisa", "verificat"), [DOVADA, "poza"]]));
  const rupt = { ...s, get: async () => { throw new Error("magazia tuse"); }, list: s.list.bind(s) };
  assert.equal(await stergeDovezileIncheiate(rupt, SHOW, [DOVADA]), 0);
  assert.ok(s._map.has(DOVADA), "la eroare, dovada rămâne");
});

test("gărzile declanșatorilor sunt în cod (static): importul și marcarea cheamă curățenia", async () => {
  const { readFileSync } = await import("node:fs");
  const expo = readFileSync(new URL("../inscriere-expo.mjs", import.meta.url), "utf8");
  const verif = readFileSync(new URL("../verificare-inscrieri.mjs", import.meta.url), "utf8");
  assert.ok(expo.includes("stergeDovezileIncheiate(store, showIdLot, dovezi)"), "importul curăță prin regula comună");
  assert.ok(/stare === "verificat" && i\.importat === true && i\.dovadaKey/.test(verif), "marcarea curăță doar la «verificat» pe fișă importată");
});

test("dovada ALTEI expoziții nu se șterge (marcare în lot peste expoziții)", async () => {
  const ALTA = "dovada/expo2/plata-9.jpg";
  const s = magazieFalsa(Object.fromEntries([
    fisa("lisa", { importat: true }), marcaj("lisa", "verificat"),
    [DOVADA, "poza"], [ALTA, "poza-alta"],
  ]));
  // Chemăm cu AMBELE chei, dar showId-ul e al primei expoziții.
  const sterse = await stergeDovezileIncheiate(s, SHOW, [DOVADA, ALTA]);
  assert.equal(sterse, 1, "doar dovada expoziției cerute");
  assert.ok(!s._map.has(DOVADA), "a ei a plecat");
  assert.ok(s._map.has(ALTA), "dovada altei expoziții rămâne neatinsă");
});

test("fișă listată dar necitibilă (null) → se ȚINE dovada, nu se sare peste", async () => {
  const s = magazieFalsa(Object.fromEntries([fisa("lisa", { importat: true }), marcaj("lisa", "verificat"), [DOVADA, "poza"]]));
  const rupt = {
    ...s,
    list: s.list.bind(s),
    // Fișa se listează, dar citirea ei întoarce null (decalaj de consistență).
    get: async (k) => (k.startsWith("coada/") ? null : s.get(k)),
  };
  assert.equal(await stergeDovezileIncheiate(rupt, SHOW, [DOVADA]), 0);
  assert.ok(s._map.has(DOVADA), "necunoscutul se tratează ca motiv de reținere");
});
