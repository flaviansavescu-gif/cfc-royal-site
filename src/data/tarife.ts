// =========================================================================
// tarife.ts — tarifele asociației, sursă unică pentru tot site-ul.
//
// De ce un fișier de date și nu text scris în pagini: aceleași sume apar la
// „Cotizații", la „Devino membru", pe pagina de tarife și, în etapa următoare,
// în formularul de înscriere. Scrise de mână în fiecare loc, o modificare de
// tarif lasă în urmă o pagină cu prețul vechi — și tocmai pe aceea o găsește
// cineva. Aici se schimbă o singură cifră.
//
// Sursa: lista de tarife a asociației, în vigoare de la 1 ianuarie 2026.
// Tarifele vechi NU se șterg la o schimbare: se mută în ISTORIC, fiindcă o
// cerere depusă sub tariful trecut se taxează la tariful de atunci.
// =========================================================================

export type Moneda = "RON" | "EUR";

/** Un rând din lista de tarife. */
export interface Tarif {
  /** Identificator stabil — pe el se sprijină restul codului, nu pe poziția din listă. */
  id: string;
  eticheta: { ro: string; en: string };
  /** Suma. `null` înseamnă că poziția nu e o sumă (gratuit sau reducere). */
  valoare: number | null;
  moneda?: Moneda;
  fel: "suma" | "gratuit" | "reducere";
  /** Doar pentru `fel: "reducere"` — procentul scăzut din suma finală. */
  procent?: number;
  nota?: { ro: string; en: string };
}

export interface GrupaTarife {
  id: string;
  titlu: { ro: string; en: string };
  intro?: { ro: string; en: string };
  tarife: Tarif[];
}

/** Data de la care se aplică lista de mai jos (ISO, pentru afișare și arhivare). */
export const VALABIL_DE = "2026-01-01";

/** Prețurile sunt finale: asociația nu este plătitoare de TVA. */
export const FARA_TVA = true;

// —————————————————————————————————————————————————————————————————————————
// Lista
// —————————————————————————————————————————————————————————————————————————

export const GRUPE: GrupaTarife[] = [
  {
    id: "membru",
    titlu: { ro: "Calitatea de membru", en: "Membership" },
    intro: {
      ro: "Taxa de înscriere reprezintă totodată cotizația anuală și acoperă 12 luni de la data plății.",
      en: "The joining fee is also the annual membership fee and covers 12 months from the date of payment.",
    },
    tarife: [
      {
        id: "cotizatie-anuala",
        eticheta: {
          ro: "Cotizație anuală / taxă de înscriere ca membru",
          en: "Annual membership fee / joining fee",
        },
        valoare: 100,
        moneda: "RON",
        fel: "suma",
      },
      {
        id: "reducere-student-membru",
        eticheta: {
          ro: "Reducere pentru studenți la taxa de înscriere ca membru nou",
          en: "Student discount on the joining fee for new members",
        },
        valoare: null,
        fel: "reducere",
        procent: 10,
        nota: {
          ro: "Se acordă pe baza carnetului de student sau a unei adeverințe de la instituția de învățământ.",
          en: "Granted on presentation of a student card or a certificate issued by the educational institution.",
        },
      },
      {
        id: "membru-rezident-strain-primul-an",
        eticheta: {
          ro: "Înscrierea ca membru pentru persoanele cu rezidența în altă țară, indiferent de cetățenie — primele 12 luni",
          en: "Membership for people resident abroad, regardless of citizenship — first 12 months",
        },
        valoare: null,
        fel: "gratuit",
      },
      {
        id: "cotizatie-rezident-strain",
        eticheta: {
          ro: "Cotizația anuală pentru persoanele cu rezidența în altă țară, după expirarea gratuității primelor 12 luni",
          en: "Annual membership fee for people resident abroad, after the free first 12 months",
        },
        valoare: 19,
        moneda: "EUR",
        fel: "suma",
        nota: {
          ro: "Se achită în lei, la cursul de schimb din ziua plății.",
          en: "Payable in Romanian lei, at the exchange rate of the day of payment.",
        },
      },
    ],
  },

  {
    id: "registru",
    titlu: { ro: "Registrul genealogic și canise", en: "Stud book and kennels" },
    tarife: [
      {
        id: "pedigree",
        eticheta: { ro: "Eliberarea unui pedigree (per exemplar)", en: "Issuing a pedigree (per dog)" },
        valoare: 50,
        moneda: "RON",
        fel: "suma",
      },
      {
        id: "afix",
        eticheta: { ro: "Afix de crescător", en: "Kennel name (affix)" },
        valoare: 250,
        moneda: "RON",
        fel: "suma",
      },
      {
        id: "pedigree-urgenta",
        eticheta: {
          ro: "Taxă de urgență pentru eliberarea pedigreeului (termen de execuție 3 zile lucrătoare)",
          en: "Express fee for issuing a pedigree (3 working days)",
        },
        valoare: 500,
        moneda: "RON",
        fel: "suma",
      },
      {
        id: "prioripost",
        eticheta: {
          ro: "Transmiterea documentelor prin Prioripost (livrare rapidă, Poșta Română)",
          en: "Document delivery by Prioripost (Romanian Post express service)",
        },
        valoare: 20,
        moneda: "RON",
        fel: "suma",
      },
      {
        id: "corectare-pedigree",
        eticheta: {
          ro: "Corectarea unui pedigree eliberat cu erori generate de neatenția solicitantului",
          en: "Correcting a pedigree issued with errors caused by the applicant",
        },
        valoare: 50,
        moneda: "RON",
        fel: "suma",
      },
      {
        id: "pedigree-tip-c-jurizare",
        eticheta: {
          ro: "Jurizarea și eliberarea unui pedigree de tip C, când la înscriere nu a fost ales arbitrajul pentru tipicitate",
          en: "Judging and issuing a type C pedigree, when typicality judging was not selected at entry",
        },
        valoare: 80,
        moneda: "RON",
        fel: "suma",
      },
      {
        id: "carnet-palmares",
        eticheta: { ro: "Carnet de performanță Palmares", en: "Palmares performance booklet" },
        valoare: 15,
        moneda: "RON",
        fel: "suma",
      },
      {
        id: "carnet-starter-pack",
        eticheta: {
          ro: "Carnet de performanță Starter Pack (se comandă exclusiv pentru puii menționați în declarația de montă și fătare)",
          en: "Starter Pack performance booklet (available only for puppies listed in a mating and whelping declaration)",
        },
        valoare: 5,
        moneda: "RON",
        fel: "suma",
      },
    ],
  },

  {
    id: "expozitii",
    titlu: { ro: "Înscrierea în expoziții", en: "Dog show entries" },
    intro: {
      ro: "Taxa depinde de tipul expoziției, de calitatea de membru și de numărul de câini înscriși de același proprietar.",
      en: "The fee depends on the type of show, on membership status and on the number of dogs entered by the same owner.",
    },
    tarife: [
      {
        id: "expo-cac-primul-membru",
        eticheta: { ro: "Expoziție C.A.C. — primul câine, membru", en: "C.A.C. show — first dog, member" },
        valoare: 100, moneda: "RON", fel: "suma",
      },
      {
        id: "expo-cac-urmatorii-membru",
        eticheta: { ro: "Expoziție C.A.C. — fiecare câine următor, membru", en: "C.A.C. show — each further dog, member" },
        valoare: 50, moneda: "RON", fel: "suma",
      },
      {
        id: "expo-cac-primul-nemembru",
        eticheta: { ro: "Expoziție C.A.C. — primul câine, nemembru", en: "C.A.C. show — first dog, non-member" },
        valoare: 120, moneda: "RON", fel: "suma",
      },
      {
        id: "expo-cac-urmatorii-nemembru",
        eticheta: { ro: "Expoziție C.A.C. — fiecare câine următor, nemembru", en: "C.A.C. show — each further dog, non-member" },
        valoare: 60, moneda: "RON", fel: "suma",
      },
      {
        id: "expo-cacib-primul-membru",
        eticheta: { ro: "Expoziție C.A.C.I.B. — primul câine, membru", en: "C.A.C.I.B. show — first dog, member" },
        valoare: 120, moneda: "RON", fel: "suma",
      },
      {
        id: "expo-cacib-urmatorii-membru",
        eticheta: { ro: "Expoziție C.A.C.I.B. — fiecare câine următor, membru", en: "C.A.C.I.B. show — each further dog, member" },
        valoare: 60, moneda: "RON", fel: "suma",
      },
      {
        id: "expo-cacib-primul-nemembru",
        eticheta: { ro: "Expoziție C.A.C.I.B. — primul câine, nemembru", en: "C.A.C.I.B. show — first dog, non-member" },
        valoare: 150, moneda: "RON", fel: "suma",
      },
      {
        id: "expo-cacib-urmatorii-nemembru",
        eticheta: { ro: "Expoziție C.A.C.I.B. — fiecare câine următor, nemembru", en: "C.A.C.I.B. show — each further dog, non-member" },
        valoare: 75, moneda: "RON", fel: "suma",
      },
      {
        id: "reducere-student-expo",
        eticheta: {
          ro: "Reducere suplimentară pentru studenți, aplicată sumei finale de înscriere în expoziții",
          en: "Additional student discount, applied to the final show entry amount",
        },
        valoare: null,
        fel: "reducere",
        procent: 10,
        nota: {
          ro: "Se acordă pe baza carnetului de student sau a unei adeverințe de la instituția de învățământ.",
          en: "Granted on presentation of a student card or a certificate issued by the educational institution.",
        },
      },
    ],
  },

  {
    id: "contestatii",
    titlu: { ro: "Contestații", en: "Appeals" },
    tarife: [
      {
        id: "contestatie",
        eticheta: { ro: "Depunerea unei contestații", en: "Filing an appeal" },
        valoare: 250,
        moneda: "RON",
        fel: "suma",
      },
    ],
  },
];

// —————————————————————————————————————————————————————————————————————————
// Reguli — la fel de importante ca prețurile
// Preluate din lista oficială de tarife semnată la 1 ianuarie 2026.
// —————————————————————————————————————————————————————————————————————————

export interface Regula { id: string; text: { ro: string; en: string }; accent?: boolean }

export const REGULI: Regula[] = [
  {
    id: "tipicitate-gratuit",
    text: {
      ro: "Pedigreele de tipicitate se eliberează pe loc și gratuit, în baza arbitrajului de specialitate organizat în cadrul expozițiilor.",
      en: "Typicality pedigrees are issued on the spot and free of charge, following the specialist judging held during shows.",
    },
  },
  {
    id: "export",
    text: {
      ro: "Prețul pedigreelor de export este același cu cel al pedigreelor naționale.",
      en: "Export pedigrees cost the same as national pedigrees.",
    },
  },
  {
    id: "termen",
    text: {
      ro: "Termenul de eliberare a documentelor este de 1–3 luni, cu excepția cazurilor în care se achită taxa de urgență.",
      en: "Documents are issued within 1 to 3 months, unless the express fee is paid.",
    },
  },
  {
    id: "conditie-eliberare",
    accent: true,
    text: {
      ro: "Cu excepția pedigreelor de tip C, asociația nu eliberează documente solicitanților care nu sunt înscriși în asociație și nici membrilor care nu au înregistrat cel puțin o prezență la expozițiile organizate în ultimele 12 luni până la data solicitării.",
      en: "With the exception of type C pedigrees, the association does not issue documents to applicants who are not members, nor to members who have not attended at least one show organised in the 12 months preceding the request.",
    },
  },
];

// —————————————————————————————————————————————————————————————————————————
// Ajutoare
// —————————————————————————————————————————————————————————————————————————

const TOATE: Tarif[] = GRUPE.flatMap((g) => g.tarife);

/** Caută un tarif după id. Aruncă dacă id-ul nu există: mai bine cade build-ul
 *  decât să apară pe site un preț gol. */
export function tarif(id: string): Tarif {
  const t = TOATE.find((x) => x.id === id);
  if (!t) throw new Error("Tarif inexistent: " + id);
  return t;
}

/** Suma unui tarif, pentru calcule. */
export function suma(id: string): number {
  const t = tarif(id);
  if (t.valoare === null) throw new Error("Tariful nu este o sumă: " + id);
  return t.valoare;
}

/** Prețul, scris cum se scrie în limba paginii: „100 lei", „19 EUR", „gratuit", „−10%". */
export function pret(t: Tarif, lang: "ro" | "en"): string {
  if (t.fel === "gratuit") return lang === "en" ? "free" : "gratuit";
  if (t.fel === "reducere") return "−" + (t.procent ?? 0) + "%";
  const unitate = t.moneda === "EUR" ? "EUR" : lang === "en" ? "RON" : "lei";
  return t.valoare + " " + unitate;
}
