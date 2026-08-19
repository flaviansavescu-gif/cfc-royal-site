// _comun/cheie-blob.mjs — un segment de cheie Netlify Blob construit din input de la
// client NU are voie sa contina semne care ar sparge spatiul cheii.
//
// DE CE (SEC-001). Cheia Blob se lipeste intr-o cale (`store/<segment>`), iar SDK-ul
// `@netlify/blobs` o valideaza DOAR la scriere (`set`/`setJSON`), nu la citire. La
// citire, `new URL()` rezolva singur segmentele `../` inainte de a pleca cererea. Un
// `serie` de forma "../../" a scos astfel un HTTP 502 pe endpointul PUBLIC de pedigree.
//
// Aici RESPINGEM explicit — nu encodam, nu "curatam". Input periculos = eroare, exact
// cum face deja `caleSigura()` din material-curs.mjs pentru cai de fisier.
//
// OPRIM: separatorii `/` si `\`, traversarea `..`, procentul `%` (encodari) si
// caracterele de control (coduri sub 0x20).
// LASAM sa treaca: litere, cifre, CRATIMA, SPATIU si punctul simplu — fiindca seriile si
// identificatorii legitimi (CFCR-DMF-2026-0001, CFCR-P-2026-0001, WDF-0078, id-uri hex,
// microcipuri de cifre, eventual tastate cu spatii/cratime) le contin. Gardianul nu
// blocheaza nimic real (invariant verificat in cheie-blob.test.mjs).
//
// Verificare EXPLICITA, fara clasa de caractere regex (o clasa cu interval scapa usor si
// ar putea respinge din greseala cratima — care e legitima in serii).

/**
 * `true` daca `v` e un segment de cheie sigur: sir nevid, fara separatori (`/`, `\`),
 * fara traversare (`..`), fara procent si fara caractere de control. Orice altceva
 * (inclusiv non-string) => `false`.
 */
export function segmentCheieValid(v) {
  if (typeof v !== "string" || v.length === 0) return false;
  if (v.includes("/") || v.includes("\\") || v.includes("%") || v.includes("..")) return false;
  for (let i = 0; i < v.length; i++) {
    if (v.charCodeAt(i) < 0x20) return false; // caracter de control
  }
  return true;
}
