// =========================================================================
// titluri-externe.ts — titlurile de campion al României acordate ÎN AFARA României,
// de arbitri ai Asociației Club Federal Chinologic – Royal.
//
// DE UNDE VIN. Nu din Managerul de Expoziții: expozițiile astea sunt organizate de alte
// federații, iar arbitrul nostru le duce pe hârtie. Fiecare eveniment se încheie cu o
// „Fișă de evidență a titlurilor", semnată de arbitru și confirmată de organizator.
// Fișa e documentul justificativ; ce se vede în pagină e transcrierea ei.
//
// CE NU SE PUBLICĂ. Fișa conține numele proprietarilor și microcipurile. Politica de
// confidențialitate spune că rezultatele publice cuprind DOAR titlurile — așa că fișa se
// publică cu acele două coloane acoperite, iar aici nu există câmp pentru ele. Nu e o
// scăpare că lipsesc; e o hotărâre.
//
// TRANSCRIERE DE MÂNĂ. Fișele se completează cu pixul, la fața locului. Numele străine
// scrise de mână se pot citi greșit — de aceea pagina spune limpede că e o transcriere și
// cum se cere o îndreptare.
// =========================================================================

export type Titlu = "RO_CH" | "RO_JR_CH";

export const NUME_TITLU: Record<Titlu, { ro: string; en: string; scurt: string }> = {
  RO_CH: { ro: "Campion al României", en: "Romanian Champion", scurt: "RO. CH." },
  RO_JR_CH: { ro: "Campion Junior al României", en: "Romanian Junior Champion", scurt: "RO. JR. CH." },
};

export interface Exemplar {
  nr: number;
  caine: string;
  /** Rasa în română și engleză, plus cum a fost scrisă pe fișă (de regulă, în limba țării gazdă). */
  rasa: { ro: string; en: string; original?: string };
  sex: "M" | "F";
  titlu: Titlu;
}

export interface FisaTitluri {
  id: string;
  eveniment: string;
  organizator: string;
  localitate: string;
  tara: { ro: string; en: string };
  /** ISO, ziua expoziției. */
  data: string;
  tipExpozitie: string;
  arbitru: string;
  licentaWdf: string;
  calitate: { ro: string; en: string };
  /** Fișa semnată, cu datele personale acoperite. Cale în /public. */
  dovada: string;
  exemplare: Exemplar[];
}

export const FISE: FisaTitluri[] = [
  {
    id: "wegierska-gorka-2026-06-21",
    eveniment: "Międzynarodowa Wystawa Psów Rasowych o Championat Rumunii",
    organizator: "Kynologia Polska",
    localitate: "Węgierska Górka",
    tara: { ro: "Polonia", en: "Poland" },
    data: "2026-06-21",
    tipExpozitie: "CACIB",
    arbitru: "Mihail Cosmin Neagu",
    licentaWdf: "019/2025",
    calitate: { ro: "Federated Expert Judge WDF", en: "Federated Expert Judge WDF" },
    dovada: "/documente/fisa-titluri-polonia-2026-06-21.pdf",
    exemplare: [
      { nr: 1, caine: "Hakim Benito del Gusto", rasa: { ro: "Yorkshire Terrier", en: "Yorkshire Terrier", original: "chocolate YT" }, sex: "M", titlu: "RO_CH" },
      { nr: 2, caine: "Nikita Lejdis", rasa: { ro: "Caniche Toy", en: "Toy Poodle", original: "pudel toy" }, sex: "F", titlu: "RO_CH" },
      { nr: 3, caine: "Zerrin z Różanego Ogrodu", rasa: { ro: "Yorkshire Terrier", en: "Yorkshire Terrier", original: "chocolate YT" }, sex: "F", titlu: "RO_CH" },
      { nr: 4, caine: "Teodor Amato Cane", rasa: { ro: "Caniche Miniatură", en: "Miniature Poodle", original: "pudel miniatura" }, sex: "M", titlu: "RO_CH" },
      { nr: 5, caine: "Pro-Euro", rasa: { ro: "Teckel miniatură cu păr scurt", en: "Miniature Smooth-haired Dachshund", original: "jamnik miniaturowy krótkowłosy" }, sex: "F", titlu: "RO_CH" },
      { nr: 6, caine: "Herkules Royalbulls", rasa: { ro: "Buldog Englez Vechi", en: "Olde English Bulldogge", original: "buldog staroangielski" }, sex: "M", titlu: "RO_CH" },
      { nr: 7, caine: "Oto Bajers", rasa: { ro: "Boston Terrier", en: "Boston Terrier", original: "boston terrier" }, sex: "M", titlu: "RO_CH" },
      { nr: 8, caine: "Hazal z Różanego Ogrodu", rasa: { ro: "Ciobănesc German cu păr lung", en: "German Shepherd, long-haired", original: "owczarek niemiecki długowłosy" }, sex: "F", titlu: "RO_CH" },
      { nr: 9, caine: "Elektra Szachty Litewskie", rasa: { ro: "Ciobănesc German cu păr lung", en: "German Shepherd, long-haired", original: "owczarek niemiecki długowłosy" }, sex: "F", titlu: "RO_CH" },
      { nr: 10, caine: "Brita Ranczo u Jacka", rasa: { ro: "Ciobănesc German cu păr scurt", en: "German Shepherd, short-haired", original: "owczarek niemiecki krótkowłosy" }, sex: "F", titlu: "RO_CH" },
      { nr: 11, caine: "Roza Zoti Funella", rasa: { ro: "Caniche Miniatură", en: "Miniature Poodle", original: "pudel miniatura" }, sex: "F", titlu: "RO_JR_CH" },
      { nr: 12, caine: "Marie Zofie Spero Meliora", rasa: { ro: "Ratier de Praga", en: "Prague Ratter", original: "ratler praski" }, sex: "F", titlu: "RO_JR_CH" },
      { nr: 13, caine: "Amy", rasa: { ro: "Doberman", en: "Dobermann", original: "doberman" }, sex: "F", titlu: "RO_CH" },
    ],
  },
];

/** Câte titluri de fiecare fel are o fișă. Se calculează, nu se scrie de mână: numărul
 *  scris de mână pe hârtie și lista de mai sus trebuie să spună același lucru. */
export function numaraTitluri(fisa: FisaTitluri) {
  const n = { RO_CH: 0, RO_JR_CH: 0 };
  for (const e of fisa.exemplare) n[e.titlu]++;
  return { ...n, total: fisa.exemplare.length };
}

/** Totalul pe toate fișele. */
export function totalTitluri() {
  return FISE.reduce(
    (t, f) => {
      const n = numaraTitluri(f);
      return { RO_CH: t.RO_CH + n.RO_CH, RO_JR_CH: t.RO_JR_CH + n.RO_JR_CH, total: t.total + n.total };
    },
    { RO_CH: 0, RO_JR_CH: 0, total: 0 },
  );
}
