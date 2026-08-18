// butoane-vizibile.test.mjs — un buton trebuie sa se poata CITI.
//
// DEFECTUL, gasit pe 18.08.2026 de utilizator, la butonul de descarcare al Statutului:
// textul butonului avea EXACT culoarea fundalului. Contrast 1.00 — un buton perfect
// invizibil, pe care omul il vedea doar ca pe un dreptunghi verde.
//
// Cauza n-a fost o culoare gresita, ci o CIOCNIRE DE SPECIFICITATE. In corpul unui
// document, legaturile din text sunt verzi:
//
//     .record__body :global(a) { color: var(--color-link) }     -> specificitate 0,2,1
//     .btn--primary            { color: var(--color-text-inverse) } -> 0,1,0
//
// Regula de proza o bate pe cea a butonului, asa ca textul lui devenea verde pe verde.
// Nu se vedea in cod: fiecare regula, citita singura, e corecta. Se vede doar pe pagina.
//
// Reparatia: `a:not(.btn)`. Proba de aici o tine pe loc — si pentru celelalte locuri
// unde proza isi coloreaza legaturile, ca sa nu se repete la urmatorul buton pus intr-un
// text.
//
// Ruleaza: node scripts/butoane-vizibile.test.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RADACINA = fileURLToPath(new URL("..", import.meta.url));

let rau = 0;
const t = (nume, bun, info) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + (!bun && info != null ? " -> " + info : ""));
};

function fisiere(dir, ext) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...fisiere(p, ext));
    else if (ext.some((e) => n.endsWith(e))) out.push(p);
  }
  return out;
}

console.log("\nButoanele nu au voie sa se piarda in fundal\n");

// Ne uitam DOAR la regulile cu `:global(a…)`.
//
// `:global` e chiar semnul locului primejdios: el exista fiindca marcajul vine din
// markdown, adica din mana unui autor de conținut, care POATE pune acolo un buton. O
// regula scrisa de mana, ca `.crumbs a` (firul Ariadnei), coloreaza legaturi pe care le
// scriem tot noi si unde nu ajunge niciun buton — n-are rost s-o incarcam cu exceptii.
const surse = [
  ...fisiere(join(RADACINA, "src", "layouts"), [".astro"]),
  ...fisiere(join(RADACINA, "src", "styles"), [".css"]),
];

let verificate = 0;
for (const cale of surse) {
  const s = readFileSync(cale, "utf8");
  const scurt = cale.slice(RADACINA.length).replace(/\\/g, "/");

  // `a(?:[^()]|\([^()]*\))*` — selectorul poate purta el însuși paranteze, ca `:not(.btn)`.
  for (const m of s.matchAll(/^([^\n{]*?):global\(\s*(a(?:[^()]|\([^()]*\))*)\)\s*\{([^}]*)\}/gm)) {
    const [, prefix, selectorA, corp] = m;
    if (!/(^|[\s;])color\s*:/.test(corp)) continue; // nu coloreaza — nu ne priveste
    verificate++;
    t(
      `${scurt}: „${prefix.trim()} :global(${selectorA})" scuteste butoanele`,
      /:not\(\s*\.btn\s*\)/.test(selectorA),
      "adauga `:not(.btn)`, altfel textul butonului ia culoarea legaturilor din text",
    );
  }
}

t("s-au gasit reguli de colorat legaturi de verificat", verificate > 0, "regexul nu mai prinde nimic — de revizuit");

// Si perechea de culori a butonului principal: text deschis pe verde inchis.
const global = readFileSync(join(RADACINA, "src", "styles", "global.css"), "utf8");
t(
  "butonul principal are text deschis pe fundal inchis",
  /\.btn--primary\s*\{[^}]*background:\s*var\(--color-primary\)[^}]*color:\s*var\(--color-text-inverse\)/.test(global),
);

console.log(rau ? `\n${rau} probe cazute\n` : "\nToate probele au trecut\n");
process.exit(rau ? 1 : 0);
