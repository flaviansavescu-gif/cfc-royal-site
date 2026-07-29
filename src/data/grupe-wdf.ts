// grupe-wdf.ts — cele 10 grupe de rase ale World Dog Federation (WDF),
// conform wdf-international.org/breeds/. Denumiri oficiale WDF (NU FCI).
// Folosite de autorizarea arbitrilor pe grupe în Școala de Arbitraj.
export interface GrupaWDF {
  nr: number;
  ro: string;
  en: string;
}

export const GRUPE_WDF: GrupaWDF[] = [
  { nr: 1, ro: "Câini ciobănești și de cireadă (excl. cei elvețieni)", en: "Shepherd Dogs and Cattle Dogs (excl. Swiss Cattle Dogs)" },
  { nr: 2, ro: "Câini tip Pinscher și Schnauzer – Molosoizi și câini de cireadă elvețieni", en: "Pinscher and Schnauzer Type – Molossoids and Swiss Cattle Dogs" },
  { nr: 3, ro: "Câini tip Terrier", en: "Terrier Type Dogs" },
  { nr: 4, ro: "Câini tip Bull", en: "Bull Type Dogs" },
  { nr: 5, ro: "Câini de tip primitiv", en: "Dogs of the Primitive Type" },
  { nr: 6, ro: "Copoi și câini de urmă de sânge", en: "Hounds and Dogs for Blood Tracking" },
  { nr: 7, ro: "Câini de aret (pointeri)", en: "Pointing Dogs" },
  { nr: 8, ro: "Retrieveri, câini de scos vânatul și câini de apă", en: "Retrievers, Flushing Dogs and Water Dogs" },
  { nr: 9, ro: "Câini de companie și de agrement", en: "Companion and Toy Dogs" },
  { nr: 10, ro: "Ogari", en: "Sighthounds" },
];
