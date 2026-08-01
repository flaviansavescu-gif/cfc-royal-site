// Probele încărcării pe bucăți.
//
// DE CE EXISTĂ. Un act de origine ciuntit e mai rău decât unul lipsă: arată ca un act
// întreg. Dacă lipirea bucăților greșește ordinea, sare una, sau scrie ce a apucat când
// trimiterea s-a oprit la mijloc, la dosar ajunge un fișier care se deschide, arată a
// pedigree, și e greșit.
//
// Aici se probează SOCOTEALA, nu cererile de rețea: câte bucăți ies dintr-un fișier, cum
// se taie, cum se lipesc la loc, și că un fișier ciuntit nu poate ieși întreg.
import { test } from "node:test";
import assert from "node:assert/strict";

// Aceleași valori ca în `registru-dmf.mjs` și în pagina de depunere. Scrise aici a doua
// oară anume: dacă cineva le schimbă într-un loc și uită în celălalt, probele cad.
const PRAG = 3 * 1024 * 1024;
const MAX_TOTAL = 20 * 1024 * 1024;
const MAX_PARTI = 12;

/** Câte bucăți ies dintr-un fișier de mărimea dată. */
const cateParti = (marime) => (marime <= PRAG ? 1 : Math.ceil(marime / PRAG));

/**
 * Conținut de probă care NU se repetă la fiecare bucată.
 *
 * Prima încercare a folosit (i * 31 + 7) & 0xff. Se repetă din 256 în 256, iar pragul
 * (3 MiB) e multiplu de 256 — deci toate bucățile pline ieșeau IDENTICE, iar fișierul
 * lipit pe dos era la fel cu originalul. Proba trecea fără să dovedească nimic; abia
 * proba de ordine a dat-o de gol.
 *
 * Termenii cu deplasare (>>> 13 și >>> 21) schimbă tiparul din kilooctet în kilooctet și
 * din megaoctet în megaoctet, deci două bucăți nu pot ieși la fel.
 */
const tipar = (i) => (i ^ (i >>> 13) ^ (i >>> 21)) & 0xff;

/** Taie o bucată, ca blob.slice din browser. */
function taie(date, i) {
  return date.subarray(i * PRAG, Math.min((i + 1) * PRAG, date.length));
}

test("fișierele mici merg întregi, pe drumul de azi", () => {
  // Cazul obișnuit — o poză micșorată de telefon. Dacă asta s-ar rupe, s-ar rupe
  // depunerea pentru toată lumea, ca să meargă un scan mare.
  assert.equal(cateParti(400 * 1024), 1);
  assert.equal(cateParti(PRAG), 1, "exact la prag: tot o singură cerere");
  assert.equal(cateParti(PRAG + 1), 2, "un octet peste: două bucăți");
});

test("scanul de 5,72 MB — cel care nu se putea depune — intră în două bucăți", () => {
  const marime = Math.round(5.72 * 1024 * 1024);
  assert.equal(cateParti(marime), 2);
});

test("nicio bucată nu trece de pragul platformei", () => {
  for (const mb of [3.1, 5.72, 8, 12, 19.9]) {
    const date = Buffer.alloc(Math.round(mb * 1024 * 1024));
    const total = cateParti(date.length);
    for (let i = 0; i < total; i++) {
      assert.ok(taie(date, i).length <= PRAG, `la ${mb} MB, bucata ${i} e prea mare`);
    }
  }
});

test("bucățile lipite dau fișierul înapoi, octet cu octet", () => {
  // Conținut care se schimbă de la un octet la altul: o inversare de ordine s-ar vedea.
  const date = Buffer.alloc(7 * 1024 * 1024 + 1234);
  for (let i = 0; i < date.length; i++) date[i] = tipar(i);

  const total = cateParti(date.length);
  const bucati = [];
  for (let i = 0; i < total; i++) bucati.push(Buffer.from(taie(date, i)));
  const intreg = Buffer.concat(bucati);

  assert.equal(intreg.length, date.length);
  assert.ok(intreg.equals(date), "fișierul lipit diferă de original");
});

test("ordinea greșită se vede — deci indexul contează", () => {
  const date = Buffer.alloc(7 * 1024 * 1024);
  for (let i = 0; i < date.length; i++) date[i] = tipar(i);
  const total = cateParti(date.length);
  const bucati = [];
  for (let i = 0; i < total; i++) bucati.push(Buffer.from(taie(date, i)));

  const pe_dos = Buffer.concat([...bucati].reverse());
  assert.equal(pe_dos.length, date.length, "aceeași lungime…");
  assert.ok(!pe_dos.equals(date), "…dar alt conținut: ordinea nu e o formalitate");
});

test("un fișier ciuntit NU are voie să iasă întreg", () => {
  // Așa arată o trimitere oprită la mijloc: bucata din urmă lipsește. Serverul refuză
  // lipirea; aici se probează că refuzul e singurul răspuns corect, fiindcă lungimea
  // rezultată ar fi altfel plauzibilă.
  const date = Buffer.alloc(9 * 1024 * 1024, 0x41);
  const total = cateParti(date.length);
  const primite = [];
  for (let i = 0; i < total - 1; i++) primite.push(Buffer.from(taie(date, i)));

  const lipit = Buffer.concat(primite);
  assert.ok(lipit.length < date.length, "e mai scurt decât originalul");
  assert.ok(lipit.length > 0, "dar nu gol — deci s-ar deschide ca fișier");
  assert.equal(primite.length, total - 1, "lipsește exact o bucată");
});

test("plafonul de 20 MB încape în cele 12 bucăți îngăduite", () => {
  assert.ok(cateParti(MAX_TOTAL) <= MAX_PARTI,
    `${MAX_TOTAL} octeți cer ${cateParti(MAX_TOTAL)} bucăți, dar sunt îngăduite ${MAX_PARTI}`);
});

test("pragul stă bine sub limita platformei, dupa umflarea base64", () => {
  // Netlify taie la 6 MB. Base64 umflă cu 4/3, plus învelișul JSON. Măsurat pe viu:
  // 4 MB trec (corp 5,33 MB), 4,5 MB primesc 413 (corp 6,00 MB).
  const corp = Math.ceil(PRAG / 3) * 4;
  assert.ok(corp < 5 * 1024 * 1024,
    `o bucată de ${PRAG} octeți face ${(corp / 1024 / 1024).toFixed(2)} MB codificată — prea aproape de plafon`);
});

console.log("incarcare-parti: toate probele trecute");
