// =========================================================================
// probe.mjs — rulează TOATE probele dintr-o singură comandă.
//
// Erau cincisprezece fișiere de probe scrise cu grijă, fiecare dovedind câte o regulă
// care ne-a costat o dată. Și nu le rula nimic: nici `npm run verifica`, nici build-ul.
// Se rulau doar când își aducea cineva aminte de ele, fișier cu fișier — adică rar, și
// niciodată toate. O probă pe care n-o rulezi nu apără nimic; e doar un document despre
// o intenție.
//
// De aici încolo se rulează singure: la fiecare build (`prebuild`) și la fiecare
// împingere în depozit (GitHub Actions). Dacă o probă cade, site-ul NU se publică.
//
// Cum se scrie o probă nouă: un fișier `*.test.mjs`, care scrie ce a verificat și iese
// cu 0 dacă e bine, cu altceva dacă nu. Se prinde singur în lista de aici.
//
// Rulează: npm test   (sau: node scripts/probe.mjs [bucată-din-nume])
// =========================================================================
import { readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// `fileURLToPath`, nu `.pathname`: pe Windows calea are literă de disc și diacritice
// codificate procentual („Asocia%C8%9Bia"), iar `.pathname` le lasă așa.
const RADACINA = fileURLToPath(new URL("..", import.meta.url));

/** Unde se caută probe. Nu căutăm peste tot: node_modules ar dura o veșnicie. */
const LOCURI = [
  "netlify/functions/_comun",
  "netlify/functions/_jcr",
  "netlify/functions/_interese",
  "netlify/functions/_paa",
  "src/data",
  "scripts",
];

/** Probe care nu se cheamă `*.test.mjs`, dar sunt probe. */
const ANUME = ["scripts/proba-copie.mjs"];

const filtru = process.argv[2] || "";

/**
 * Cifra de final a unei probe. Sunt două feluri de probe în casă: unele scrise de mână,
 * care spun singure „toate trecute", și altele pe `node:test`, care numără în felul lor.
 * Luând orbește ultimul rând, la cele din urmă ieșea o linie de stivă — arăta a eroare
 * lângă o bifă verde, ceea ce e cel mai prost fel de raport: te învață să nu-l citești.
 */
function rezumatul(iesire) {
  const randuri = iesire.split("\n");
  const nr = (eticheta) => {
    const r = randuri.find((l) => new RegExp("^\\s*[ℹ#]\\s*" + eticheta + "\\s+\\d+").test(l));
    return r ? Number(r.match(/\d+/)[0]) : null;
  };
  const trecute = nr("pass"), cazute = nr("fail");
  if (trecute != null) return `${trecute} trecute` + (cazute ? `, ${cazute} căzute` : "");
  const propriu = [...randuri].reverse().find((l) => /trecut|căzut/i.test(l));
  return (propriu || randuri.filter(Boolean).pop() || "").trim();
}

const gasite = [];
for (const loc of LOCURI) {
  const cale = join(RADACINA, loc);
  if (!existsSync(cale)) continue;
  for (const f of readdirSync(cale).sort()) {
    if (f.endsWith(".test.mjs")) gasite.push(join(loc, f));
  }
}
for (const a of ANUME) if (existsSync(join(RADACINA, a))) gasite.push(a);

const deRulat = gasite.filter((f) => !filtru || f.includes(filtru));

if (!deRulat.length) {
  console.error(filtru ? `Nicio probă nu se potrivește cu „${filtru}".` : "N-am găsit nicio probă.");
  process.exit(1);
}

console.log(`Rulez ${deRulat.length} probe.\n`);

const cazute = [];
const inceput = Date.now();

for (const f of deRulat) {
  const r = spawnSync(process.execPath, [join(RADACINA, f)], {
    cwd: RADACINA,
    encoding: "utf8",
    // ADMIN_HASH nu e în mediu la probe (e secret în Netlify). Rolurile fac fail-closed
    // fără el; punem o amprentă de test validă ca probele de format/rol să aibă ce verifica.
    env: { ADMIN_HASH: process.env.ADMIN_HASH || "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", ...process.env, NO_COLOR: "1" },
  });
  const iesire = (r.stdout || "") + (r.stderr || "");
  const nume = f.replace(/\\/g, "/");

  if (r.status === 0) {
    // La probele trecute nu ne trebuie povestea, doar cifra.
    console.log(`  ✓ ${nume}  ${rezumatul(iesire)}`);
  } else {
    cazute.push(nume);
    console.log(`  ✗ ${nume}`);
    // La cele căzute vrem TOT: altfel omul trebuie s-o ruleze din nou ca să vadă de ce.
    console.log(iesire.split("\n").map((l) => "      " + l).join("\n"));
  }
}

const secunde = ((Date.now() - inceput) / 1000).toFixed(1);
console.log("");
if (cazute.length) {
  console.error(`${cazute.length} din ${deRulat.length} probe au căzut (${secunde}s):`);
  for (const c of cazute) console.error("  - " + c);
  process.exit(1);
}
console.log(`Toate cele ${deRulat.length} probe au trecut (${secunde}s).`);
