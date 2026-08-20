// =========================================================================
// persoane.mjs — SURSA UNICĂ pentru oamenii Școlii de Arbitraj (lectorii).
//
// DE CE EXISTĂ. Numele, slug-ul și grupele acelorași oameni erau scrise de mână
// în mai multe locuri (serverul de roluri, platforma de cursuri, paginile de
// conținut). Scoaterea unui lector a cerut, pe 20.08.2026, cinci edituri manuale
// sincrone — exact felul de operație în care o scăpare lasă site-ul să mintă.
//
// De aici derivă:
//   • netlify/functions/_comun/roluri.mjs — lista serverului (amprentele codurilor
//     rămân ACOLO, nu aici: fișierul acesta ajunge și în build-ul paginilor);
//   • src/data/cursuri.ts — lista lectorilor din platformă (numele + rolul afișat).
//
// Proba `persoane.test.mjs` verifică LA FIECARE BUILD că serverul, platforma și
// paginile de arbitri spun același lucru — o nepotrivire oprește publicarea.
//
// E un fișier .mjs (nu .ts) cu bună știință: îl importă și funcțiile Netlify
// (Node curat, fără TypeScript la rulare), și paginile Astro.
// =========================================================================

/**
 * Lectorii Școlii de Arbitraj.
 *   slug   — cheia peste tot (spațiul lectorului, dosarele, materialele);
 *   nume   — ortografia oficială, folosită identic în toate locurile;
 *   grupe  — "all" (All Breed) sau lista grupelor WDF (1–10);
 *   rolCursuri — (opțional) titlul afișat în platformă, dacă diferă de cel derivat.
 */
export const LECTORI_PERSOANE = [
  { slug: "flavian-savescu", nume: "Flavian-Sergiu Savescu", grupe: "all", rolCursuri: "Președinte al Colegiului de Arbitri · WDF All Breed" },
  { slug: "mihail-cosmin-neagu", nume: "Mihail Cosmin Neagu", grupe: "all" },
  { slug: "mihail-sorin-iacob", nume: "Mihail Sorin Iacob", grupe: "all" },
  { slug: "andreea-daniela-popescu", nume: "Andreea-Daniela Popescu", grupe: [3, 5, 9] },
  { slug: "alexandru-paul-ciolac", nume: "Alexandru Paul Ciolac", grupe: [2, 3, 4, 6, 8] },
];

/** Textul grupelor, generat — nu scris de mână: "All Breed" sau "Grupele 3, 5, 9". */
export const grupeText = (grupe) =>
  grupe === "all" ? "All Breed" : "Grupele " + grupe.join(", ");

/** Rolul afișat în platforma de cursuri: cel declarat sau cel derivat din grupe. */
export const rolLector = (p) => p.rolCursuri || "Arbitru WDF · " + grupeText(p.grupe);
