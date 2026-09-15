// strategie-pagini-claritate.test.mjs — paginile de claritate din Strategia ROYAL 2026–2027
// (15.09.2026): „Ce suntem", „Întrebări frecvente + glosar", „Certificatele de origine (A/B/C)",
// „Creștere și sănătate, pe scurt" — în RO și EN, legate în meniu, iar mențiunea „nu atestă
// originea" stă PE certificatul de tip C, nu doar pe site.
//   node --test netlify/functions/_comun/strategie-pagini-claritate.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const f = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const pag = (lang, slug) => f(`../../../src/content/pagini/${lang}/${slug}.md`);
const nav = f("../../../src/data/nav.ts");
const pedigree = f("../../../src/pages/registru/pedigree.astro");

test("cele patru pagini există în RO și EN, cu frontmatter complet", () => {
  for (const slug of ["organizatia/ce-suntem", "intrebari-frecvente", "certificatele-de-origine", "crestere-si-sanatate-pe-scurt"]) {
    for (const lang of ["ro", "en"]) {
      const p = pag(lang, slug);
      assert.match(p, /^---\ntitle: ".+"\nlang: (ro|en)\nsection: ".+"\nsummary: ".+"\n---/, `${lang}/${slug}: frontmatter`);
      assert.ok(!/\bFCI\b[^.]*\b(minciun|dușman|monopol)/i.test(p), `${lang}/${slug}: fără ton comparativ`);
    }
  }
});

test("FAQ: 15 întrebări numerotate și glosarul cu termenii ceruți", () => {
  for (const lang of ["ro", "en"]) {
    const p = pag(lang, "intrebari-frecvente");
    const intrebari = p.match(/^### \d+\. /gm) || [];
    assert.equal(intrebari.length, 15, `${lang}: 15 întrebări`);
    for (const t of ["CAJC", "CAC", "CACIB", "BOB", "BIS", lang === "en" ? "Affix" : "Afix", "WDF", "FCI", "DMF"]) assert.ok(p.includes(`**${t}`), `${lang}: glosarul are ${t}`);
    assert.ok(/\*\*Tip A \/ Tip B \/ Tip C\*\*|\*\*Type A \/ Type B \/ Type C\*\*/.test(p), `${lang}: glosarul are tipurile A/B/C`);
  }
});

test("certificatele A/B/C: tabelul, limitele tipului C și mențiunea „nu atestă originea”", () => {
  const ro = pag("ro", "certificatele-de-origine");
  assert.ok(ro.includes("| **A** |") && ro.includes("| **B** |") && ro.includes("| **C** |"));
  assert.ok(ro.includes("**Nu atestă originea.**"));
  assert.ok(ro.includes("**Nu poartă istoric de sănătate.**"));
  assert.ok(ro.includes("**80 lei**") && ro.includes("**50 lei**"), "tarifele din tarife.ts");
  const en = pag("en", "certificatele-de-origine");
  assert.ok(en.includes("**It does not attest origin.**"));
});

test("mențiunea stă pe certificatul de tip C (șablonul din registru) și la verificarea publică", () => {
  assert.ok(pedigree.includes("Certificat de Tip C — NU ATESTĂ ORIGINEA."));
  assert.ok(pedigree.includes('(c.tip === "C" ? " · nu atestă originea" : "")'));
  const verificare = f("../../../src/components/VerificaPedigree.astro");
  assert.ok(verificare.includes("NU ATESTĂ ORIGINEA") && verificare.includes("DOES NOT ATTEST ORIGIN"));
  assert.ok(verificare.includes('c.tip === "C" ? T.tipC : T.tipB'));
});

test("creștere și sănătate: cifrele din regulament și tabelul pe cele 10 grupe", () => {
  const ro = pag("ro", "crestere-si-sanatate-pe-scurt");
  for (const s of ["**18 luni**", "**8 ani**", "**12 luni**", "**10 luni**", "**3 cuiburi în 24 de luni**", "**două ori prin operație cezariană**", "**8 săptămâni**"]) assert.ok(ro.includes(s), `cifra ${s}`);
  assert.equal((ro.match(/^\| (10|[1-9]) — /gm) || []).length, 10, "10 grupe WDF în tabel");
  assert.ok(ro.includes("niciuna stabilită încă"), "fără teste obligatorii inventate");
  assert.ok(ro.includes("181/13-08-2026"));
});

test("meniul le leagă: FAQ sub Organizația, certificatele și creșterea sub Chinologie", () => {
  assert.ok(nav.includes('slug: "intrebari-frecvente"'));
  assert.ok(nav.includes('slug: "certificatele-de-origine"'));
  assert.ok(nav.includes('slug: "crestere-si-sanatate-pe-scurt"'));
  assert.ok(nav.indexOf('slug: "organizatia/ce-suntem"') < nav.indexOf('slug: "intrebari-frecvente"'));
});
