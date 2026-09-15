// strategie-primii-pasi.test.mjs — primele reparații din Strategia ROYAL 2026–2027 (15.09.2026),
// ținute lipite de cod: calendarul 2026 ca TABEL (nu doar imagine), arbitrii pe fișa
// expoziției, contorul public de înscrieri, câmpurile „de unde ai aflat de noi" /
// „recomandat de" la adeziune, programul realist și termenul de răspuns la contact.
//   node --test netlify/functions/_comun/strategie-primii-pasi.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const f = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const inscriere = f("../inscriere-expo.mjs");
const adeziuneFn = f("../adeziune.mjs");
const adeziuneForm = f("../../../src/pages/ro/adeziune.astro");
const registratura = f("../../../src/pages/registru/registratura/index.astro");
const site = f("../../../src/data/site.ts");
const ui = f("../../../src/i18n/ui.ts");
const calRo = f("../../../src/content/pagini/ro/calendar-expozitional.md");
const calEn = f("../../../src/content/pagini/en/calendar-expozitional.md");
const slugRo = f("../../../src/pages/ro/[collection]/[slug].astro");
const slugEn = f("../../../src/pages/en/[collection]/[slug].astro");
const contor = f("../../../src/components/ContorInscrieri.astro");

test("calendarul 2026 e și tabel, RO și EN, cu toate cele 8 evenimente și legături spre fișe", () => {
  for (const [cal, limba] of [[calRo, "ro"], [calEn, "en"]]) {
    const randuri = cal.split("\n").filter((l) => /^\| [1-8] \|/.test(l));
    assert.equal(randuri.length, 8, `${limba}: 8 rânduri în tabel`);
    for (const r of randuri) assert.match(r, new RegExp(`\\]\\(/${limba}/expozitii/[a-z0-9-]+/\\)`), `${limba}: fiecare rând trimite la fișa expoziției`);
    assert.ok(cal.includes("calendar-expozitional-2026.webp"), `${limba}: imaginea rămâne`);
  }
  assert.ok(calRo.includes("Cupa Bucegi") && calRo.includes("31 octombrie 2026"));
});

test("fișa expoziției arată arbitrii anunțați și contorul de înscrieri (RO și EN)", () => {
  for (const s of [slugRo, slugEn]) {
    assert.ok(s.includes('import ContorInscrieri from "../../../components/ContorInscrieri.astro"'));
    assert.ok(s.includes('getCollection("arbitri" as any'), "arbitrii se iau din Colegiu, după referință");
    assert.ok(s.includes('label: lang === "en" ? "Judges" : "Arbitri"'));
    assert.ok(s.includes('d.status !== "încheiată" ? String(d.managerShowId) : null'), "contorul doar cât expoziția nu s-a încheiat");
    assert.ok(s.includes("{contorShowId && <ContorInscrieri showId={contorShowId} lang={lang} />}"));
  }
});

test("contorul: cifre fără date personale, prag de afișare, cache de 60 s pe server", () => {
  assert.ok(inscriere.includes('searchParams.get("contor")'), "GET ?contor=<showId>");
  assert.ok(inscriere.includes("const CONTOR_CACHE = new Map()"));
  assert.match(inscriere, /const valoare = \{ caini, rase: rase\.size \};/);
  assert.ok(!/contor[\s\S]{0,900}(email|telefon|numeProprietar)/.test(inscriere.slice(inscriere.indexOf('searchParams.get("contor")'), inscriere.indexOf('searchParams.get("contor")') + 1200)), "ramura de contor nu atinge date personale");
  assert.ok(contor.includes('"/.netlify/functions/inscriere-expo?contor="'));
  assert.ok(contor.includes("if (caini < Number(el.dataset.prag || 10)) return;"), "sub prag nu se afișează");
});

test("adeziune: „de unde ai aflat de noi” (valori închise) și „recomandat de”, stocate și arătate registraturii", () => {
  assert.ok(adeziuneForm.includes('<select id="ad-sursa">') && adeziuneForm.includes('<input id="ad-recomandat"'));
  assert.ok(adeziuneForm.includes('sursa: $("ad-sursa").value,') && adeziuneForm.includes('recomandatDe: $("ad-recomandat").value.trim(),'));
  assert.ok(adeziuneFn.includes("export const ETICHETA_SURSA"));
  assert.ok(adeziuneFn.includes('sursa: SURSE.has(String(body.sursa || "")) ? String(body.sursa) : ""'), "valoare necunoscută → gol, nu text liber");
  assert.ok(adeziuneFn.includes('sursa: c.sursa || "", recomandatDe: c.recomandatDe || ""'), "lista le întoarce");
  assert.ok(registratura.includes("recomandat de"), "registratura le arată");
  // Opțiunile formularului = cheile din funcție.
  const chei = [...adeziuneFn.matchAll(/^\s{2}([a-z]+): "/gm)].map((m) => m[1]);
  for (const k of chei) assert.ok(adeziuneForm.includes(`<option value="${k}">`), `opțiunea „${k}” există în formular`);
});

test("contact: program realist (fără weekend) și termen de răspuns de 2 zile lucrătoare", () => {
  assert.ok(!/Sâmbătă–Duminică/.test(site) && !/Saturday–Sunday/.test(site));
  assert.ok(site.includes("Răspundem în cel mult 2 zile lucrătoare") && site.includes("We reply within 2 working days"));
  assert.ok(ui.includes("Răspundem în cel mult 2 zile lucrătoare; cererile de adeziune se verifică în cel mult 15 zile."));
  assert.ok(ui.includes("We reply within 2 working days; membership applications are reviewed within 15 days."));
});
