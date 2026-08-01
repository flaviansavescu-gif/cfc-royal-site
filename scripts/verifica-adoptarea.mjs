// =========================================================================
// verifica-adoptarea.mjs — niciun act al asociației nu se publică fără hotărârea prin
// care a fost adoptat.
//
// DE CE EXISTĂ. Până la 1 august 2026, pe site erau 32 de documente cu putere de act:
// Codul Etic, Procedura disciplinară, regulamentele de arbitraj, paginile juridice.
// Douăzeci și nouă nu spuneau nimic despre cine le-a adoptat și când. Trei aveau tipărit
// în ele, negru pe alb, „în ședința din data de [data]" — publicate cu locul gol în text.
//
// Nimeni nu observase, fiindcă un document neadoptat arată exact ca unul adoptat. Se vede
// abia la prima contestație, când cineva citește cu atenție și întreabă din ce hotărâre
// decurge textul pe care e sancționat.
//
// De aici încolo se vede la fiecare build. Cade dacă:
//   • un document din `documente`, `regulamente` sau paginile juridice n-are `adoptat` și
//     `hotarare` în frontmatter;
//   • undeva a rămas un „[data]" nescos;
//   • numărul hotărârii nu are forma așteptată.
//
// Rulează: node scripts/verifica-adoptarea.mjs
// =========================================================================
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RADACINA = fileURLToPath(new URL("..", import.meta.url));
const CONTINUT = join(RADACINA, "src", "content");

/** Unde se cere adoptarea. Restul conținutului — știri, pagini, canise — nu sunt acte. */
const LOCURI = ["documente", "regulamente", "pagini/ro/juridic", "pagini/en/juridic"];

/** Forma numărului: „142/01-08-2026". */
const FORMA = /^\d{1,4}\/\d{2}-\d{2}-\d{4}$/;

function fisiere(dir) {
  const out = [];
  let intrari;
  try { intrari = readdirSync(dir); } catch { return out; }
  for (const n of intrari) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...fisiere(p));
    else if (n.endsWith(".md") || n.endsWith(".mdx")) out.push(p);
  }
  return out;
}

const rele = [];
let verificate = 0;

for (const loc of LOCURI) {
  for (const cale of fisiere(join(CONTINUT, loc))) {
    const t = readFileSync(cale, "utf8");
    const cap = (/^---\r?\n([\s\S]*?)\r?\n---/.exec(t) || [])[1] || "";
    const scurt = relative(CONTINUT, cale).replace(/\\/g, "/");

    // Ciornele nu se publică, deci nu se cere hotărâre pentru ele.
    if (/^draft:\s*true\s*$/m.test(cap)) continue;
    verificate++;

    const adoptat = (/^adoptat:\s*(.+?)\s*$/m.exec(cap) || [])[1];
    const hotarare = (/^hotarare:\s*"?(.+?)"?\s*$/m.exec(cap) || [])[1];

    if (!adoptat) rele.push([scurt, "nu are `adoptat` în frontmatter"]);
    if (!hotarare) rele.push([scurt, "nu are `hotarare` în frontmatter"]);
    else if (!FORMA.test(hotarare)) rele.push([scurt, `numărul hotărârii „${hotarare}" nu are forma 142/01-08-2026`]);

    // Locurile goale rămase în text sunt mai rele decât lipsa unei date în frontmatter:
    // ele se VĂD de oricine deschide documentul.
    if (t.includes("[data]")) rele.push([scurt, "a rămas un «[data]» nescos în text"]);
  }
}

if (rele.length) {
  console.error("\n  ACTE FĂRĂ HOTĂRÂRE DE ADOPTARE:\n");
  for (const [f, de_ce] of rele) console.error(`  ${f}\n      ${de_ce}`);
  console.error("\n  Un document cu putere de act se publică numai după ce Consiliul Director");
  console.error("  îl adoptă. Scrie `adoptat` și `hotarare` în frontmatter, apoi reia.\n");
  process.exit(1);
}

console.log(`verifica-adoptarea: ${verificate} acte publicate, toate cu hotărâre de adoptare`);
