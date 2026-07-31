// arhiva-rase.test.mjs — legarea raselor din arhiva de hârtie la nomenclatorul WDF.
//
// Probele de aici păzesc două greșeli ADEVĂRATE, prinse la citirea Arhivei 1 înainte de a
// scrie ceva în registru. Amândouă ar fi trecut neobservate și ar fi înscris o origine
// falsă, moștenită apoi de toți descendenții exemplarului:
//
//   1. potrivirea ‹după cel mai apropiat nume› a dat ‹Ciobănesc German› pentru un cuib
//      de Ciobănesc Belgian Malinois;
//   2. cu rasa preferată înaintea varietății, cuibul 19 (rasa ‹Ciobănesc de Asia
//      Centrală", varietatea ‹Volkodav› — amândouă rase în nomenclator) intra sub numele
//      general, pierzând tocmai precizarea pentru care există câmpul de varietate.
//
// Rulează: node scripts/arhiva-rase.test.mjs
import { potriveste } from "./arhiva-rase.mjs";

let rau = 0;
const t = (nume, bun, info) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + (!bun && info != null ? " -> " + info : ""));
};

// Un nomenclator mic, dar cu exact capcanele din cel adevărat.
const RASE = [
  { ro: "Ciobănesc German", en: "German Shepherd Dog", g: 1 },
  { ro: "Ciobănesc Belgian Malinois", en: "Belgian Shepherd Malinois", g: 1 },
  { ro: "Ciobănesc Belgian Tervuren", en: "Belgian Shepherd Tervuren", g: 1 },
  { ro: "Ciobănesc de Asia Centrală", en: "Central Asian Shepherd Dog", g: 2 },
  { ro: "Volkodav", en: "Volkodav", g: 2 },
  { ro: "Bulldog Francez", en: "French Bulldog", g: 4 },
  { ro: "American Bully Pocket", en: "American Bully Pocket", g: 4 },
  { ro: "American Bully XL", en: "American Bully XL", g: 4 },
  { ro: "Pomeranian", en: "Pomeranian", g: 5 },
  { ro: "Spitz German Mijlociu", en: "German Spitz Mittel", g: 5 },
  { ro: "Labrador Retriever", en: "Labrador Retriever", g: 8 },
  { ro: "Beagle", en: "Beagle", g: 6 },
];
const p = (rasa, varietate) => potriveste(rasa, varietate, RASE);

console.log("— potrivirea exactă, pe rasă —");
{
  t("nume identic", p("Beagle", "").rasa?.ro === "Beagle");
  t("majusculele nu contează", p("BEAGLE", "").rasa?.ro === "Beagle");
  t("diacriticele lipsă nu contează", p("CIOBANESC GERMAN", "").rasa?.ro === "Ciobănesc German");
  t("numele englezesc merge la fel", p("French Bulldog", "").rasa?.ro === "Bulldog Francez");
}

console.log("— varietatea restrânge: rasă + varietate —");
{
  const r = p("Ciobănesc Belgian", "Malinois");
  t("Ciobănesc Belgian + Malinois -> Malinois", r.rasa?.ro === "Ciobănesc Belgian Malinois", r.rasa?.ro);
  t("s-a ajuns prin rasă + varietate", r.prin === "rasă + varietate", r.prin);
  // Fără varietate, ‹Ciobănesc Belgian› nu e o rasă din nomenclator: se OPREȘTE.
  const singur = p("Ciobănesc Belgian", "");
  t("‹Ciobănesc Belgian› singur nu se potrivește cu nimic", !!singur.eroare, JSON.stringify(singur.rasa));
  t("dar arată variantele apropiate", (singur.apropiate || []).length > 0);
  // Capcana numărul 1, pusă la probă: NU are voie să ajungă la Ciobănesc German.
  t("NU alege ‹Ciobănesc German› pentru un Belgian",
    singur.rasa?.ro !== "Ciobănesc German", singur.rasa?.ro);

  t("American Bully + Pocket -> Pocket", p("American Bully", "Pocket").rasa?.ro === "American Bully Pocket");
  t("aceeași rasă, altă varietate -> altă rasă", p("American Bully", "XL").rasa?.ro === "American Bully XL");
}

console.log("— varietatea singură, când ea numește rasa —");
{
  // Capcana numărul 2: la cuibul 19 se potriveau AMÂNDOUĂ exact. Câștigă cea precisă.
  const r = p("Ciobănesc de Asia Centrală", "Volkodav");
  t("Asia Centrală + Volkodav -> Volkodav", r.rasa?.ro === "Volkodav", r.rasa?.ro);
  t("s-a ajuns prin varietate", r.prin === "varietate", r.prin);
  t("fără varietate rămâne rasa generală",
    p("Ciobănesc de Asia Centrală", "").rasa?.ro === "Ciobănesc de Asia Centrală");
  t("fără varietate rămâne rasa generală și cu liniuță",
    p("Ciobănesc de Asia Centrală", "-").rasa?.ro === "Ciobănesc de Asia Centrală");

  // ‹German Spitz› nu e în nomenclator, dar varietatea ‹Pomeranian› e.
  t("German Spitz + Pomeranian -> Pomeranian", p("German Spitz", "Pomeranian").rasa?.ro === "Pomeranian");
  t("scris cu bară și etichetă de limbă",
    p("GERMAN SPITZ / (RO) SPITZ GERMAN", "POMERANIAN").rasa?.ro === "Pomeranian");
}

console.log("— varietatea care NU e rasă lasă rasa în pace —");
{
  const r = p("Ciobănesc German", "Păr Scurt");
  t("‹Păr Scurt› nu schimbă rasa", r.rasa?.ro === "Ciobănesc German", r.rasa?.ro);
  t("s-a ajuns prin rasă", r.prin === "rasă", r.prin);
}

console.log("— greșelile de tastare: o literă, și numai dacă e neîndoielnic —");
{
  t("‹Buldog Francez\› -> Bulldog Francez", p("Buldog Francez", "").rasa?.ro === "Bulldog Francez");
  t("‹Bulldog Fancez\› -> Bulldog Francez", p("Bulldog Fancez", "").rasa?.ro === "Bulldog Francez");
  t("‹Labrador Retriver\› -> Labrador Retriever", p("Labrador Retriver", "").rasa?.ro === "Labrador Retriever");
  t("corectura e semnalată ca atare", p("Buldog Francez", "").cum === "tastare");

  // Două rase la fel de aproape: mai bine oprim decât să dăm cu banul. ‹American Bully›
  // e la distanță mică și de Pocket, și de XL — dar nu e niciuna dintre ele.
  const ambiguu = p("American Bully", "");
  t("un nume la fel de aproape de două rase se oprește", !!ambiguu.eroare, ambiguu.rasa?.ro);

  // Numele scurte nu se corectează: o literă schimbată face din ele altă rasă.
  t("numele scurte nu se ghicesc", !!p("Beagl", "").eroare, p("Beagl", "").rasa?.ro);
}

console.log("— ce nu se cunoaște se OPREȘTE, nu se ghicește —");
{
  const r = p("Rasă Care Nu Există Nicăieri", "");
  t("nicio potrivire -> eroare", !!r.eroare);
  t("eroarea numește ce s-a citit", r.eroare.includes("Rasă Care Nu Există Nicăieri"));
  t("propune variante pentru om", Array.isArray(r.apropiate) && r.apropiate.length > 0);
  t("rasa goală se oprește", !!p("", "").eroare);
}

console.log(rau ? rau + " căzute" : "toate trecute");
process.exit(rau ? 1 : 0);
