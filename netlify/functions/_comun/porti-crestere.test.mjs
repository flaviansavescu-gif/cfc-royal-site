// Probe pentru porțile de creștere (Art. 22 din Regulamentul de creștere și sănătate).
//
// Fiecare poartă se probează în trei feluri: cazul care TRECE, cazul care se OPREȘTE
// și cazul care doar SEMNALEAZĂ. Plus cel mai important caz dintre toate: monta
// dinaintea regulamentului, pe care nicio poartă nu are voie s-o judece (Art. 27).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  START_PORTI, PRAG, luniIntre, nrComparabil, rudenieParinti, portiCrestere, mesajOpriri,
} from "./porti-crestere.mjs";

// Un dosar sănătos: femelă de 3 ani, mascul de 4, fără istoric, fără rudenie.
const bun = () => ({
  dataMontei: "2026-09-01",
  dataFatarii: "2026-11-03",
  mascul: { dataNasterii: "2022-05-10", pedigree: "CFCR-DMF-10/2024" },
  femela: { dataNasterii: "2023-06-15", pedigree: "CFCR-DMF-11/2024" },
  fatareCezariana: false,
  motivSelectie: "",
  fatariAnterioare: [],
  ascMascul: null,
  ascFemela: null,
  adnMasculVerificat: false,
});

test("luniIntre numără lunile împlinite, ca la vârstă", () => {
  assert.equal(luniIntre("2025-01-15", "2025-03-15"), 2);
  assert.equal(luniIntre("2025-01-15", "2025-03-14"), 1); // ziua neîmplinită nu se pune
  assert.equal(luniIntre("2025-01-15", "2025-01-15"), 0);
  assert.equal(luniIntre("2024-08-19", "2026-08-19"), 24);
  assert.equal(luniIntre("stricat", "2026-01-01"), null);
});

test("dosarul sănătos trece prin toate porțile", () => {
  const r = portiCrestere(bun());
  assert.deepEqual(r.opriri, []);
  assert.deepEqual(r.semnale, []);
});

test("Art. 27: monta dinaintea regulamentului nu se judecă deloc", () => {
  const p = bun();
  p.dataMontei = "2026-08-01"; // înainte de 13 august
  p.femela.dataNasterii = "2026-01-01"; // femelă de câteva luni — flagrant
  p.fatariAnterioare = [{ serie: "DMF-1/2026", dataFatarii: "2026-06-01", cezariana: true }];
  const r = portiCrestere(p);
  assert.deepEqual(r.opriri, []);
  assert.deepEqual(r.semnale, []);
  assert.ok(START_PORTI === "2026-08-13");
});

test("Art. 6 (1): femela sub 18 luni se oprește", () => {
  const p = bun();
  p.femela.dataNasterii = "2025-06-01"; // 15 luni la 2026-09-01
  const r = portiCrestere(p);
  assert.equal(r.opriri.length, 1);
  assert.equal(r.opriri[0].articol, "Art. 6 alin. (1)");
  assert.match(r.opriri[0].motiv, /15 luni/);
});

test("Art. 6 (1): fix 18 luni trece", () => {
  const p = bun();
  p.femela.dataNasterii = "2025-03-01"; // exact 18 la 2026-09-01
  assert.deepEqual(portiCrestere(p).opriri, []);
});

test("Art. 6 (2) și (3): femela de 8–9 ani semnalează, peste 9 se oprește", () => {
  const intre = bun();
  intre.femela.dataNasterii = "2018-05-01"; // ~8 ani și 4 luni
  const r1 = portiCrestere(intre);
  assert.deepEqual(r1.opriri, []);
  assert.equal(r1.semnale.length, 1);
  assert.equal(r1.semnale[0].articol, "Art. 6 alin. (3)");

  const peste = bun();
  peste.femela.dataNasterii = "2017-08-01"; // peste 9 ani
  const r2 = portiCrestere(peste);
  assert.equal(r2.opriri.length, 1);
  assert.equal(r2.opriri[0].articol, "Art. 6 alin. (2)");
});

test("Art. 7: masculul sub 12 luni se oprește; 12–14 fără ADN semnalează; cu ADN tace", () => {
  const mic = bun();
  mic.mascul.dataNasterii = "2025-11-01"; // 10 luni
  assert.equal(portiCrestere(mic).opriri[0].articol, "Art. 7 alin. (1)");

  const tanar = bun();
  tanar.mascul.dataNasterii = "2025-08-01"; // 13 luni
  const r = portiCrestere(tanar);
  assert.deepEqual(r.opriri, []);
  assert.equal(r.semnale[0].articol, "Art. 7 alin. (2)");

  tanar.adnMasculVerificat = true;
  assert.deepEqual(portiCrestere(tanar).semnale, []);
});

test("Art. 8 (1): sub 10 luni de la fătarea precedentă se oprește; la 10 trece", () => {
  const p = bun();
  p.fatariAnterioare = [{ serie: "DMF-5/2026", dataFatarii: "2026-04-03", cezariana: false }]; // 7 luni
  const r = portiCrestere(p);
  assert.equal(r.opriri.length, 1);
  assert.equal(r.opriri[0].articol, "Art. 8 alin. (1)");
  assert.match(r.opriri[0].motiv, /DMF-5\/2026/);

  p.fatariAnterioare = [{ serie: "DMF-5/2026", dataFatarii: "2026-01-03", cezariana: false }]; // exact 10
  assert.deepEqual(portiCrestere(p).opriri, []);
});

test("Art. 8: aceeași dată de fătare = cuib declarat de două ori", () => {
  const p = bun();
  p.fatariAnterioare = [{ serie: "DMF-7/2026", dataFatarii: p.dataFatarii, cezariana: false }];
  const r = portiCrestere(p);
  assert.match(r.opriri[0].motiv, /declarat de două ori/);
});

test("Art. 8 (2): al patrulea cuib în 24 de luni se oprește", () => {
  const p = bun();
  p.dataFatarii = "2026-11-03";
  p.fatariAnterioare = [
    { serie: "A", dataFatarii: "2024-12-01", cezariana: false },
    { serie: "B", dataFatarii: "2025-10-15", cezariana: false },
    { serie: "C", dataFatarii: "2025-12-20", cezariana: false },
  ];
  // Fiecare pereche vecină are peste 10 luni? A→B are 10, B→C are 2 — oprire de interval
  // oricum; aici ne interesează să apară și poarta ferestrei. Aleg date curate:
  p.fatariAnterioare = [
    { serie: "A", dataFatarii: "2025-01-10", cezariana: false },
    { serie: "B", dataFatarii: "2025-11-20", cezariana: false },
    { serie: "C", dataFatarii: "2026-01-02", cezariana: false },
  ];
  const r = portiCrestere(p);
  assert.ok(r.opriri.some((o) => o.articol === "Art. 8 alin. (2)"), "poarta ferestrei de 24 de luni");
});

test("Art. 9: după două cezariene femela se oprește; la prima declarată acum, semnal la a doua", () => {
  const p = bun();
  p.fatariAnterioare = [
    { serie: "A", dataFatarii: "2024-01-10", cezariana: true },
    { serie: "B", dataFatarii: "2025-06-20", cezariana: true },
  ];
  const r = portiCrestere(p);
  assert.ok(r.opriri.some((o) => o.articol === "Art. 9 alin. (1)"));

  const q = bun();
  q.fatareCezariana = true;
  q.fatariAnterioare = [{ serie: "A", dataFatarii: "2024-01-10", cezariana: true }];
  const r2 = portiCrestere(q);
  assert.deepEqual(r2.opriri, []);
  assert.ok(r2.semnale.some((s) => s.articol === "Art. 9 alin. (1)"), "semnalul celei de-a doua cezariene");
});

test("nrComparabil aduce seria la o formă comparabilă și refuză resturile scurte", () => {
  assert.equal(nrComparabil(" cfcr-dmf-10/2024 "), "CFCRDMF102024");
  assert.equal(nrComparabil("RO"), "");
  assert.equal(nrComparabil(null), "");
});

test("Art. 11: tată × fiică se vede din ascendența femelei și oprește", () => {
  const p = bun();
  p.ascFemela = { T: { nume: "Rex", nr: "CFCR-DMF-10/2024" } }; // = pedigree-ul masculului
  const r = portiCrestere(p);
  assert.equal(r.opriri[0].articol, "Art. 11");
  assert.match(r.opriri[0].motiv, /tatăl femelei/);
});

test("Art. 11: frate și soră cu ambii părinți comuni oprește", () => {
  const p = bun();
  p.ascMascul = { T: { nr: "AAA-111/2020" }, M: { nr: "BBB-222/2020" } };
  p.ascFemela = { T: { nr: "AAA-111/2020" }, M: { nr: "BBB-222/2020" } };
  const r = portiCrestere(p);
  assert.equal(r.opriri[0].articol, "Art. 11");
});

test("Art. 12: rude de gradul II fără motiv se opresc; cu motiv doar semnalează", () => {
  const p = bun();
  p.ascMascul = { T: { nr: "AAA-111/2020" }, M: { nr: "CCC-333/2021" } };
  p.ascFemela = { T: { nr: "AAA-111/2020" }, M: { nr: "DDD-444/2021" } };
  const fara = portiCrestere(p);
  assert.equal(fara.opriri[0].articol, "Art. 12");

  p.motivSelectie = "Fixarea tipului de cap din linia bunicului patern.";
  const cu = portiCrestere(p);
  assert.deepEqual(cu.opriri, []);
  assert.equal(cu.semnale[0].articol, "Art. 12");
});

test("Art. 12: bunicul femelei ca partener e grad II", () => {
  const p = bun();
  p.ascFemela = { TT: { nr: "CFCR-DMF-10/2024" } }; // bunicul patern = masculul din DMF
  p.motivSelectie = "Motiv de selecție scris cum se cere.";
  const r = portiCrestere(p);
  assert.ok(r.semnale.some((s) => s.articol === "Art. 12"));
});

test("fără fișe în registru, rudenia tace — verificarea rămâne a registraturii", () => {
  const p = bun(); // ascMascul și ascFemela null
  const r = portiCrestere(p);
  assert.deepEqual(r.opriri, []);
});

test("mesajOpriri citează articolul și calea de reexaminare", () => {
  const m = mesajOpriri([{ articol: "Art. 6 alin. (1)", motiv: "femela avea 15 luni" }]);
  assert.match(m, /Art\. 6 alin\. \(1\)/);
  assert.match(m, /reexaminarea/);
});

test("pragurile poartă valorile din regulament", () => {
  assert.equal(PRAG.FEMELA_MIN_LUNI, 18);
  assert.equal(PRAG.FEMELA_MAX_LUNI, 96);
  assert.equal(PRAG.FEMELA_EXCEPTIE_LUNI, 108);
  assert.equal(PRAG.MASCUL_MIN_LUNI, 12);
  assert.equal(PRAG.MASCUL_ADN_LUNI, 15);
  assert.equal(PRAG.ODIHNA_LUNI, 10);
  assert.equal(PRAG.MAX_CUIBURI, 3);
  assert.equal(PRAG.MAX_CEZARIENE, 2);
});
