// Normele de participare la expoziții — sursă unică.
//
// DE CE AICI, ȘI NU ÎN COMPONENTĂ. Proiectul de Condiții de participare cere, la Art. 3
// alin. (2), să se rețină odată cu înscrierea „versiunea Condițiilor acceptate și momentul
// acceptării". Peste un an, la o contestație, întrebarea nu e „a bifat?", ci „ce a bifat?".
//
// Dacă versiunea ar fi un număr scris cu mâna alături de text, primul care schimbă o
// virgulă și uită să-l urce ar face ca două texte diferite să poarte aceeași versiune —
// exact minciuna pe care marcajul trebuia să o împiedice. Aici versiunea SE CALCULEAZĂ din
// text: se schimbă textul, se schimbă versiunea, fără să depindă de memoria nimănui.
//
// Formularul (src/components/InscriereExpo.astro) afișează listele de mai jos; funcția de
// înscriere (inscriere-expo.mjs) scrie versiunea în fișa înscrierii. Amândouă citesc de
// aici, deci nu au cum să arate una și să rețină alta.
import { createHash } from "node:crypto";

/** Rezumatul obligațiilor, în românește. Ordinea contează: intră în versiune. */
export const NORME_RO = [
  "prezint la intrare actul de origine al câinelui (sau dovada înscrierii pentru tipicitate) și carnetul de sănătate cu vaccinările valabile; microcipul corespunde întocmai actelor;",
  "datele declarate aici — identitatea câinelui, data nașterii, clasa — sunt adevărate;",
  "judecata arbitrului este finală: nu o comentez, nu încerc să o influențez și nu tulbur desfășurarea arbitrajului;",
  "nu prezint un câine agresiv sau bolnav și nu folosesc substanțe ori tehnici de prezentare interzise;",
  "țin câinele în lesă în toată incinta, inclusiv în ring; rămâne în paza mea și răspund pentru pagubele produse de el;",
  "bunăstarea câinelui primează asupra oricărui rezultat;",
  "nu aduc femele în călduri sau care alăptează — nu sunt admise în expozițiile CFC-Royal;",
  "prezint câini numai de la 16 ani împliniți, iar la Junior Handling de la 10 ani, însoțit de un părinte sau de reprezentantul legal;",
  "mă port cuviincios cu arbitrii, cu oficialii, cu ceilalți participanți și cu publicul.",
];

/** Aceleași obligații, în engleză. NU intră în versiune — vezi mai jos de ce. */
export const NORME_EN = [
  "at the entrance I will present the dog's pedigree (or proof of entry for a typicality pedigree) and the health booklet with valid vaccinations; the microchip matches the documents exactly;",
  "the details declared here — the dog's identity, date of birth, class — are true;",
  "the judge's decision is final: I will not comment on it, will not try to influence it, and will not disrupt the judging;",
  "I will not present an aggressive or sick dog, and will not use prohibited substances or presentation techniques;",
  "I will keep the dog on a lead throughout the venue, including in the ring; it stays in my care and I am liable for any damage it causes;",
  "the dog's welfare comes before any result;",
  "I will not bring bitches in season or nursing bitches — they are not admitted to CFC-Royal shows;",
  "I will handle dogs only from the age of 16, and in Junior Handling from the age of 10, accompanied by a parent or legal representative;",
  "I will behave decently towards judges, officials, other participants and the public.",
];

/**
 * Versiunea normelor: primele 8 cifre hexazecimale din amprenta textului românesc.
 *
 * Numai româna intră în socoteală, fiindcă româna e textul care obligă; engleza e
 * traducerea lui. Altfel, o îndreptare de engleză ar da o versiune nouă unor norme
 * nemodificate, iar fișele vechi ar părea că privesc alt document decât privesc.
 */
export const versiuneaNormelor = () =>
  createHash("sha256").update(NORME_RO.join("\n"), "utf8").digest("hex").slice(0, 8);
