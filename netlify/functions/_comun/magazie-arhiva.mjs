// =========================================================================
// magazie-arhiva.mjs — strânge o magazie Netlify Blobs oarecare într-o arhivă ZIP.
//
// DE CE EXISTĂ. `registru-arhiva.mjs` face asta pentru cartea de origini, cu un cuprins
// scris anume pentru ea. Dar datele asociației nu stau într-o singură magazie: stau în
// opt. Până acum se salva UNA. Dacă magazia `cursuri` s-ar fi pierdut, s-ar fi pierdut
// tot dosarul Școlii de Arbitraj — parcursul fiecărui candidat, examenele, contestațiile
// — și nu există nicăieri altundeva.
//
// CE SE INCLUDE. Tot. Regula e pe dos față de o poartă de acces: acolo, ce nu e enumerat
// se refuză; aici, ce nu e enumerat se SALVEAZĂ. O cheie nouă, apărută peste un an într-o
// funcție nouă, intră singură în copie. Greșeala se face tot în partea sigură — doar că
// „sigur" înseamnă aici „nu pierdem nimic".
//
// CE NU SE INCLUDE. Două feluri de chei, amândouă enumerate explicit mai jos:
//   1. cele TRECĂTOARE, care poartă și chei de intrare în numele lor (sesiuni, coduri de
//      instalare, jetoane de dispozitiv). Nu se restaurează nimic din ele — omul intră
//      din nou și primește altele — iar o copie care le-ar căra ar fi un dosar de chei.
//   2. cele DERIVATE dintr-un original pe care asociația îl are oricum (paginile-imagine
//      ale materialului de studiu, scoase dintr-un PDF). Ocupă zeci de MB și se refac
//      într-o oră; scanurile depuse de oameni, în schimb, nu se refac niciodată.
// Ce sare e trecut în cuprins, pe nume. O copie care tace despre ce n-a luat minte.
// =========================================================================
import { getStore } from "@netlify/blobs";
import { zipSync } from "fflate";
import { faraSecrete } from "./registru-arhiva.mjs";

const codificator = new TextEncoder();

/** Magaziile care se salvează aici. `registru` are copia lui, mai veche și mai amănunțită. */
export const MAGAZII = [
  { nume: "cursuri", ce: "Școala de Arbitraj: candidați, examene, contestații, autorizări, asistențe, buletin, Codul Etic" },
  { nume: "expozitii", ce: "înscrieri online, marcajele registraturii, auditul verificărilor, rezultate publicate" },
  { nume: "jcr", ce: "Judge Comparison Room: sesiuni de comparație, bareme, răspunsuri, rapoarte" },
  { nume: "paa", ce: "Photo Anatomy Annotator: exerciții și imaginile lor" },
  { nume: "interese", ce: "interesele candidaților pe grupe și rase" },
  { nume: "breed", ce: "Breed Explorer: instalările și starea lor" },
  { nume: "acte-revocate", ce: "actele anulate — lista care face verificarea prin cod QR să spună adevărul" },
];

/**
 * Chei trecătoare sau purtătoare de secrete. Nu se salvează, în nicio magazie.
 * Numele sunt neechivoce, de aceea regula e globală și nu pe magazie: o listă pe magazie
 * ar trebui ținută la zi de fiecare dată când apare o funcție nouă, iar cine uită
 * strecoară jetoane în copie.
 */
export const PREFIXE_SARITE = [
  "session/",        // sesiuni de lucru — numele cheii E jetonul
  "session-index/",
  "install-cod/",    // coduri de instalare, de unică folosință
  "dispozitiv/",     // al doilea factor: jetoane de dispozitiv
  "limita/",         // numărătorile limitatorului de încercări
  "cerere-ip/",      // urma de IP a cererilor, ținută scurt
  "monitor/",        // starea supravegherii, se reface singură
];

/** Fișiere mari refăcute dintr-un original pe care asociația îl are: se sar, dar se spune. */
export const PREFIXE_DERIVATE = [
  "material-studiu/", // paginile-imagine scoase din PDF-ul de studiu
];

export const eSarita = (cheie) => PREFIXE_SARITE.some((p) => cheie.startsWith(p));
export const eDerivata = (cheie) => PREFIXE_DERIVATE.some((p) => cheie.startsWith(p));

const EXTENSII = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
};

/**
 * Construiește arhiva unei magazii.
 *
 * Nu întrebăm din vreme ce e JSON și ce e fișier: încercăm să citim JSON, iar ce nu se
 * citește așa e fișier. Lista de prefixe „binare" ar fi încă un lucru de ținut la zi, și
 * primul lucru uitat.
 *
 * @param {string} magazie
 * @param {{ maxFisiere?: number, store?: object }} optiuni  `store` doar pentru probe.
 */
export async function arhiveazaMagazia(magazie, { maxFisiere = 10 * 1024 * 1024, store } = {}) {
  const s = store || getStore(magazie);
  const continut = {};
  const rezumat = {
    magazie,
    facutLa: new Date().toISOString(),
    inregistrari: 0, fisiere: 0, octetiFisiere: 0,
    sarite: 0, derivateSarite: [], fisiereOmise: [], erori: [],
  };

  let chei = [];
  try {
    const { blobs } = await s.list();
    chei = blobs.map((b) => b.key);
  } catch (err) {
    rezumat.erori.push("Listarea magaziei a eșuat: " + err.message);
    return { zip: zipSync({ "CUPRINS.md": codificator.encode(cuprins(rezumat)) }), rezumat };
  }

  const depastrat = [];
  for (const cheie of chei.sort()) {
    if (eSarita(cheie)) { rezumat.sarite++; continue; }
    if (eDerivata(cheie)) { rezumat.derivateSarite.push(cheie); continue; }
    depastrat.push(cheie);
  }

  // Întâi datele, apoi fișierele — dacă rămâne loc. Dacă mărimea taie ceva, să taie
  // scanurile, nu fișele.
  const binare = [];
  for (const cheie of depastrat) {
    try {
      const x = await s.get(cheie, { type: "json" });
      if (x == null) { binare.push(cheie); continue; }
      continut["date/" + cheie + ".json"] = codificator.encode(JSON.stringify(faraSecrete(x), null, 2));
      rezumat.inregistrari++;
    } catch {
      binare.push(cheie); // nu e JSON — atunci e fișier
    }
  }

  for (const cheie of binare) {
    try {
      const f = await s.getWithMetadata(cheie, { type: "arrayBuffer" });
      if (!f || !f.data) continue;
      const octeti = new Uint8Array(f.data);
      if (rezumat.octetiFisiere + octeti.length > maxFisiere) {
        rezumat.fisiereOmise.push(cheie + " (" + Math.round(octeti.length / 1024) + " KB)");
        continue;
      }
      const ext = EXTENSII[f.metadata?.tip] || EXTENSII[f.metadata?.contentType] || "bin";
      continut["fisiere/" + cheie + "." + ext] = octeti;
      rezumat.fisiere++;
      rezumat.octetiFisiere += octeti.length;
    } catch (err) {
      rezumat.erori.push(cheie + ": " + err.message);
    }
  }

  continut["CUPRINS.md"] = codificator.encode(cuprins(rezumat));
  return { zip: zipSync(continut, { level: 6 }), rezumat };
}

function cuprins(r) {
  const ce = MAGAZII.find((m) => m.nume === r.magazie)?.ce || "";
  return `# Copie de siguranță — magazia \`${r.magazie}\`

Asociația Club Federal Chinologic – Royal
Făcută la: ${r.facutLa}

${ce ? "Ce ține magazia asta: " + ce + ".\n" : ""}
## Ce e în arhivă

- \`date/\` — toate înregistrările, în JSON, cu numele cheii din magazie. Codurile de
  acces (\`cod\`, \`jeton\`, \`parola\`, \`secret\`) sunt scoase din fișe: din arhiva asta
  NU se poate intra nicăieri.
- \`fisiere/\` — piesele încărcate de oameni (dovezi, imagini), cu extensia lor reală.

## Cifre

- Înregistrări: ${r.inregistrari}
- Fișiere incluse: ${r.fisiere} (${(r.octetiFisiere / 1048576).toFixed(1)} MB)
- Chei trecătoare sărite (sesiuni, coduri de instalare, limitări): ${r.sarite}
${r.derivateSarite.length ? `
## Nesalvate pentru că se refac din original

${r.derivateSarite.map((x) => "- " + x).join("\n")}

Sunt pagini-imagine scoase dintr-un PDF pe care asociația îl are. Se încarcă din nou cu
scriptul de pregătire a materialului de studiu.
` : ""}${r.fisiereOmise.length ? `
## ATENȚIE — fișiere NEINCLUSE (arhiva a atins limita de mărime)

${r.fisiereOmise.map((x) => "- " + x).join("\n")}

Mărește limita copiei sau descarcă-le separat.
` : ""}${r.erori.length ? `
## Erori la citire

${r.erori.map((x) => "- " + x).join("\n")}
` : ""}
## Cum se citește peste ani

Fișierele sunt JSON obișnuit și imagini obișnuite. Nu e nevoie de site, de Netlify sau de
acest cod ca să le deschizi: orice editor de text și orice vizualizator de imagini ajung.
`;
}
