// genereaza-afixe-oficiale.mjs — evidența oficială a afixelor, din paginile publice.
//
// DE CE EXISTĂ. Registrul online al afixelor (funcția registru-canise) verifică
// unicitatea pe ce are în magazie: canisele aprobate online și afixele din fișele
// membrilor. Dar asociația are 28 de canise înregistrate ÎNAINTE de drumul online,
// cu numere oficiale AFX001–AFX028 — publicate pe cfc-royal.ro/ro/canise/. Fără ele,
// sistemul ar declara „liber" un afix pe care îl poartă de luni de zile o canisă
// înregistrată.
//
// Sursa unică e colecția publică `src/content/canise/ro` — aceeași care umple pagina
// site-ului. De aici se GENEREAZĂ modulul `_comun/afixe-oficiale.mjs`, la fiecare
// build (prebuild) și oricând de mână:
//
//   node scripts/genereaza-afixe-oficiale.mjs
//
// O probă automată (afixe-oficiale.test.mjs) compară modulul generat cu colecția:
// dacă cineva adaugă o canisă pe site și uită să regenereze, probele cad și
// publicarea se oprește — modulul nu poate rămâne în urmă pe tăcute.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RADACINA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const COLECTIA = path.join(RADACINA, "src", "content", "canise", "ro");
const TINTA = path.join(RADACINA, "netlify", "functions", "_comun", "afixe-oficiale.mjs");

/** Citește colecția publică și întoarce lista afixelor oficiale, sortată pe număr. */
export function construiesteLista(dirColectie = COLECTIA) {
  const lista = [];
  for (const f of fs.readdirSync(dirColectie)) {
    if (!f.endsWith(".md")) continue;
    const text = fs.readFileSync(path.join(dirColectie, f), "utf8");
    const camp = (k) => (text.match(new RegExp("^" + k + ':\\s*"(.*?)"', "m")) || [])[1] || "";
    if (/^draft:\s*true/m.test(text)) continue;   // ciornele nu sunt încă în evidență
    const afix = camp("affix");
    if (!afix) continue;
    lista.push({
      afix,
      nrAfix: camp("registrationNumber"),
      titular: camp("owner"),
      stare: camp("status") || "activă",
    });
  }
  lista.sort((a, b) => a.nrAfix.localeCompare(b.nrAfix, "ro") || a.afix.localeCompare(b.afix, "ro"));
  return lista;
}

/** Scrie modulul generat. Întoarce câte afixe a scris. */
export function scrieModulul() {
  const lista = construiesteLista();
  const corp = `// afixe-oficiale.mjs — GENERAT din src/content/canise (pagina publică a caniselor).
//
// NU se editează de mână: orice schimbare se face în colecția publică, apoi se
// rulează \`node scripts/genereaza-afixe-oficiale.mjs\` (prebuild o face singur).
// Registrul online folosește lista ca temelie a unicității afixelor: ce e aici
// nu poate fi declarat „liber" pentru nimeni altcineva.
export const AFIXE_OFICIALE = ${JSON.stringify(lista, null, 2)};
`;
  fs.writeFileSync(TINTA, corp);
  return lista.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = scrieModulul();
  console.log(`afixe-oficiale.mjs scris: ${n} afixe din evidența publică`);
}
