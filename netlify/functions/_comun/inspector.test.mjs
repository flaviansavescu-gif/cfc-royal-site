// inspector.test.mjs — Inspectorul mecanismelor esențiale (15.09.2026): judecata pură pe
// fapte construite + regulile de trimitere + neîncălecarea cu paznicii de la minut.
//   node --test netlify/functions/_comun/inspector.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  judecaDns, judecaCredite, judecaCopii, judecaInscrieri, judecaExpozitii, expozitiiInAjun,
  judecaDmf, judecaTeste, judecaSesiuni, judecaCertificari, trebuieTrimis, compuneRaport,
  ZILE_NEMARCATA, ZILE_NEIMPORTATA, ZILE_COPIE, PRAG_CREDITE,
} from "./inspector-logica.mjs";
import { INIMI } from "./inima.mjs";

const ZI = 86400000;
const ACUM = Date.parse("2026-09-15T05:00:00Z");
const cuZile = (n) => new Date(ACUM - n * ZI).toISOString();

test("DNS: SPF cu Brevo, DKIM brevo1+brevo2, DMARC — toate, altfel spune ce lipsește", () => {
  const bun = judecaDns({ spf: ["v=spf1 include:zohomail.eu include:spf.brevo.com ~all"], dmarc: ["v=DMARC1; p=none"], cname: { brevo1: "b1.cfc-royal-ro.dkim.brevo.com", brevo2: "b2.cfc-royal-ro.dkim.brevo.com" } });
  assert.equal(bun.ok, true); assert.equal(bun.nivel, "critic");
  const rau = judecaDns({ spf: ["v=spf1 include:zohomail.eu ~all"], dmarc: [], cname: { brevo1: "", brevo2: "" } });
  assert.equal(rau.ok, false);
  assert.match(rau.detaliu, /SPF fără include:spf\.brevo\.com; DKIM brevo1\/brevo2 lipsă; DMARC lipsă/);
});

test("creditele Brevo: doar cota (cheia o verifică monitor-flux); sub prag = critic picat", () => {
  assert.equal(judecaCredite({ ok: true, detaliu: "cheia e validă · credite rămase: 300" }).ok, true);
  const putine = judecaCredite({ ok: true, detaliu: "cheia e validă · credite rămase: 40" });
  assert.equal(putine.ok, false); assert.match(putine.detaliu, new RegExp(`sub pragul de ${PRAG_CREDITE}`));
  assert.equal(judecaCredite(null).ok, true, "necunoscut nu e alarmă — monitor-flux raportează cheia");
});

test("copiile magaziilor: registrul e SĂRIT (îl păzește monitor-flux); o magazie veche pică", () => {
  const ok = judecaCopii(["registru-2026-08-01.zip.enc", "cursuri-2026-09-13.zip.enc", "expozitii-2026-09-13.zip.enc"], ACUM);
  assert.equal(ok.ok, true, "registrul vechi nu contează aici");
  assert.ok(!ok.detaliu.includes("registru"));
  const rau = judecaCopii(["cursuri-2026-09-13.zip.enc", `expozitii-${cuZile(ZILE_COPIE + 2).slice(0, 10)}.zip.enc`], ACUM);
  assert.equal(rau.ok, false); assert.match(rau.detaliu, /vechi: expozitii/);
  assert.equal(judecaCopii([], ACUM).ok, false);
});

test("înscrierile din coadă: nemarcate peste 3 zile, neimportate peste 5 zile", () => {
  const coada = [
    { showId: "s", cheie: "coada/s/a", creat: cuZile(1), importat: false },
    { showId: "s", cheie: "coada/s/b", creat: cuZile(ZILE_NEMARCATA + 1), importat: true },
    { showId: "s", cheie: "coada/s/c", creat: cuZile(ZILE_NEIMPORTATA + 1), importat: false },
  ];
  const r = judecaInscrieri(coada, new Set(["coada/s/a", "coada/s/c"]), ACUM);
  assert.equal(r.ok, false);
  assert.match(r.detaliu, /1 nemarcate de registratură/);
  assert.match(r.detaliu, /1 neimportate în Manager/);
  assert.equal(judecaInscrieri(coada.slice(0, 1), new Set(), ACUM).ok, true);
});

test("expozițiile publicate: fără arbitri / tarif / rase / cont; data trecută; repetiția nu contează", () => {
  const cfg = [
    { showId: "1", nume: "Bună", deschis: true, data: cuZile(-20), rase: [{}], tarif: {}, arbitri: ["X"], organizator: { iban: "RO" } },
    { showId: "2", nume: "Goală", deschis: true, data: cuZile(-20), rase: [], arbitri: [], organizator: null },
    { showId: "3", nume: "Repetiție", deschis: true, repetitie: true, data: cuZile(-20), rase: [], arbitri: [] },
    { showId: "4", nume: "Trecută", deschis: true, data: cuZile(5), rase: [{}], tarif: {}, arbitri: ["X"], organizator: { iban: "RO" } },
  ];
  const r = judecaExpozitii(cfg, ACUM);
  assert.equal(r.ok, false);
  assert.match(r.detaliu, /Goală: fără rase, fără tarif, fără arbitri anunțați, fără cont de plată/);
  assert.match(r.detaliu, /Trecută: data a trecut/);
  assert.ok(!r.detaliu.includes("Repetiție"));
});

test("ajunul: expozițiile din următoarele 3 zile (nu repetițiile, nu cele trecute)", () => {
  const cfg = [
    { showId: "a", nume: "Mâine", data: cuZile(-1) }, { showId: "b", nume: "Peste 10", data: cuZile(-10) },
    { showId: "c", nume: "Ieri", data: cuZile(2) }, { showId: "d", nume: "Rep", data: cuZile(-1), repetitie: true },
  ];
  assert.deepEqual(expozitiiInAjun(cfg, ACUM).map((c) => c.showId), ["a"]);
});

test("DMF neconfirmate peste 14 zile; teste neverificate peste 14 zile; sesiuni; certificări nepublicate", () => {
  assert.equal(judecaDmf([{ id: "d1", confirmare: { stare: "asteptare", trimisLa: cuZile(20) } }], ACUM).ok, false);
  assert.equal(judecaDmf([{ id: "d2", confirmare: { stare: "confirmat", trimisLa: cuZile(20) } }, { id: "d3", confirmare: { stare: "asteptare", trimisLa: cuZile(3) } }], ACUM).ok, true);
  assert.equal(judecaTeste({ "642": { teste: [{ stare: "depus", depusLa: cuZile(20) }] } }, ACUM).ok, false);
  assert.equal(judecaTeste({ "642": { teste: [{ stare: "verificat", depusLa: cuZile(20) }, { stare: "depus", depusLa: cuZile(2) }] } }, ACUM).ok, true);
  assert.equal(judecaSesiuni([], ACUM).ok, false);
  assert.equal(judecaSesiuni([{ nume: "Toamnă", start: "2026-11-10", sfarsit: "2026-11-12" }], ACUM).ok, true);
  assert.equal(judecaSesiuni([{ nume: "Vara trecută", start: "2026-06-01", sfarsit: "2026-06-03" }], ACUM).ok, false);
  assert.equal(judecaCertificari({ "autorizare/a": { grupe: [1, 2], public: false } }).ok, false);
  assert.equal(judecaCertificari({ "autorizare/a": { grupe: [1, 2], public: true }, "autorizare/b": { grupe: [], public: false } }).ok, true);
});

test("trimiterea: lunea mereu; altfel doar când criticele se schimbă, se rezolvă sau e ajun nou", () => {
  const c = (ok) => ({ nume: "DNS", nivel: "critic", ok, detaliu: "" });
  assert.equal(trebuieTrimis({ luni: true, verificari: [c(true)], ultimaTrimitere: null, ajunNoi: [] }).trimite, true);
  assert.equal(trebuieTrimis({ luni: false, verificari: [c(true)], ultimaTrimitere: null, ajunNoi: [] }).trimite, false);
  assert.equal(trebuieTrimis({ luni: false, verificari: [c(false)], ultimaTrimitere: null, ajunNoi: [] }).trimite, true);
  assert.equal(trebuieTrimis({ luni: false, verificari: [c(false)], ultimaTrimitere: { criticePicate: ["DNS"] }, ajunNoi: [] }).trimite, false, "aceeași veste nu se repetă zilnic");
  assert.equal(trebuieTrimis({ luni: false, verificari: [c(true)], ultimaTrimitere: { criticePicate: ["DNS"] }, ajunNoi: [] }).trimite, true, "revenirea se anunță");
  assert.equal(trebuieTrimis({ luni: false, verificari: [c(true)], ultimaTrimitere: { criticePicate: [] }, ajunNoi: [{ nume: "X" }] }).trimite, true);
});

test("raportul: ajunul cere pornirea Managerului; prima luni amintește repetiția; criticele sus", () => {
  const r = compuneRaport({ verificari: [{ nume: "A", nivel: "critic", ok: false, detaliu: "x" }, { nume: "B", nivel: "important", ok: true, detaliu: "y" }], ajun: [{ nume: "Cupa", data: "2026-10-03" }], luni: true, primaLuni: true, la: "azi" });
  assert.match(r.subiect, /1 de rezolvat/);
  assert.ok(r.html.includes("Pornește Managerul de expoziții pe laptop") && r.html.includes("Ajunul expoziției"));
  assert.ok(r.html.includes("repetiția generală"));
  assert.ok(r.html.indexOf("Critice") < r.html.indexOf("Importante"));
  assert.ok(r.html.includes("verifică DOAR ce nu verifică paznicii"));
});

test("nu se încalecă cu paznicii: inspectorul nu verifică pagini, inimi, cheia poștei sau copia registrului", () => {
  const f = readFileSync(new URL("../inspector.mjs", import.meta.url), "utf8");
  assert.ok(!f.includes("citesteInimile") && !f.includes("judecaInimi") && !f.includes("judecaPagini") && !f.includes("judecaPosta"));
  assert.ok(f.includes("judecaCredite(d.posta)"), "doar creditele, din ce a scris monitor-flux");
  assert.ok(!/cfc-royal\.ro\/(ro|registru-public|verifica-pedigree|cursuri)/.test(f), "nicio pagină cerută");
  assert.ok(f.includes('await bateInima("inspector")') && INIMI.inspector, "dar el însuși e păzit de paznicul inimilor");
  assert.ok(f.includes('schedule: "0 5 * * *"'));
  assert.ok(f.includes("if (plecat)"), "starea ultimei trimiteri se scrie doar dacă poșta a plecat");
});
