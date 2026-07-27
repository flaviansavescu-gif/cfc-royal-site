// registru-arhiva.mjs — strânge tot registrul genealogic într-o arhivă ZIP.
//
// DE CE EXISTĂ. Registrul trăiește într-un singur loc: magazia Netlify Blobs. Codul e
// în GitHub, dar datele nu sunt nicăieri altundeva. Dacă acel cont se pierde, se
// suspendă sau cineva șterge din greșeală, cartea de origini dispare cu tot cu
// pedigree-urile scanate — iar certificatele deja eliberate rămân fără acoperire.
//
// Arhiva e făcută să poată fi citită și peste zece ani, fără acest cod: JSON simplu
// pentru date, fișierele originale cu extensia lor, plus un CUPRINS.md care explică
// ce e fiecare lucru. O copie pe care n-o poți citi fără programul care a creat-o nu e
// o copie, e o speranță.
//
// LIMITA DE MĂRIME. Scanurile cresc repede (patru piese × sute de KB × fiecare cuib).
// Funcțiile au memorie și timp mărginite, așa că fișierele se adaugă doar cât timp
// suma lor stă sub `maxFisiere`; ce rămâne pe dinafară e trecut în cuprins, pe nume.
// Mai bine o arhivă incompletă și cinstită decât una care se oprește la jumătate.
import { getStore } from "@netlify/blobs";
import { zipSync } from "fflate";

const codificator = new TextEncoder();

/** Cheile care conțin fișiere binare (restul sunt JSON). */
const E_FISIER = (cheie) => cheie.startsWith("dmf-fisier/");

const EXTENSII = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
};

/**
 * Construiește arhiva.
 * @param {object} optiuni
 * @param {number} optiuni.maxFisiere - câți octeți de fișiere binare se includ (0 = niciunul)
 * @returns {Promise<{ zip: Uint8Array, rezumat: object }>}
 */
export async function construiesteArhiva({ maxFisiere = 40 * 1024 * 1024 } = {}) {
  const store = getStore("registru");
  const continut = {};
  const rezumat = {
    facutLa: new Date().toISOString(),
    inregistrari: 0, fisiere: 0, octetiFisiere: 0,
    fisiereOmise: [], erori: [],
  };

  let chei = [];
  try {
    const { blobs } = await store.list();
    chei = blobs.map((b) => b.key);
  } catch (err) {
    rezumat.erori.push("Listarea magaziei a eșuat: " + err.message);
    return { zip: zipSync({ "CUPRINS.md": codificator.encode(cuprins(rezumat)) }), rezumat };
  }

  // Întâi datele (mici și esențiale), apoi fișierele — dacă rămâne loc. Ordinea contează:
  // dacă mărimea taie ceva, taie scanurile, nu declarațiile.
  const cheiJson = chei.filter((k) => !E_FISIER(k)).sort();
  const cheiFisiere = chei.filter(E_FISIER).sort();

  for (const cheie of cheiJson) {
    try {
      const x = await store.get(cheie, { type: "json" });
      if (x == null) continue;
      continut["date/" + cheie + ".json"] = codificator.encode(JSON.stringify(x, null, 2));
      rezumat.inregistrari++;
    } catch (err) {
      rezumat.erori.push(cheie + ": " + err.message);
    }
  }

  for (const cheie of cheiFisiere) {
    try {
      const f = await store.getWithMetadata(cheie, { type: "arrayBuffer" });
      if (!f) continue;
      const octeti = new Uint8Array(f.data);
      if (rezumat.octetiFisiere + octeti.length > maxFisiere) {
        rezumat.fisiereOmise.push(cheie + " (" + Math.round(octeti.length / 1024) + " KB)");
        continue;
      }
      const ext = EXTENSII[f.metadata?.tip] || "bin";
      continut["fisiere/" + cheie + "." + ext] = octeti;
      rezumat.fisiere++;
      rezumat.octetiFisiere += octeti.length;
    } catch (err) {
      rezumat.erori.push(cheie + ": " + err.message);
    }
  }

  continut["CUPRINS.md"] = codificator.encode(cuprins(rezumat));
  // `level: 6` — scanurile sunt deja comprimate (JPEG/PDF), deci compresia agresivă ar
  // costa timp fără câștig; JSON-ul se strânge oricum bine.
  return { zip: zipSync(continut, { level: 6 }), rezumat };
}

function cuprins(r) {
  return `# Registrul genealogic CFC-Royal — copie de siguranță

Făcută la: ${r.facutLa}

## Ce e în arhivă

- \`date/\` — toate înregistrările, în JSON, cu numele cheii din magazie:
  - \`dmf/<id>.json\` — Declarația de Montă și Fătare, întreagă (părinți, pui,
    semnătura declarantului, confirmarea proprietarului masculului, ascendența).
  - \`pedigree/<serie>.json\` — Certificatul de Origine emis, cu ascendența înghețată
    în el la data emiterii.
  - \`membru/<amprentă>.json\`, \`registrator/<amprentă>.json\` — persoanele cu acces.
    Cheia e amprenta codului, nu codul: din arhivă NU se poate reconstitui niciun cod.
  - \`contor/…\`, \`serie/…\` — evidența numerelor, ca să nu se repete.
- \`fisiere/\` — piesele încărcate la dosare (pedigree-uri, dovada dreptului de montă,
  dovada plății, dovezile semnate), cu extensia lor reală.

## Cifre

- Înregistrări: ${r.inregistrari}
- Fișiere incluse: ${r.fisiere} (${(r.octetiFisiere / 1048576).toFixed(1)} MB)
${r.fisiereOmise.length ? `
## ATENȚIE — fișiere NEINCLUSE (arhiva a atins limita de mărime)

${r.fisiereOmise.map((x) => "- " + x).join("\n")}

Descarcă-le separat din registru sau mărește limita exportului.
` : ""}${r.erori.length ? `
## Erori la citire

${r.erori.map((x) => "- " + x).join("\n")}
` : ""}
## Cum se citește peste ani

Fișierele sunt JSON obișnuit și imagini/PDF-uri obișnuite. Nu e nevoie de acest site
ca să le deschizi: orice editor de text și orice vizualizator de imagini ajung.
`;
}
