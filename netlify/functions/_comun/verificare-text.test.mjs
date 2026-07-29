// verificare-text.test.mjs — cuvintele paginii de verificare.
//
// Pagina asta există tocmai ca să spună adevărul despre un act. Un cuvânt greșit acolo e
// mai grav decât un defect de calcul: „Certificat autentic" pentru un exemplar care n-are
// niciun certificat e o minciună rostită de instrumentul construit ca să nu mintă.
//
// Rulează: node netlify/functions/_comun/verificare-text.test.mjs
import { felActului, etichetaCod, textStare, notaValid, motivAnulare } from "./verificare-text.mjs";
import { readFileSync } from "node:fs";

let rau = 0;
const e = (nume, bun, info) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + (!bun && info != null ? " -> " + info : ""));
};

console.log("— felul actului: ce nu spune „rezultat\" e certificat —");
{
  e("„k: rezultat\" e rezultat", felActului({ k: "rezultat" }) === "rezultat");
  e("fără câmp = certificat (codurile deja tipărite)", felActului({}) === "certificat");
  e("pachet lipsă = certificat", felActului(null) === "certificat");
  // Orice altă valoare e certificat: un câmp scris greșit nu trebuie să transforme
  // un certificat adevărat într-un „rezultat" cu alte cuvinte pe el.
  for (const k of ["Rezultat", "rez", 1, true, ""]) {
    e(`„k: ${JSON.stringify(k)}" rămâne certificat`, felActului({ k }) === "certificat");
  }
}

console.log("— un rezultat nu se numește niciodată certificat —");
{
  e("valid", textStare("rezultat", "valid") === "✓ Rezultat confirmat");
  e("anulat", textStare("rezultat", "anulat") === "⚠ Rezultat ANULAT");
  e("neconfirmat", textStare("rezultat", "altceva") === "✕ Rezultat neconfirmat");

  e("certificat valid", textStare("certificat", "valid") === "✓ Certificat autentic");
  e("certificat anulat", textStare("certificat", "anulat") === "⚠ Certificat ANULAT");

  const toate = [
    textStare("rezultat", "valid"), textStare("rezultat", "anulat"), textStare("rezultat", "x"),
  ];
  e("niciun text de rezultat nu conține cuvântul „certificat\"",
    toate.every((t) => !/certificat/i.test(t)), toate.join(" | "));
}

console.log("— identificatorul se numește pe limba lui —");
{
  e("certificatele au serie", etichetaCod("certificat") === "Serie");
  e("rezultatele au cod", etichetaCod("rezultat") === "Cod rezultat");
}

console.log("— nota de la un rezultat spune ce se întâmplă la retragere —");
{
  const n = notaValid("rezultat");
  e("spune că a fost înregistrat de asociație", /înregistrat de Asociația/.test(n));
  e("spune că un titlu retras AR SCRIE anulat", /ar scrie ANULAT/i.test(n), n);
  e("trimite la fișa din cartea de origini", /cartea de origini/.test(n));
  // Formularea veche promitea pe dos — că retragerea NU se vede. De când revocarea merge,
  // promisiunea trebuie să fie cealaltă, altfel pagina se contrazice singură.
  e("NU mai spune că retragerea nu se vede", !/NU se vede aici/.test(n));

  const c = notaValid("certificat");
  e("nota certificatului rămâne scurtă", c.length < 200 && /emis de Asociația/.test(c));
}

console.log("— anularea spune ce anume nu mai e valabil —");
{
  const r = motivAnulare("rezultat", "REZ/resita-2026/12");
  e("numește codul", r.includes("REZ/resita-2026/12"));
  e("spune că titlul de pe imagine nu mai stă", /nu mai este\s*\n?\s*valabil/.test(r), r);
  e("dă o cale de lămurire", /contact@cfc-royal\.ro/.test(r));

  const a = motivAnulare("certificat", "003/01.11.2026");
  e("la certificate, numește delegatul WDF", /delegatul World Dog Federation/.test(a));
  e("și seria", a.includes("003/01.11.2026"));
}

console.log("— funcția chiar folosește modulul, iar pagina îl afișează —");
{
  const f = readFileSync(new URL("../verifica-act.mjs", import.meta.url), "utf8");
  e("funcția îl importă", f.includes('from "./_comun/verificare-text.mjs"'));
  e("trimite starea la pagină", /stareText: textStare\(fel, "valid"\)/.test(f));
  e("trimite și nota", /nota: notaValid\(fel\)/.test(f));
  e("la anulare, trimite motivul potrivit felului", /motiv: motivAnulare\(fel, act\.serie\)/.test(f));
  e("trimite și eticheta codului", /etichetaCod: etichetaCod\(fel\)/.test(f));
  // Verificarea în lista de anulări merge pe „serie" — iar rezultatele au acum una.
  e("anularea se caută după același câmp pentru amândouă", /revocate\.includes\(act\.serie\)/.test(f));

  const pag = readFileSync(new URL("../../../src/pages/verifica.astro", import.meta.url), "utf8");
  e("pagina afișează starea primită", /stare\.textContent = d\.stareText/.test(pag));
  e("pagina afișează nota primită", /nota\.textContent = d\.nota/.test(pag));
  e("pagina folosește eticheta primită", /rand\(a\.etichetaCod \|\| "Serie", a\.serie\)/.test(pag));
  // Rândurile de rezervă rămân, pentru codurile QR tipărite înaintea acestei schimbări.
  e("are text de rezervă pentru codurile vechi", /\|\| "⚠ Certificat ANULAT"/.test(pag));
}

console.log(rau ? rau + " căzute" : "toate trecute");
process.exit(rau ? 1 : 0);
