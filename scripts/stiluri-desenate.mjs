// =========================================================================
// stiluri-desenate.mjs — prinde stilurile scrise degeaba.
//
// DEFECTUL. Astro face `<style>` „scoped": fiecare selector devine
// `.ceva[data-astro-cid-xxxx]`, iar atributul îl pune el, la compilare, pe elementele
// DIN ȘABLON. Elementele făcute din JavaScript (`document.createElement`) nu-l primesc
// niciodată. Deci o clasă care există DOAR în JavaScript are stilul scris frumos în
// fișier și niciun efect pe ecran.
//
// Nimic nu se plânge: nu e eroare de sintaxă, build-ul trece, pagina se încarcă. Se vede
// doar cu ochii, pe pagina aceea, dacă se uită cineva.
//
// S-A ÎNTÂMPLAT. Pe `/registru/registratura/ascendenta/`, toate cele 30 de rânduri ale
// ascendenței — adică munca grea a registraturii — se desenau fără grilă, fără marcajul
// verde al pozițiilor complete, fără așezarea pentru telefon. Stilurile erau scrise, cu
// mediaquery cu tot.
//
// CE CERE PROBA. Dacă o clasă e stilizată într-un `<style>` scoped și NU apare nicăieri
// în șablonul paginii, atunci pagina trebuie să facă unul din două lucruri:
//   · să scrie selectorul cu `:global(...)`, sau
//   · să pună singură atributul pe elementele desenate (tiparul `creeaza(...)`).
// Altfel, stilul e o intenție, nu un efect.
//
// DE CE NU E ÎNCĂ ÎN LISTA PROBELOR (adică `*.test.mjs`). Fiindcă azi CADE: 21 de pagini sunt în situația
// asta, dintre care cele mai multe scrise înainte să știm de capcană. Pusă în lista
// probelor, ar opri build-ul și publicarea site-ului pentru un defect vechi, ales de
// nimeni. Se rulează deocamdată cu mâna:
//
//     node scripts/stiluri-desenate.mjs
//
// Când paginile sunt îndreptate, se redenumește în `stiluri-desenate.test.mjs` și de
// atunci încolo apără singură — o probă care trece azi și cade la următoarea scăpare.
// =========================================================================
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RADACINA = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(RADACINA, "src");

function paginile(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...paginile(p));
    else if (n.endsWith(".astro")) out.push(p);
  }
  return out;
}

/** Blocurile `<style>` care NU sunt `is:global`. */
function stiluriScoped(sursa) {
  const out = [];
  const re = /<style(\s[^>]*)?>([\s\S]*?)<\/style>/g;
  let m;
  while ((m = re.exec(sursa))) {
    if (m[1] && /\bis:global\b/.test(m[1])) continue;
    out.push(m[2]);
  }
  return out;
}

/**
 * Clasele stilizate de reguli care NU sunt ancorate în `:global(...)`.
 *
 * O regulă care conține `:global` undeva în selector se sare întreagă. Altfel,
 * `:global(.co-nod).is-a` ar fi arătat ca o problemă la `.is-a`, deși e tocmai leacul.
 * Prima versiune a probei făcea exact greșeala asta, în patru locuri.
 */
function claseStilizate(css) {
  const out = new Set();
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const selector = m[1];
    if (selector.includes(":global")) continue;
    if (selector.trim().startsWith("@")) continue;            // @media & co. — se uită înăuntru la pasul următor
    for (const c of selector.matchAll(/\.([A-Za-z_][\w-]*)/g)) out.add(c[1]);
  }
  return out;
}

/**
 * Numele funcțiilor care FAC elemente în pagina asta, și clasele date lor la facere.
 *
 * Doar astea contează. O clasă pusă cu `classList.add` pe un element din șablon e în
 * regulă: elementul acela are deja atributul de la Astro. Fără deosebirea asta, proba
 * arăta cu degetul spre 30 de pagini, dintre care cele mai multe erau sănătoase — iar o
 * probă care strigă degeaba se oprește, și atunci nu mai apără nimic.
 */
function claseDesenate(sursa) {
  const creatori = new Set();
  for (const m of sursa.matchAll(/(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)\s*(?:=\s*)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*)\{([\s\S]{0,400}?)\}/g)) {
    if (/createElement/.test(m[2])) creatori.add(m[1]);
  }
  const out = new Set();
  for (const nume of creatori) {
    // Al doilea argument, când e șir: tiparul `el("div", "p-poz")` din tot proiectul.
    const re = new RegExp("\\b" + nume + "\\s*\\(\\s*[\"'`][^\"'`]*[\"'`]\\s*,\\s*[\"'`]([^\"'`]+)[\"'`]", "g");
    for (const m of sursa.matchAll(re)) for (const c of m[1].split(/\s+/)) if (c) out.add(c);
  }
  // Și `x.className = "..."` unde x tocmai a ieșit din createElement.
  for (const m of sursa.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:document\.)?createElement\([\s\S]{0,600}?\1\.className\s*=\s*["'`]([^"'`]+)["'`]/g)) {
    for (const c of m[2].split(/\s+/)) if (c) out.add(c);
  }
  return out;
}

const cazuri = [];
for (const cale of paginile(SRC)) {
  const sursa = readFileSync(cale, "utf8");
  const blocuri = stiluriScoped(sursa);
  if (!blocuri.length) continue;

  // Pagina se apără singură, punând ea atributul pe ce desenează?
  const seApara = /data-astro-cid-/.test(sursa.replace(/<style[\s\S]*?<\/style>/g, " "));
  if (seApara) continue;

  const desenate = claseDesenate(sursa);
  if (!desenate.size) continue;

  // A treia condiție, la fel de necesară ca celelalte două: clasa să NU apară în șablon.
  // Dacă apare și acolo, Astro pune atributul măcar pe acele elemente, deci regula are
  // efect — poate nu peste tot, dar pagina nu e „nestilizată", și nu asta căutăm aici.
  const sabl = sursa
    .replace(/^---[\s\S]*?^---/m, " ")
    .replace(/<style(\s[^>]*)?>[\s\S]*?<\/style>/g, " ")
    .replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>/g, " ");

  for (const css of blocuri) {
    for (const cls of claseStilizate(css)) {
      if (!desenate.has(cls)) continue;
      if (new RegExp("\\b" + cls.replace(/-/g, "\\-") + "\\b").test(sabl)) continue;
      cazuri.push({ pagina: relative(RADACINA, cale), clasa: cls });
    }
  }
}

if (cazuri.length) {
  console.error("\n  STILURI CARE NU SE APLICĂ — clase stilizate în <style> scoped, dar create din JavaScript:\n");
  const pePagina = new Map();
  for (const c of cazuri) {
    if (!pePagina.has(c.pagina)) pePagina.set(c.pagina, []);
    pePagina.get(c.pagina).push(c.clasa);
  }
  for (const [p, cls] of pePagina) {
    console.error(`  ${p}`);
    console.error(`      ${[...new Set(cls)].join(", ")}`);
  }
  console.error("\n  Leacul: ori scrii selectorii cu :global(...), ori pui atributul data-astro-cid-…");
  console.error("  pe elementele desenate (vezi tiparul `creeaza()` din registru/registratura/ascendenta.astro).\n");
  process.exit(1);
}

console.log("stiluri-desenate: toate paginile care desenează din JavaScript își stilizează elementele");
