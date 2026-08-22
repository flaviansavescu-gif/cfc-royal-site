// scripturi-inline.test.mjs — niciun script inline stricat nu mai ajunge pe site.
//
// LECȚIA (22.08.2026): pagina de certificare a Școlii a stat MOARTĂ din 26 iulie —
// două declarații `dataRo` în același domeniu = SyntaxError la parsare = niciun rând
// de script nu se mai executa, iar pagina rămânea veșnic pe „Se încarcă…". Nicio probă
// n-o prindea: probele testează funcțiile, nu paginile. De-acum, fiecare bloc
// `<script is:inline>` din src/ se parsează la build; unul stricat oprește publicarea.
//
// Doar blocurile `is:inline` (JavaScript curat, livrat ca atare). Scripturile procesate
// de Vite (importuri, TS) au propria verificare la build-ul Astro.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RADACINA = fileURLToPath(new URL("..", import.meta.url));
const LOCURI = ["src/pages", "src/components", "src/layouts"];

function astroDin(dir) {
  const out = [];
  for (const nume of readdirSync(dir)) {
    const cale = join(dir, nume);
    if (statSync(cale).isDirectory()) out.push(...astroDin(cale));
    else if (nume.endsWith(".astro")) out.push(cale);
  }
  return out;
}

let fisiere = 0, blocuri = 0;
const stricate = [];
for (const loc of LOCURI) {
  for (const cale of astroDin(join(RADACINA, loc))) {
    const sursa = readFileSync(cale, "utf8");
    const potriviri = [...sursa.matchAll(/<script[^>]*\bis:inline\b[^>]*>([\s\S]*?)<\/script>/g)];
    if (!potriviri.length) continue;
    fisiere++;
    for (const m of potriviri) {
      blocuri++;
      try {
        new Function(m[1]);   // doar parsare — nu se execută nimic
      } catch (e) {
        stricate.push(cale.slice(RADACINA.length) + " -> " + e.message);
      }
    }
  }
}

if (stricate.length) {
  console.error("SCRIPTURI INLINE STRICATE (pagina ar fi moartă în producție):");
  for (const s of stricate) console.error("  RAU " + s);
  process.exit(1);
}
console.log(`ok: ${blocuri} scripturi inline din ${fisiere} pagini se parsează curat`);
