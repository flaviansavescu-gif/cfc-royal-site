// =========================================================================
// scrie-adoptarea.mjs — trece în fiecare document publicat hotărârea prin care a fost
// adoptat.
//
// DE CE NU SE SCRIE DE MÂNĂ. Sunt 32 de documente, iar numerele hotărârilor merg în șir.
// Transcrise una câte una, undeva pe la a nouăsprezecea se sare un număr — și n-ar avea
// cum să se vadă: toate arată la fel de plauzibil. Aici numărul se DERIVĂ din aceeași
// ordine din care s-a făcut registrul semnat de Consiliu, deci nu poate ieși alt șir.
//
// ȘEDINȚA DIN 1 AUGUST 2026: pozițiile 1–34 au primit hotărârile 139–172, în ordine, iar
// registrul însuși e hotărârea 173. Ordinea e cea din `registru-adoptare.js`: întâi
// `documente/ro` alfabetic, apoi `regulamente/ro`, apoi paginile juridice.
//
// Rulează o singură dată; a doua oară nu strică nimic, doar rescrie aceleași valori.
//   node scripts/scrie-adoptarea.mjs [--probă]
// =========================================================================
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RADACINA = fileURLToPath(new URL("..", import.meta.url));
const CONTINUT = join(RADACINA, "src", "content");

/** Ședința: data, prima hotărâre și ordinea grupelor. */
const SEDINTA = { data: "2026-08-01", zi: "01-08-2026", prima: 139 };
const GRUPE = ["documente/ro", "regulamente/ro", "pagini/ro/juridic"];

const PROBA = process.argv.includes("--probă") || process.argv.includes("--proba");

/**
 * Pune sau înlocuiește o cheie în frontmatter, păstrând restul neatins.
 *
 * Nu se despică fișierul în YAML și înapoi: o serializare ar rescrie toate rândurile,
 * ar schimba ghilimelele și ordinea cheilor, iar diferența din depozit ar arăta ca și
 * cum s-au modificat 32 de documente în întregime. Așa se vede exact ce s-a adăugat.
 */
function pune(text, cheie, valoare) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) throw new Error("fișier fără frontmatter");
  const cap = m[1];
  const re = new RegExp("^" + cheie + ":.*$", "m");
  const rand = cheie + ": " + valoare;
  const capNou = re.test(cap) ? cap.replace(re, rand) : cap + "\n" + rand;
  return text.slice(0, m.index) + "---\n" + capNou + "\n---" + text.slice(m.index + m[0].length);
}

/**
 * Versiunea în altă limbă a aceluiași act.
 *
 * Traducerea nu e un act nou: e același text, adoptat prin aceeași hotărâre. Lăsată fără
 * număr, ar arăta ca un document neadoptat — iar cine citește site-ul în engleză ar vedea
 * un regulament fără temei. Numele fișierelor se potrivesc unu la unu între `ro/` și
 * `en/`, deci perechea se află singură.
 */
const perechea = (grup, f) => {
  const alta = grup.includes("/ro") ? grup.replace("/ro", "/en") : null;
  return alta ? join(CONTINUT, alta, f) : null;
};

let nr = SEDINTA.prima;
const facute = [];

for (const grup of GRUPE) {
  const dir = join(CONTINUT, grup);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".md")).sort()) {
    const hotarare = nr + "/" + SEDINTA.zi;
    let titlu = "";

    for (const cale of [join(dir, f), perechea(grup, f)]) {
      if (!cale) continue;
      let t;
      try { t = readFileSync(cale, "utf8"); } catch { continue; }   // traducerea poate lipsi
      if (!titlu) titlu = (/^title:\s*"?(.+?)"?\s*$/m.exec(t) || [])[1] || f;

      let nou = pune(t, "adoptat", SEDINTA.data);
      nou = pune(nou, "hotarare", '"' + hotarare + '"');
      if (!PROBA) writeFileSync(cale, nou);
    }

    facute.push({ nr, hotarare, grup, titlu });
    nr++;
  }
}

for (const x of facute) console.log(String(x.nr).padStart(3) + "  " + x.hotarare + "  " + x.titlu);
console.log("\n" + facute.length + " documente" + (PROBA ? " (probă — nu s-a scris nimic)" : " însemnate"));

// Plasa de siguranță: dacă ordinea folderelor s-ar schimba vreodată, numerele s-ar muta
// în tăcere pe alte documente. Cele trei pe care le știm din registrul semnat se verifică
// pe nume.
const CONTROL = {
  142: "Codul Etic",
  145: "Procedura disciplinară detaliată",
  147: "Regulamentul Colegiului de Arbitri",
  168: "Politica de confidențialitate",
};
let rele = 0;
for (const [n, titlu] of Object.entries(CONTROL)) {
  const gasit = facute.find((x) => x.nr === Number(n));
  if (!gasit || gasit.titlu !== titlu) {
    console.error(`  ✗ hotărârea ${n} ar trebui să fie „${titlu}", dar e „${gasit?.titlu || "—"}"`);
    rele++;
  }
}
if (rele) {
  console.error("\n  ORDINEA NU SE POTRIVEȘTE CU REGISTRUL SEMNAT. Nu te lua după ce s-a scris.");
  process.exit(1);
}
console.log("Verificat față de registrul semnat: cele patru poziții de control se potrivesc.");
