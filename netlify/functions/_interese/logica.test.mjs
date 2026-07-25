// Teste pentru logica profilului de interese pe rase. Rulează cu:
//   node --test netlify/functions/_interese/logica.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_GRUPE, MAX_RASE, curataGrupe, curataRase, grupeEfective, poateTrimite,
  sugestii, incarcareLectori, agregare, randIndex, pune, scoate,
} from "./logica.mjs";

// ————— sanitizare —————

test("curataGrupe păstrează doar 1–10, fără duplicate, sortat", () => {
  assert.deepEqual(curataGrupe([3, 1, 3, 10]), [1, 3, 10]);
  assert.deepEqual(curataGrupe([0, 11, -2, "abc", null, undefined]), []);
  assert.deepEqual(curataGrupe(["5", "2"]), [2, 5], "acceptă și numere ca text");
  assert.deepEqual(curataGrupe(null), []);
  assert.deepEqual(curataGrupe("nu e listă"), []);
});

test("curataRase elimină duplicatele și intrările invalide", () => {
  const r = curataRase([
    { ro: "Beagle", g: 6 },
    { ro: "Beagle", g: 6 },   // duplicat
    { ro: "Beagle", g: 7 },   // aceeași rasă, altă grupă = intrare distinctă
    { ro: "", g: 3 },         // fără nume
    { ro: "X", g: 99 },       // grupă invalidă
    { ro: "Y" },              // fără grupă
  ]);
  assert.deepEqual(r, [{ ro: "Beagle", g: 6 }, { ro: "Beagle", g: 7 }]);
});

test("curataRase limitează la MAX_RASE", () => {
  const multe = Array.from({ length: MAX_RASE + 25 }, (_, i) => ({ ro: "Rasa " + i, g: 1 }));
  assert.equal(curataRase(multe).length, MAX_RASE);
});

test("curataRase taie numele foarte lungi", () => {
  const r = curataRase([{ ro: "x".repeat(500), g: 2 }]);
  assert.equal(r[0].ro.length, 120);
});

// ————— regula de lărgime (miezul funcțional) —————

test("o rasă aleasă contează ca interes pentru grupa ei", () => {
  const g = grupeEfective([], [{ ro: "Beagle", g: 6 }, { ro: "Whippet", g: 10 }]);
  assert.deepEqual(g, [6, 10]);
  assert.equal(poateTrimite(g), true, "două rase din grupe diferite ating pragul");
});

test("grupele bifate se reunesc cu cele ale raselor, fără duplicate", () => {
  assert.deepEqual(grupeEfective([6, 1], [{ ro: "Beagle", g: 6 }, { ro: "Puli", g: 1 }]), [1, 6]);
});

test("pragul de lărgime respinge o singură grupă", () => {
  const g = grupeEfective([3], [{ ro: "Fox Terrier", g: 3 }]);
  assert.deepEqual(g, [3]);
  assert.equal(poateTrimite(g), false, "o singură grupă nu e suficientă");
});

test("pragul e exact MIN_GRUPE, nu mai mult", () => {
  assert.equal(poateTrimite([1, 2]), true);
  assert.equal(poateTrimite([1]), false);
  assert.equal(poateTrimite([]), false);
  assert.equal(MIN_GRUPE, 2);
});

test("grupeEfective ignoră rasele cu grupă invalidă", () => {
  assert.deepEqual(grupeEfective([2], [{ ro: "X", g: 42 }]), [2]);
});

// ————— sugestia de lector —————

const LECTORI_TEST = [
  { slug: "all-1", nume: "Alfa AllBreed", grupe: [1,2,3,4,5,6,7,8,9,10], allBreed: true },
  { slug: "all-2", nume: "Beta AllBreed", grupe: [1,2,3,4,5,6,7,8,9,10], allBreed: true },
  { slug: "ingust", nume: "Gama Îngust", grupe: [3, 5, 9], allBreed: false },
];

test("sugestia pune primul lectorul cu cea mai mare suprapunere", () => {
  const s = sugestii(LECTORI_TEST, [3, 5], { "all-1": 0, "all-2": 0, ingust: 0 });
  assert.equal(s[0].overlap, 2);
  // toți trei acoperă {3,5}; la overlap egal contează încărcarea, apoi numele
  assert.equal(s.length, 3);
});

test("la suprapunere egală câștigă lectorul cu mai puțini candidați", () => {
  const s = sugestii(LECTORI_TEST, [3, 5], { "all-1": 7, "all-2": 1, ingust: 4 });
  assert.equal(s[0].slug, "all-2", "cel mai puțin încărcat primul");
  assert.equal(s[1].slug, "ingust");
  assert.equal(s[2].slug, "all-1");
});

test("un lector care nu acoperă nicio grupă cerută ajunge ultimul", () => {
  const s = sugestii(LECTORI_TEST, [7], {});
  assert.equal(s[s.length - 1].slug, "ingust");
  assert.equal(s[s.length - 1].overlap, 0);
});

test("la egalitate totală se departajează alfabetic", () => {
  const s = sugestii(LECTORI_TEST, [3], { "all-1": 0, "all-2": 0, ingust: 0 });
  assert.deepEqual(s.map((x) => x.nume), ["Alfa AllBreed", "Beta AllBreed", "Gama Îngust"]);
});

test("sugestia nu se supără pe intrări lipsă", () => {
  assert.deepEqual(sugestii([], [1], {}), []);
  assert.equal(sugestii(LECTORI_TEST, null, null).length, 3);
});

// ————— încărcare și agregare —————

test("incarcareLectori numără candidații repartizați", () => {
  const inc = incarcareLectori([
    { cid: "a", alocare: { lectorSlug: "x" } },
    { cid: "b", alocare: { lectorSlug: "x" } },
    { cid: "c", alocare: { lectorSlug: "y" } },
    { cid: "d", alocare: null },
    { cid: "e" },
  ]);
  assert.deepEqual(inc, { x: 2, y: 1 });
});

test("agregarea numără cererea pe grupe și pe rase", () => {
  const { cerereGrupe, cerereRase } = agregare([
    { grupe: [1, 6], rase: [{ ro: "Beagle", g: 6 }] },
    { grupe: [6], rase: [{ ro: "Beagle", g: 6 }, { ro: "Puli", g: 1 }] },
  ]);
  assert.deepEqual(cerereGrupe, { 1: 1, 6: 2 });
  assert.equal(cerereRase["6|Beagle"], 2);
  assert.equal(cerereRase["1|Puli"], 1);
});

test("agregarea pe listă goală întoarce obiecte goale", () => {
  const { cerereGrupe, cerereRase } = agregare([]);
  assert.deepEqual(cerereGrupe, {});
  assert.deepEqual(cerereRase, {});
});

// ————— indexul —————

test("randIndex păstrează exact câmpurile necesare listelor", () => {
  const r = randIndex({ cid: "c1", nume: "Ion", grupe: [1], rase: [], nota: "n", actualizat: "2026-01-01", creat: "x", secret: "nu" }, { lectorSlug: "l" });
  assert.deepEqual(Object.keys(r).sort(), ["actualizat", "alocare", "cid", "grupe", "nota", "nume", "rase"]);
  assert.equal(r.secret, undefined, "nu duce mai departe câmpuri nedorite");
  assert.deepEqual(r.alocare, { lectorSlug: "l" });
});

test("pune înlocuiește rândul aceluiași candidat, nu îl dublează", () => {
  let idx = [];
  idx = pune(idx, { cid: "a", nume: "Ana", actualizat: "2026-01-01" });
  idx = pune(idx, { cid: "a", nume: "Ana R.", actualizat: "2026-02-01" });
  assert.equal(idx.length, 1);
  assert.equal(idx[0].nume, "Ana R.");
});

test("pune ține lista sortată, cel mai recent primul", () => {
  let idx = [];
  idx = pune(idx, { cid: "a", actualizat: "2026-01-01" });
  idx = pune(idx, { cid: "b", actualizat: "2026-03-01" });
  idx = pune(idx, { cid: "c", actualizat: "2026-02-01" });
  assert.deepEqual(idx.map((x) => x.cid), ["b", "c", "a"]);
});

test("scoate elimină doar candidatul cerut", () => {
  const idx = [{ cid: "a" }, { cid: "b" }, { cid: "c" }];
  assert.deepEqual(scoate(idx, "b").map((x) => x.cid), ["a", "c"]);
  assert.deepEqual(scoate(idx, "inexistent").map((x) => x.cid), ["a", "b", "c"]);
  assert.deepEqual(scoate(null, "a"), []);
});
