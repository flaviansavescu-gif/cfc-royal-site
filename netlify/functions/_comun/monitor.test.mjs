// Teste pentru logica de alertare a monitorizării.
//
// Miza nu e că detectează o cădere — asta e partea ușoară. Miza e să nu trimită 96 de
// e-mailuri pe zi cât ține o problemă (atunci nu se mai citește niciunul) și să nu tacă
// zile întregi (atunci n-a folosit la nimic). Aici se testează exact echilibrul ăsta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, stareDin, verificariCazute, deCandText, PRAG_REAMINTIRE_MS } from "./monitor.mjs";

const bun = [{ nume: "A", ok: true, detaliu: "" }, { nume: "B", ok: true, detaliu: "" }];
const rau = [{ nume: "A", ok: false, detaliu: "a răspuns 500" }, { nume: "B", ok: true, detaliu: "" }];
const T0 = Date.parse("2026-08-01T10:00:00.000Z");
const ora = 3600e3;

test("o singură verificare picată strică starea de ansamblu", () => {
  assert.equal(stareDin(bun), "bun");
  assert.equal(stareDin(rau), "rau");
  assert.equal(verificariCazute(rau).length, 1);
});

test("prima rulare, totul bine: nu deranjează pe nimeni", () => {
  const { stare, alerta } = decide(null, bun, T0);
  assert.equal(stare.stare, "bun");
  assert.equal(alerta, null, "normalitatea nu e o veste");
});

test("prima rulare cu o problemă: alertă de cădere", () => {
  const { stare, alerta } = decide(null, rau, T0);
  assert.equal(stare.stare, "rau");
  assert.equal(alerta.tip, "cadere");
  assert.match(alerta.subiect, /^A$/);
});

test("bun -> rău: o singură alertă", () => {
  const { stare: s1 } = decide(null, bun, T0);
  const { alerta } = decide(s1, rau, T0 + 900e3);
  assert.equal(alerta.tip, "cadere");
});

test("rău -> rău: TACE până la pragul de reamintire", () => {
  let s = decide(null, rau, T0).stare;
  // Următoarele rulări, în prima oră: niciun e-mail.
  for (let i = 1; i <= 4; i++) {
    const r = decide(s, rau, T0 + i * 900e3);
    assert.equal(r.alerta, null, `rularea ${i} n-ar fi trebuit să alerteze`);
    s = r.stare;
  }
});

test("rău care ține: exact o reamintire la fiecare prag", () => {
  let s = decide(null, rau, T0).stare;
  const r6 = decide(s, rau, T0 + PRAG_REAMINTIRE_MS);
  assert.equal(r6.alerta.tip, "reamintire");
  s = r6.stare;
  // Imediat după reamintire, iar tăcere.
  const r6b = decide(s, rau, T0 + PRAG_REAMINTIRE_MS + 900e3);
  assert.equal(r6b.alerta, null);
  // A doua reamintire, după încă un prag.
  const r12 = decide(r6b.stare, rau, T0 + 2 * PRAG_REAMINTIRE_MS);
  assert.equal(r12.alerta.tip, "reamintire");
});

test("rău -> bun: se anunță revenirea", () => {
  const s = decide(null, rau, T0).stare;
  const { alerta, stare } = decide(s, bun, T0 + 2 * ora);
  assert.equal(alerta.tip, "revenire");
  assert.equal(stare.stare, "bun");
});

test("bun -> bun: tăcere, oricâte rulări", () => {
  let s = decide(null, bun, T0).stare;
  for (let i = 1; i <= 10; i++) {
    const r = decide(s, bun, T0 + i * 900e3);
    assert.equal(r.alerta, null);
    s = r.stare;
  }
});

test("`de` arată de când ține starea, nu de când e ultima verificare", () => {
  const s1 = decide(null, rau, T0).stare;
  const s2 = decide(s1, rau, T0 + ora).stare;
  const s3 = decide(s2, rau, T0 + 2 * ora).stare;
  assert.equal(s3.de, s1.de, "starea ține din prima cădere");
  assert.notEqual(s3.la, s1.la, "dar verificarea e proaspătă");
});

test("revenirea repornește cronometrul stării", () => {
  const s1 = decide(null, rau, T0).stare;
  const s2 = decide(s1, bun, T0 + 2 * ora).stare;
  assert.equal(s2.de, new Date(T0 + 2 * ora).toISOString());
});

test("mai multe verificări picate se numesc toate în subiect", () => {
  const doua = [{ nume: "A", ok: false }, { nume: "B", ok: false }];
  const { alerta } = decide(null, doua, T0);
  assert.match(alerta.subiect, /2 verificări picate: A, B/);
});

test("deCandText spune în cuvinte, nu în milisecunde", () => {
  assert.equal(deCandText(new Date(T0).toISOString(), T0 + 5 * 60e3), "de 5 de minute");
  assert.equal(deCandText(new Date(T0).toISOString(), T0 + 3 * ora), "de 3 ore");
  assert.equal(deCandText(new Date(T0).toISOString(), T0 + 49 * ora), "de 2 zile");
  assert.equal(deCandText(null), "");
});

test("verificările fără `ok: false` explicit nu strică starea (sărite)", () => {
  const cuSarita = [{ nume: "A", ok: true }, { nume: "C", ok: undefined }];
  assert.equal(stareDin(cuSarita), "bun");
});
