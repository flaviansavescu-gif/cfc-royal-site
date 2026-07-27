// verifica-scripturi.mjs — verifică sintaxa scripturilor din paginile Astro.
//
// DE CE EXISTĂ: un `<script is:inline>` cu o greșeală de sintaxă nu oprește build-ul
// și nu apare în consolă ca eroare de rețea — pagina se încarcă, arată corect, dar
// nimic nu funcționează. S-a întâmplat de două ori din același motiv: ghilimelele
// românești („…") într-un șir JS scris cu ghilimele drepte închid șirul mai devreme.
//
// Rulează: node scripts/verifica-scripturi.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, nu `.pathname`: calea proiectului conține diacritice și spații, care
// într-un URL apar procentate (Asocia%C8%9Bia) și nu mai există pe disc.
const RADACINA = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

function fisiere(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...fisiere(p));
    else if (n.endsWith(".astro")) out.push(p);
  }
  return out;
}

/** Scoate blocurile <script …>…</script> cu poziția lor, ca să putem raporta linia. */
function scripturi(sursa) {
  const out = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(sursa))) {
    out.push({
      atribute: m[1],
      cod: m[2],
      linie: sursa.slice(0, m.index).split("\n").length,
    });
  }
  return out;
}

let verificate = 0, sarite = 0;
const probleme = [];

for (const f of fisiere(RADACINA)) {
  const sursa = readFileSync(f, "utf8");
  for (const s of scripturi(sursa)) {
    // `define:vars` injectează valori din server: blocul nu e JS de sine stătător.
    // La fel scripturile de tip JSON-LD, care nu sunt cod.
    if (s.atribute.includes("define:vars") || /type=["']application\/(ld\+json|json)["']/.test(s.atribute)) {
      sarite++;
      continue;
    }
    if (!s.cod.trim()) continue;
    verificate++;
    try {
      new Function(s.cod);
    } catch (err) {
      probleme.push({ fisier: relative(RADACINA, f), linie: s.linie, mesaj: err.message });
    }
  }
}

for (const p of probleme) console.log(`  ROU  ${p.fisier}:${p.linie} — ${p.mesaj}`);
console.log(
  `${verificate} scripturi verificate, ${sarite} sărite (define:vars / JSON), ` +
  `${probleme.length} cu erori de sintaxă`
);
process.exit(probleme.length ? 1 : 0);
