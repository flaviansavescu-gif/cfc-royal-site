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
import { execFileSync } from "node:child_process";

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
    // Verificăm DOAR scripturile `is:inline`: pe acelea Astro le trimite în pagină
    // exact cum sunt scrise, deci o greșeală de sintaxă ajunge la om. Restul trec prin
    // Vite, care le compilează (și se plânge singur), și pot conține `import`/`export`
    // — sintaxă de modul, pe care `new Function` o respinge pe drept.
    if (!s.atribute.includes("is:inline")) { sarite++; continue; }
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

// —— Modulele .mjs: funcțiile Netlify și uneltele din scripts/ ——
//
// Aceeași greșeală a apărut și acolo, într-un loc mult mai rău: în unealta care
// DESCIFREAZĂ copiile de siguranță. Ar fi ieșit la iveală exact în ziua în care omul
// avea nevoie de ea. Verificarea de aici nu execută nimic — doar cere lui Node să
// analizeze fișierul (`--check`), ceea ce prinde erorile de sintaxă fără efecte.
const PROIECT = join(dirname(fileURLToPath(import.meta.url)), "..");
let module = 0;
function moduleDin(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n.startsWith(".")) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...moduleDin(p));
    else if (n.endsWith(".mjs")) out.push(p);
  }
  return out;
}
for (const dir of ["netlify/functions", "scripts"]) {
  let lista = [];
  try { lista = moduleDin(join(PROIECT, dir)); } catch { continue; }
  for (const f of lista) {
    module++;
    try {
      execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
    } catch (err) {
      const mesaj = String(err.stderr || err.message).split("\n").find((l) => l.includes("Error")) || "eroare de sintaxă";
      probleme.push({ fisier: relative(PROIECT, f), linie: "—", mesaj: mesaj.trim() });
    }
  }
}

for (const p of probleme) console.log(`  ROU  ${p.fisier}:${p.linie} — ${p.mesaj}`);
console.log(
  `${verificate} scripturi is:inline + ${module} module .mjs verificate, ` +
  `${sarite} sărite (module Astro, define:vars, JSON), ${probleme.length} cu erori de sintaxă`
);
process.exit(probleme.length ? 1 : 0);
