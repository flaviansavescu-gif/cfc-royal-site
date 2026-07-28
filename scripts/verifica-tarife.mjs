// =========================================================================
// verifica-tarife.mjs — nicio sumă scrisă de mână care să nu fie în lista oficială.
//
// De ce: „100 lei" apare astăzi în patru fișiere de conținut. Când se schimbă
// tariful, cineva le modifică pe trei și uită a patra — iar aceea rămâne pe site
// cu prețul vechi, invizibilă până când o găsește un solicitant. Verificarea
// asta cade la build dacă într-o pagină apare o sumă în lei care nu există în
// src/data/tarife.ts.
//
// NU verifică dacă suma e la locul potrivit — doar că e o sumă reală din lista
// în vigoare. Atât e suficient ca să prindă abaterea, fără să blocheze scrisul.
// =========================================================================
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RADACINA = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SURSA_TARIFE = join(RADACINA, "src", "data", "tarife.ts");

// Locurile unde se scrie conținut de mână. Fișierul de date și componenta care îl
// randează sunt exceptate: acolo sumele SUNT sursa.
const ZONE = [join("src", "content"), join("src", "pages")];
const EXCEPTATE = [
  join("src", "data", "tarife.ts"),
  join("src", "components", "Tarife.astro"),
];

/** Sumele din lista oficială (doar cele în lei — EUR și procentele se scriu altfel). */
function sumeOficiale() {
  const sursa = readFileSync(SURSA_TARIFE, "utf8");
  const sume = new Set();
  const re = /valoare:\s*(\d+)\s*,\s*moneda:\s*"RON"/g;
  let m;
  while ((m = re.exec(sursa))) sume.add(Number(m[1]));
  if (!sume.size) {
    console.error("verifica-tarife: nu am găsit nicio sumă în " + SURSA_TARIFE);
    process.exit(1);
  }
  return sume;
}

function fisiere(dir) {
  const rezultat = [];
  const mers = (d) => {
    for (const nume of readdirSync(d)) {
      const cale = join(d, nume);
      if (statSync(cale).isDirectory()) mers(cale);
      else if (/\.(md|mdx|astro)$/.test(nume)) rezultat.push(cale);
    }
  };
  mers(dir);
  return rezultat;
}

const OFICIALE = sumeOficiale();
// „100 lei", „100 LEI", „100 RON" — cu sau fără spațiu, cu ** de bold în jur.
const SUMA = /(\d{1,5})\s*\*{0,2}\s*(lei|LEI|Lei|RON|ron)\b/g;

let gresite = 0;
let verificate = 0;

for (const zona of ZONE) {
  const dir = join(RADACINA, zona);
  for (const cale of fisiere(dir)) {
    const rel = relative(RADACINA, cale);
    if (EXCEPTATE.some((e) => rel === e || rel.split(sep).join("/") === e.split(sep).join("/"))) continue;
    verificate++;
    const text = readFileSync(cale, "utf8");
    let m;
    SUMA.lastIndex = 0;
    while ((m = SUMA.exec(text))) {
      const val = Number(m[1]);
      if (!OFICIALE.has(val)) {
        gresite++;
        const linie = text.slice(0, m.index).split("\n").length;
        console.error(
          "  RAU  " + rel.split(sep).join("/") + ":" + linie +
          " — suma „" + m[0] + "” nu există în lista de tarife (src/data/tarife.ts)",
        );
      }
    }
  }
}

console.log(
  verificate + " fișiere de conținut verificate, " +
  OFICIALE.size + " sume oficiale în listă, " +
  (gresite ? gresite + " nepotriviri" : "nicio nepotrivire"),
);
process.exit(gresite ? 1 : 0);
