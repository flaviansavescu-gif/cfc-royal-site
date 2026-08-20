// persoane.test.mjs — proba de consistență a registrului de persoane.
//
// Durerea pe care o păzește: pe 20.08.2026, scoaterea unui lector a cerut CINCI
// edituri manuale în cinci fișiere. De acum, sursa e una (persoane.mjs), iar proba
// aceasta verifică la FIECARE build că serverul de roluri, materialele platformei
// și paginile publice spun exact același lucru. O nepotrivire oprește publicarea.
//   node --test src/data/persoane.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LECTORI_PERSOANE, grupeText, rolLector } from "./persoane.mjs";
import { LECTORI, AMPRENTE_ORFANE } from "../../netlify/functions/_comun/roluri.mjs";

const RADACINA = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const citeste = (cale) => readFileSync(join(RADACINA, cale), "utf8");

test("sursa: slug-uri unice, nume nevide, grupe valide", () => {
  const sluguri = LECTORI_PERSOANE.map((p) => p.slug);
  assert.equal(new Set(sluguri).size, sluguri.length, "slug dublat în persoane.mjs");
  for (const p of LECTORI_PERSOANE) {
    assert.ok(p.nume && p.nume.trim().length >= 5, `nume lipsă la ${p.slug}`);
    assert.ok(
      p.grupe === "all" || (Array.isArray(p.grupe) && p.grupe.length && p.grupe.every((g) => g >= 1 && g <= 10)),
      `grupe invalide la ${p.slug}`,
    );
  }
});

test("serverul de roluri acoperă exact persoanele (nici orfani, nici lipsuri)", () => {
  assert.deepEqual(AMPRENTE_ORFANE, [], "amprente fără persoană în roluri.mjs — șterge-le sau adaugă persoana");
  assert.equal(LECTORI.length, LECTORI_PERSOANE.length, "persoană fără amprentă în roluri.mjs — lectorul nu ar putea intra");
  for (const p of LECTORI_PERSOANE) {
    const l = LECTORI.find((x) => x.slug === p.slug);
    assert.ok(l, `lipsește ${p.slug} din serverul de roluri`);
    assert.equal(l.nume, p.nume);
    assert.deepEqual(l.grupe, p.grupe);
  }
});

test("materialele din cursuri.ts sunt doar pentru lectori existenți", () => {
  const sursa = citeste("src/data/cursuri.ts");
  const chei = [...sursa.matchAll(/^  "([a-z-]+)": \[/gm)].map((m) => m[1]);
  assert.ok(chei.length >= 1, "nu am găsit cheile MATERIALE_LECTORI — s-a schimbat forma fișierului?");
  for (const slug of chei) {
    assert.ok(LECTORI_PERSOANE.some((p) => p.slug === slug),
      `materiale pentru „${slug}", care nu mai e lector — mută-le sau șterge-le`);
  }
});

test("fiecare lector are pagină de arbitru (RO + EN) cu numele scris identic", () => {
  for (const p of LECTORI_PERSOANE) {
    for (const lang of ["ro", "en"]) {
      const cale = `src/content/arbitri/${lang}/${p.slug}.md`;
      let sursa;
      try { sursa = citeste(cale); } catch { assert.fail(`lipsește ${cale}`); }
      const titlu = sursa.match(/^title:\s*"([^"]+)"/m)?.[1];
      assert.equal(titlu, p.nume, `numele din ${cale} diferă de sursa unică`);
    }
  }
});

test("secțiunea Lectori a paginii Centrului (RO + EN) = exact lectorii din sursă", () => {
  for (const lang of ["ro", "en"]) {
    const sursa = citeste(`src/content/pagini/${lang}/educatie/centrul-competentelor-chinologice.md`);
    const sectiune = sursa.split(/^### /m).find((s) => s.startsWith("Lectori") || s.startsWith("Lecturers"));
    assert.ok(sectiune, `nu găsesc secțiunea Lectori în pagina ${lang}`);
    const nume = [...sectiune.matchAll(/color:var\(--color-primary\)">([^<]+)<\/strong>/g)].map((m) => m[1]);
    assert.deepEqual(
      [...nume].sort(),
      LECTORI_PERSOANE.map((p) => p.nume).sort(),
      `cartonașele din pagina Centrului (${lang}) nu se potrivesc cu sursa unică`,
    );
  }
});

test("textele derivate se generează corect", () => {
  assert.equal(grupeText("all"), "All Breed");
  assert.equal(grupeText([3, 5, 9]), "Grupele 3, 5, 9");
  const flavian = LECTORI_PERSOANE.find((p) => p.slug === "flavian-savescu");
  assert.equal(rolLector(flavian), "Președinte al Colegiului de Arbitri · WDF All Breed");
  const andreea = LECTORI_PERSOANE.find((p) => p.slug === "andreea-daniela-popescu");
  assert.equal(rolLector(andreea), "Arbitru WDF · Grupele 3, 5, 9");
});
