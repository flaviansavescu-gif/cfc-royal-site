// magazie-arhiva.test.mjs — probează copia celorlalte magazii pe o magazie prefăcută.
//
// Ce trebuie dovedit, în ordinea gravității:
//   1. NU pleacă secrete în copie (nici în fișe, nici în numele cheilor).
//   2. NU se pierde nimic care nu se poate reface — fișele intră toate, fișierele intră
//      cât încap, iar ce n-a încăput e scris pe nume în cuprins.
//   3. Ce sare, sare pentru un motiv scris, nu din întâmplare.
//
// Rulează: node netlify/functions/_comun/magazie-arhiva.test.mjs
import { arhiveazaMagazia, eSarita, eDerivata, PREFIXE_SARITE, MAGAZII } from "./magazie-arhiva.mjs";
import { unzipSync } from "fflate";

let rau = 0;
const e = (nume, bun, info) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + (!bun && info != null ? " -> " + info : ""));
};
const text = (u8) => new TextDecoder().decode(u8);

/** Magazie prefăcută, cu aceeași înfățișare ca @netlify/blobs. */
function magaziePrefacuta(intrari) {
  return {
    async list() { return { blobs: Object.keys(intrari).map((key) => ({ key })) }; },
    async get(cheie, { type } = {}) {
      const v = intrari[cheie];
      if (v === undefined) return null;
      if (type === "json") {
        if (v instanceof Uint8Array) throw new SyntaxError("nu e JSON");
        return v;
      }
      return v;
    },
    async getWithMetadata(cheie) {
      const v = intrari[cheie];
      if (v === undefined) return null;
      return { data: v instanceof Uint8Array ? v.buffer : null, metadata: { tip: "image/jpeg" } };
    },
  };
}

const mare = (n) => new Uint8Array(n).fill(7);

const store = magaziePrefacuta({
  "candidat/ana": { nume: "Ana Popescu", email: "ana@example.ro", cod: "COL-SECRET-1" },
  "examen/2026-1": { candidat: "ana", nota: 9, jeton: "nu-trebuie-sa-plece" },
  "contestatie-examen/7": { motiv: "Întrebarea 4 avea două răspunsuri bune" },
  "arbitru/abc": { nume: "Cosmin Neagu", parola: "x", secret: "y" },
  // trecătoare — nu au ce căuta în copie
  "session/JETON-VIU-123": { rol: "admin" },
  "install-cod/PAA-9times": { folosit: false },
  "dispozitiv/xyz": { rol: "registratura" },
  "limita/1.2.3.4": { esecuri: 2 },
  "monitor/ultima": { ok: true },
  // derivate — se refac din PDF-ul original
  "material-studiu/pag-001": mare(2000),
  "material-studiu/pag-002": mare(2000),
  // fișiere adevărate, încărcate de oameni
  "dovada/expo1/ana.jpg": mare(400),
  "image/paa-77": mare(400),
});

console.log("— nimic din ce e secret nu pleacă în copie —");
// Limita de 500 de octeți, cu două fișiere de 400: primul intră, al doilea nu mai are loc.
const { zip, rezumat } = await arhiveazaMagazia("cursuri", { maxFisiere: 500, store });
const fisiere = unzipSync(zip);
const numeleTuturor = Object.keys(fisiere).join("\n");
const totContinutul = Object.values(fisiere).map(text).join("\n");
{
  e("codul de acces nu e în arhivă", !totContinutul.includes("COL-SECRET-1"));
  e("jetonul nu e în arhivă", !totContinutul.includes("nu-trebuie-sa-plece"));
  e("cheia de sesiune nu e nici măcar în numele fișierelor", !numeleTuturor.includes("JETON-VIU-123"));
  e("codul de instalare nu apare", !numeleTuturor.includes("PAA-9times"));
  e("dar numele omului rămâne — asta se restaurează", totContinutul.includes("Ana Popescu"));
  e("și nota de la examen", totContinutul.includes('"nota": 9'));
  e("și motivul contestației", totContinutul.includes("două răspunsuri bune"));
}

console.log("— ce e trecător se sare, și se numără —");
{
  e("cinci chei trecătoare sărite", rezumat.sarite === 5, String(rezumat.sarite));
  for (const p of PREFIXE_SARITE) e("prefix trecător recunoscut: " + p, eSarita(p + "orice"));
  e("o cheie obișnuită NU se sare", !eSarita("candidat/ana"));
  e("nici una care doar seamănă", !eSarita("sesiune-examen/1"));
}

console.log("— ce se poate reface din original se sare, dar se spune pe nume —");
{
  e("paginile de material nu sunt în arhivă", !numeleTuturor.includes("material-studiu"));
  e("dar sunt trecute în cuprins", text(fisiere["CUPRINS.md"]).includes("material-studiu/pag-001"));
  e("recunoscute ca derivate", eDerivata("material-studiu/pag-003"));
}

console.log("— fișierele oamenilor intră, iar ce nu încape e scris pe nume —");
{
  e("un fișier a intrat", rezumat.fisiere === 1, String(rezumat.fisiere));
  e("celălalt e trecut ca omis", rezumat.fisiereOmise.length === 1, JSON.stringify(rezumat.fisiereOmise));
  e("omisul apare în cuprins, pe nume", /ATENȚIE — fișiere NEINCLUSE/.test(text(fisiere["CUPRINS.md"])));
  e("fișierul intrat are extensia lui reală", numeleTuturor.includes(".jpg"));
}

console.log("— toate fișele intră, oricât ar fi de strâmtă limita de fișiere —");
{
  e("patru fișe arhivate", rezumat.inregistrari === 4, String(rezumat.inregistrari));
  for (const k of ["candidat/ana", "examen/2026-1", "contestatie-examen/7", "arbitru/abc"])
    e("fișa „" + k + "\" e în arhivă", numeleTuturor.includes("date/" + k + ".json"));
}

console.log("— o magazie moartă nu doboară copia —");
{
  const stricata = { async list() { throw new Error("magazia nu răspunde"); } };
  const r = await arhiveazaMagazia("cursuri", { store: stricata });
  e("întoarce o arhivă, nu o excepție", r.zip instanceof Uint8Array);
  e("cu eroarea scrisă în cuprins", r.rezumat.erori.length === 1);
}

console.log("— lista magaziilor acoperă tot ce nu e registrul —");
{
  const nume = MAGAZII.map((m) => m.nume);
  for (const m of ["cursuri", "expozitii", "jcr", "paa", "interese", "breed", "acte-revocate"])
    e("magazia „" + m + "\" e în listă", nume.includes(m));
  e("registrul NU e aici (are copia lui)", !nume.includes("registru"));
  e("fiecare magazie are scris ce ține", MAGAZII.every((m) => m.ce && m.ce.length > 20));
}

console.log(rau ? rau + " căzute" : "toate trecute");
process.exit(rau ? 1 : 0);
