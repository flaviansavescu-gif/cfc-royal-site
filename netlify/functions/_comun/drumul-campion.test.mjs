// drumul-campion.test.mjs — „Drumul spre Campion" pentru câinii FĂRĂ certificat CFC-Royal
// (15.09.2026). La Iași, 11 din 13 câini cu titluri aveau pedigree COR: palmaresul lor era
// pe site (titluri/<cip>, împins de Manager), dar căutarea se oprea la lipsa certificatului.
// Tot aici: regula cipului la înscriere (15/10 cifre) și listele de sub numele câinelui.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bootstrapMockModule, magazieFalsa, reqJSON, mockBlobs } from "./_harness.mjs";

const CIP_COR = "642090002102490";   // Bruno: titluri la Iași, pedigree COR — fără certificat aici
const CIP_GOL = "642090000000001";   // palmares gol (nu s-a acordat nimic) — rămâne 404

if (!bootstrapMockModule(import.meta.url)) {
  test("drumul spre campion fără certificat — sărită (mock.module indisponibil pe acest Node)", { skip: true }, () => {});
} else {
  const store = magazieFalsa({
    ["titluri/" + CIP_COR]: {
      nume: "BRUNO", actualizat: "2026-09-06T10:00:00Z",
      titluri: [{ titlu: "CAC", expozitie: "C.A.C.I.B. Iași", data: "2026-09-05", arbitru: "X", clasa: "Open" }],
      campionate: [{ cod: "campion_national", eticheta: "Campion Național", indeplinit: false, detaliu: "1× CAC", omologari: [] }],
    },
    ["titluri/" + CIP_GOL]: { nume: "NIMENI", titluri: [], campionate: [] },
  });
  mockBlobs(store);
  const handler = (await import("../registru-pedigree.mjs")).default;

  test("câine cu palmares din Manager, dar fără certificat: 200, titluri + progres, cip mascat, marcat faraPedigree", async () => {
    const res = await handler(reqJSON({ actiune: "caine", cautat: CIP_COR }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.faraPedigree, true);
    assert.equal(body.caine.nume, "BRUNO");
    assert.equal(body.caine.faraPedigree, true);
    assert.ok(!JSON.stringify(body).includes(CIP_COR), "cipul întreg nu iese nici pe calea asta");
    assert.match(String(body.caine.microcip), /2490$/);
    assert.equal(body.titluri.length, 1);
    assert.equal(body.campionate[0].cod, "campion_national");
    assert.ok(!("ascendenta" in body), "fără certificat nu există ascendență de arătat");
  });

  test("cipul se caută și scris cu spații/cratime", async () => {
    const res = await handler(reqJSON({ actiune: "caine", cautat: "642 090-002102490" }));
    assert.equal(res.status, 200);
  });

  test("palmares gol sau cip necunoscut: rămâne 404 (nu inventăm o fișă)", async () => {
    assert.equal((await handler(reqJSON({ actiune: "caine", cautat: CIP_GOL }))).status, 404);
    assert.equal((await handler(reqJSON({ actiune: "caine", cautat: "642090009999999" }))).status, 404);
    assert.equal((await handler(reqJSON({ actiune: "caine", cautat: "CFCR-P-2099-0001" }))).status, 404, "o serie nu e cip — nu se caută în titluri/");
  });
}

test("pagina arată titlurile și progresul SUB numele câinelui și ascunde cererea online fără certificat", () => {
  const c = readFileSync(new URL("../../../src/components/DrumulCampion.astro", import.meta.url), "utf8");
  for (const id of ["dc-lista-titluri", "dc-lista-progres", "dc-lista-titluri-cap", "dc-lista-progres-cap"]) assert.ok(c.includes('id="' + id + '"'), id);
  assert.ok(c.includes("scrieListe(titluri, campionate)"));
  assert.ok(c.includes("omolog.hidden = !!d.faraPedigree"));
  assert.ok(c.includes("faraPedigree:") && c.includes("listaTitluri:") && c.includes("listaProgres:"));
  assert.equal((c.match(/faraPedigree: "/g) || []).length, 2, "textul RO și EN");
});

test("înscrierea la expoziție cere 15 cifre (sau 10), pe server și în formular — nu „minimum 6”", () => {
  const f = readFileSync(new URL("../inscriere-expo.mjs", import.meta.url), "utf8");
  assert.ok(!f.includes("(minimum 6 caractere)."), "vechea regulă „min. 6” nu mai e în cod (doar în comentariul care spune de ce s-a schimbat)");
  assert.ok(f.includes("const cipCurat = normCip(d.microcip)"));
  assert.ok(f.includes("microcip: cipCurat,"));
  assert.ok(/\^\\d\{10\}\$\|\^\\d\{15\}\$/.test(f));
  const c = readFileSync(new URL("../../../src/components/InscriereExpo.astro", import.meta.url), "utf8");
  assert.ok(!c.includes('data-f="microcip" minlength="6"'));
  assert.ok(c.includes('data-f="microcip" inputmode="numeric"'));
  assert.ok(c.includes('val("microcip").replace(/[\\s-]/g, "")'));
  assert.ok(c.includes("txtCipInvalid"));
});
