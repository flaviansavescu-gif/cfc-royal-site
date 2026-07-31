// Probele socotelii din spatele citirii certificatelor.
//
// Cea care contează cu adevărat e prima: MUTAREA GENERAȚIEI. E singurul fel de greșeală
// din tot modulul care trece nevăzută pe lângă un om atent — ascendența iese întreagă,
// numele sunt reale, doar că fiecare stă cu un rând mai jos decât îi e locul. Un act
// eliberat așa e greșit pe vecie și se moștenește la toți descendenții.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mutaSubRadacina, nepotrivirile, laFel } from "./citire-ascendenta.mjs";
import { pozitiiAscendenta } from "../registru-pedigree.mjs";

const CODURI = pozitiiAscendenta().map((p) => p.cod);
const p = (cod, nume, rest = {}) => ({ cod, nume, nr: "", titluri: "", sigur: true, nelamurire: "", ...rest });

test("cele 30 de coduri sunt cele pe care le știe registrul", () => {
  assert.equal(CODURI.length, 30);
  assert.ok(CODURI.includes("T") && CODURI.includes("MMMM"));
});

test("certificatul TATĂLUI: fiecare poziție urcă exact cu o generație", () => {
  const { propuneri } = mutaSubRadacina("T", [
    p("T", "Bunicul patern"),          // tatăl tatălui  -> TT
    p("M", "Bunica paternă"),          // mama tatălui   -> TM
    p("MT", "Străbunic"),              //                -> TMT
    p("MMM", "Stră-străbunică"),       //                -> TMMM
  ], CODURI, "TATĂL");

  assert.equal(propuneri.TT.nume, "Bunicul patern");
  assert.equal(propuneri.TM.nume, "Bunica paternă");
  assert.equal(propuneri.TMT.nume, "Străbunic");
  assert.equal(propuneri.TMMM.nume, "Stră-străbunică");
  // Și, mai ales: NU au rămas pe codurile de pe certificat.
  assert.equal(propuneri.T, undefined);
  assert.equal(propuneri.M, undefined);
});

test("certificatul MAMEI intră pe ramura ei, nu peste a tatălui", () => {
  const { propuneri } = mutaSubRadacina("M", [p("T", "Bunicul matern")], CODURI);
  assert.equal(propuneri.MT.nume, "Bunicul matern");
  assert.equal(propuneri.TT, undefined);
});

test("generația a 4-a de pe certificat depășește registrul și se lasă afară", () => {
  // „TTTT" pe certificatul tatălui ar fi „TTTTT" pentru pui: a cincea generație.
  const { propuneri, luate } = mutaSubRadacina("T", [
    p("TTTT", "Prea departe"),
    p("TTT", "Ultima bună"),
  ], CODURI);
  assert.equal(luate, 1);
  assert.equal(propuneri.TTTT.nume, "Ultima bună");
  assert.equal(propuneri.TTTTT, undefined);
});

test("pozițiile fără nume nu se propun deloc", () => {
  // Un câmp gol pe certificat înseamnă strămoș necunoscut. Propus ca poziție goală, ar
  // umple registrul cu rânduri care arată completate și nu spun nimic.
  const { propuneri, luate } = mutaSubRadacina("T", [
    p("T", ""),
    p("M", "   "),
    p("TT", "Există"),
  ], CODURI);
  assert.equal(luate, 1);
  assert.deepEqual(Object.keys(propuneri), ["TTT"]);
});

test("codul stricat nu ajunge niciodată pe o poziție greșită", () => {
  // Dacă din cod nu rămâne nimic după curățare, poziția se aruncă. Altfel „T" + "" = „T",
  // adică tatăl însuși ar primi numele unui strămoș oarecare.
  const { propuneri, luate } = mutaSubRadacina("T", [
    p("???", "Necunoscut"),
    p("", "Fără cod"),
  ], CODURI);
  assert.equal(luate, 0);
  assert.equal(propuneri.T, undefined);
});

test("nesiguranța se numără și se păstrează, nu se rotunjește la «bine»", () => {
  const { propuneri, nesigure } = mutaSubRadacina("T", [
    p("T", "Citit clar"),
    p("M", "Neclar", { sigur: false, nelamurire: "poate fi 0 sau O" }),
  ], CODURI);
  assert.equal(nesigure, 1);
  assert.equal(propuneri.TT.sigur, true);
  assert.equal(propuneri.TM.sigur, false);
  assert.match(propuneri.TM.nelamurire, /0 sau O/);
});

test("un «sigur» lipsă se ia drept sigur; doar false marchează nesiguranța", () => {
  const { propuneri, nesigure } = mutaSubRadacina("T", [{ cod: "T", nume: "Fără câmpul sigur" }], CODURI);
  assert.equal(nesigure, 0);
  assert.equal(propuneri.TT.sigur, true);
});

test("titlurile se taie la 120, cât păstrează și salvarea", () => {
  const { propuneri } = mutaSubRadacina("T", [p("T", "X", { titluri: "A".repeat(300) })], CODURI);
  assert.equal(propuneri.TT.titluri.length, 120);
});

test("intrare stricată nu doboară citirea", () => {
  assert.deepEqual(mutaSubRadacina("T", null, CODURI).propuneri, {});
  assert.deepEqual(mutaSubRadacina("T", [null, undefined, 7], CODURI).propuneri, {});
});

// —— Comparația cu declarația ——

test("aceeași serie scrisă altfel nu e nepotrivire", () => {
  assert.ok(laFel("WDF.RO 150194 R22", "WDF.RO150194R22"));
  assert.ok(laFel("rkf-4091390", "RKF 4091390"));
});

// Cele de mai jos sunt luate întocmai din proba pe cuibul 26 — n-au fost ticluite.
test("afixul canisei, altfel pus în paranteză, nu e nepotrivire", () => {
  assert.ok(laFel("OLIVER (Stone FCI)", "OLIVER Stone (FCI)"));
  assert.ok(laFel("DANCE (Mjuzi Pelagey)", "DANCE Mjuzi Pelagey"));
  assert.ok(laFel("ENZO PSIA DOLINA", "ENZO, Psia Dolina"));
  assert.ok(laFel("RICHARD (Pobeditel)", "RICHARD Pobeditel"));
});

test("apostroful, oricum ar fi scris, nu e nepotrivire", () => {
  assert.ok(laFel("LORIYA (z Sozvezdiy L'va)", "LORIYA z Sozvezdiy L`va"));
  assert.ok(laFel("L’va", "L'va"));
});

test("dar cele TREI diferențe adevărate de la cuibul 26 tot trec", () => {
  // Dacă normalizarea ar fi mers un pas mai departe, ar fi înghițit exact greșelile
  // pentru care există tot modulul.
  assert.ok(!laFel("ADEKAIDA Riko", "ADELAIDA Riko"));                        // K față de L
  assert.ok(!laFel("TAINSTVENNYA NEZNAKOMKA", "TAINSTVENNAYA NEZNAKOMKA"));   // un A lipsă
  assert.ok(!laFel("RKF 4396006", "RKF 4396008"));                            // ultima cifră
});

test("diacriticele rămân litere: nu se pierd la normalizare", () => {
  assert.ok(!laFel("CĂȚELUȘUL", "CATELUSUL"));
  assert.ok(laFel("Cățelușul potrivit", "CĂȚELUȘUL POTRIVIT"));
});

test("o cifră schimbată ESTE nepotrivire", () => {
  // Exact greșeala de la care a pornit tot modulul.
  assert.ok(!laFel("RKF 4091390", "RKF 4091930"));
  const n = nepotrivirile({
    declarat: { pedigree: "RKF 4091930" },
    citit: { nr: "RKF 4091390" },
    eticheta: "tatălui",
  });
  assert.equal(n.length, 1);
  assert.match(n[0].camp, /seria de pedigree a tatălui/);
  assert.equal(n[0].declaratie, "RKF 4091930");
  assert.equal(n[0].document, "RKF 4091390");
});

test("câmpul gol înseamnă «nu știu», nu «altceva»", () => {
  assert.deepEqual(nepotrivirile({
    declarat: { nume: "Enzo", microcip: "" },
    citit: { nume: "", microcip: "642091234567890" },
  }), []);
});

test("toate cele patru câmpuri se compară, inclusiv rasa dosarului", () => {
  const n = nepotrivirile({
    declarat: { nume: "Enzo", pedigree: "A1", microcip: "111111111111111" },
    citit: { nume: "Enzo", nr: "A1", microcip: "222222222222222", rasa: "Caniche" },
    rasaDosar: "Poodle",
    eticheta: "tatălui",
  });
  assert.equal(n.length, 2);
  assert.ok(n.some((x) => /microcipul/.test(x.camp)));
  assert.ok(n.some((x) => /rasa/.test(x.camp)));
});

console.log("citire-ascendenta: toate probele trecute");
