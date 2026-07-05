// =========================================================================
// cursuri.ts — datele platformei de cursuri a Școlii de Arbitraj (CFC-Royal).
// Platforma trăiește sub /cursuri/ (RO, protejată cu cod de acces).
// Întrebările de test NU conțin răspunsurile corecte — cheile de corectare
// stau exclusiv pe server, în netlify/functions/test-modul.js.
// =========================================================================

export interface Lectura {
  titlu: string;
  url: string; // pagină publică de pe site (regulamente/documente)
}

export interface Intrebare {
  text: string;
  optiuni: string[]; // fără marcarea răspunsului corect
}

export interface Modul {
  slug: string; // cursuri/<slug>/
  nr: number;
  titlu: string;
  obiectiv: string;
  lecturi: Lectura[];
  intrebari?: Intrebare[]; // prezent doar dacă testul e activ
}

const REG = "/ro/regulamente/";
const DOC = "/ro/documente/";

export const MODULE: Modul[] = [
  {
    slug: "modul-1",
    nr: 1,
    titlu: "Rolul, etica și conduita arbitrului",
    obiectiv:
      "Înțelegerea responsabilității arbitrului: imparțialitate, incompatibilități, cadouri și favoruri, conduita în arenă și comunicarea deciziilor.",
    lecturi: [
      { titlu: "Codul Etic — Capitolul V: Etica în arbitraj", url: DOC + "cod-etic/" },
      { titlu: "Comportamentul și etica în ring", url: REG + "comportamentul-si-etica-in-ring/" },
      { titlu: "Ce au voie și ce nu au voie să facă handlerii și expozanții", url: REG + "ce-au-voie-si-nu-au-voie-sa-faca-handlerii-si-expozantii/" },
      { titlu: "Regulamentul Colegiului de Arbitri", url: DOC + "regulamentul-colegiului-de-arbitri/" },
    ],
    intrebari: [
      {
        text: "Arbitrul evaluează câinii exclusiv pe baza:",
        optiuni: [
          "standardului de rasă, regulamentelor tehnice și observațiilor directe din arenă",
          "preferințelor personale și a reputației câinelui",
          "palmaresului obținut la expozițiile anterioare",
        ],
      },
      {
        text: "Înainte de judecată, arbitrului îi este interzis:",
        optiuni: [
          "să studieze standardele raselor pe care le va arbitra",
          "să consulte poziția altor arbitri sau a persoanelor interesate",
          "să verifice programul expoziției",
        ],
      },
      {
        text: "Comunicarea cu proprietarii sau handlerii pe durata competiției este permisă:",
        optiuni: [
          "liber, fără restricții",
          "doar în afara ringului",
          "doar în limita strictului necesar tehnic",
        ],
      },
      {
        text: "Un arbitru poate judeca un câine pe care l-a deținut sau crescut în ultimele 12 luni?",
        optiuni: [
          "Nu",
          "Da, dacă anunță organizatorul",
          "Da, dacă respectivul câine concurează în altă grupă",
        ],
      },
      {
        text: "Câinii rudelor arbitrului, până la gradul II inclusiv:",
        optiuni: [
          "pot fi judecați fără restricții",
          "nu pot fi judecați de acel arbitru",
          "pot fi judecați doar la expoziții naționale",
        ],
      },
      {
        text: "Practica „arbitrajului reciproc” — doi arbitri își judecă alternativ câinii, sistematic, în scop de avantaj reciproc — este:",
        optiuni: [
          "permisă, dacă este declarată în scris",
          "tolerată la expozițiile mici",
          "interzisă",
        ],
      },
      {
        text: "Arbitrul poate accepta de la organizator:",
        optiuni: [
          "orice cadou primit înainte de judecată",
          "cazarea, masa, transportul în condiții uzuale, onorariul contractual și obiecte simbolice de protocol",
          "sume suplimentare oferite de expozanți",
        ],
      },
      {
        text: "O ofertă care depășește cadrul admis trebuie:",
        optiuni: [
          "refuzată politicos și raportată în scris Vicepreședintelui Tehnic, în termen de 7 zile",
          "acceptată, dacă rămâne confidențială",
          "redirecționată către club",
        ],
      },
      {
        text: "În arenă, arbitrul examinează:",
        optiuni: [
          "mai atent câinii favoriți la titlu",
          "fiecare câine cu aceeași atenție și o durată rezonabilă, comparabilă",
          "doar câinii din clasele superioare",
        ],
      },
      {
        text: "Decizia arbitrului se comunică:",
        optiuni: [
          "clar, ferm, fără ezitări sau ambiguități",
          "doar la finalul expoziției",
          "numai în scris, prin secretariat",
        ],
      },
      {
        text: "După judecată, arbitrul:",
        optiuni: [
          "poate critica public, denigrator, deciziile altor arbitri",
          "nu comentează public deciziile altor arbitri într-un mod denigrator",
          "este obligat să justifice public fiecare calificativ acordat",
        ],
      },
      {
        text: "Acceptarea unei misiuni de arbitraj fără declararea unei incompatibilități cunoscute constituie:",
        optiuni: [
          "o simplă neglijență administrativă",
          "o practică acceptată în comunitate",
          "abatere etică gravă",
        ],
      },
    ],
  },
  {
    slug: "modul-2",
    nr: 2,
    titlu: "Structura expozițiilor și clasele de înscriere",
    obiectiv:
      "Cunoașterea claselor de vârstă și a condițiilor de eligibilitate pentru câinii tineri și adulți, inclusiv clasa Winner.",
    lecturi: [
      { titlu: "Contextul de arbitraj — clase eligibile pentru câinii tineri", url: REG + "contextul-de-arbitraj-clase-eligibile-pentru-cainii-tineri/" },
      { titlu: "Contextul de arbitraj — câine adult eligibil", url: REG + "contextul-de-arbitraj-caine-adult-eligibil/" },
      { titlu: "Ce înseamnă titlul „Clasa Winner” în WDF", url: REG + "ce-inseamna-titlul-clasa-winner-in-wdf/" },
    ],
  },
  {
    slug: "modul-3",
    nr: 3,
    titlu: "Titlurile WDF: CAJC, CAC, CACIB, JBOB, BOB, BBR",
    obiectiv:
      "Stăpânirea procedurilor oficiale de atribuire a titlurilor și a diferențelor dintre ele.",
    lecturi: [
      { titlu: "Procedura oficială de atribuire a titlului CAJC", url: REG + "procedura-oficiala-de-atribuire-a-titlului-cajc/" },
      { titlu: "Procedura oficială de atribuire a titlului CAC", url: REG + "procedura-oficiala-de-atribuire-a-titlului-cac/" },
      { titlu: "Procedura oficială de atribuire a titlului CACIB", url: REG + "procedura-oficiala-de-atribuire-a-titlului-cacib/" },
      { titlu: "Procedura oficială — JBOB (Best of Breed Junior)", url: REG + "procedura-oficiala-de-atribuire-a-titlului-jbob-best-of-breed-junior/" },
      { titlu: "Procedura oficială — BOB (Best of Breed)", url: REG + "procedura-oficiala-pentru-atribuirea-titlului-bob-best-of-breed/" },
      { titlu: "Procedura oficială — BBR (Best Breed Representative)", url: REG + "procedura-oficiala-pentru-atribuirea-titlului-bbr/" },
      { titlu: "Deosebirea concretă dintre BOB și BBR", url: REG + "deosebirea-concreta-dintre-bob-si-bbr/" },
      { titlu: "Titlurile oficiale de campion WDF", url: REG + "titlurile-oficiale-de-campion-wdf/" },
    ],
  },
  {
    slug: "modul-4",
    nr: 4,
    titlu: "Procedura completă de arbitraj",
    obiectiv:
      "Parcurgerea pașilor examinării: intrarea în ring, evaluarea individuală, clasarea și consemnarea calificativelor.",
    lecturi: [
      { titlu: "Procedura completă de arbitraj WDF", url: REG + "procedura-completa-de-arbitraj-wdf/" },
    ],
  },
  {
    slug: "modul-5",
    nr: 5,
    titlu: "Ringul de onoare (Best in Show)",
    obiectiv:
      "Organizarea ringului de onoare, categoriile BIS și principiile de departajare.",
    lecturi: [
      { titlu: "Ringul de onoare — arbitraj avansat", url: REG + "ringul-de-onoare-arbitraj-avansat/" },
    ],
  },
  {
    slug: "modul-6",
    nr: 6,
    titlu: "Situații speciale: DSQ, N.J., abateri",
    obiectiv:
      "Recunoașterea situațiilor care impun descalificarea (DSQ) sau calificativul „nu se poate judeca” (N.J.) și procedura de constatare a abaterilor.",
    lecturi: [
      { titlu: "Situații care impun DSQ (descalificare) sau N.J. (Not Judgable)", url: REG + "situatii-care-impun-dsq-descalificare-sau-nj-not-judgable/" },
      { titlu: "Procedura de constatare a abaterilor", url: REG + "procedura-de-constatare-a-abaterilor/" },
    ],
  },
  {
    slug: "modul-7",
    nr: 7,
    titlu: "Contestații și procedura disciplinară",
    obiectiv:
      "Dreptul la contestație, pașii de soluționare și cadrul disciplinar al Asociației.",
    lecturi: [
      { titlu: "Procedura oficială a contestațiilor WDF", url: REG + "procedura-oficiala-a-contestatiilor-wdf/" },
      { titlu: "Procedura disciplinară detaliată", url: DOC + "procedura-disciplinara/" },
    ],
  },
  {
    slug: "modul-8",
    nr: 8,
    titlu: "Rolul delegatului WDF",
    obiectiv:
      "Autoritatea, atribuțiile și raportul delegatului WDF în cadrul evenimentului expozițional.",
    lecturi: [
      { titlu: "Rolul delegatului WDF", url: REG + "rolul-delegatului-wdf/" },
    ],
  },
];

/** Pragul de promovare a testelor (procent). */
export const PRAG_PROMOVARE = 70;

/** SHA-256 al codului de acces al CANDIDAȚILOR (codul în sine NU apare în cod). */
export const ACCES_HASH = "48493761ba33bce0e9919789a88582a482179869fa76dbbaa93be7d67dad5470";

/** SHA-256 al codului de ADMINISTRATOR (acces la toată platforma). */
export const ADMIN_HASH = "66c260e81fd07dae6c76578609d8e4982cb92bd510a7fde396069de586bd2bfb";

// =========================================================================
// LECTORI — fiecare are spațiul lui la /cursuri/lector/<slug>/, accesibil
// doar cu codul lui (sau cu codul de administrator). Materialele de curs
// se publică aici (un fișier PDF/pagină per material), pe măsură ce sosesc.
// =========================================================================

export interface Material {
  titlu: string;
  url: string; // ex. /cursuri-materiale/<lector>/<fisier>.pdf sau pagină internă
  data?: string; // ex. "3 iulie 2026"
  /** Versiunea text (Markdown) a cursului — folosită de teleprompter la „Încarcă un curs”. */
  md?: string;
}

export interface Lector {
  slug: string;
  nume: string;
  rol: string;
  hash: string; // SHA-256 al codului de acces personal
  materiale: Material[];
}

export const LECTORI: Lector[] = [
  {
    slug: "flavian-savescu",
    nume: "Flavian-Sergiu Savescu",
    rol: "Președinte al Colegiului de Arbitri · WDF All Breed",
    hash: "71a012c1d53cdf7fc5b94202c736827245baa8cc3d629e674e8a6074266c8c14",
    materiale: [
      { titlu: "Suport de curs 4.1 — Regulamente WDF și standarde (PDF)", url: "/cursuri-materiale/flavian-savescu/suport-curs-4-1-regulamente-wdf-si-standarde.pdf", md: "/cursuri-materiale/flavian-savescu/suport-curs-4-1-regulamente-wdf-si-standarde.md" },
      { titlu: "Suport de curs 4.3 — Codul Etic al arbitrului (PDF)", url: "/cursuri-materiale/flavian-savescu/suport-curs-4-3-cod-etic-arbitru.pdf", md: "/cursuri-materiale/flavian-savescu/suport-curs-4-3-cod-etic-arbitru.md" },
      { titlu: "Orarul cursurilor 4.1 și 4.3 (PDF)", url: "/cursuri-materiale/flavian-savescu/orar-curs-4-1-si-4-3.pdf" },
    ],
  },
  {
    slug: "mihail-cosmin-neagu",
    nume: "Mihail Cosmin Neagu",
    rol: "Arbitru WDF · All Breed",
    hash: "21048e2893df687a5195519e5d665440c99a6060e11044fb2509b886ca0cc8b9",
    materiale: [],
  },
  {
    slug: "georgeta-mihaela-chivu",
    nume: "Georgeta Mihaela Chivu",
    rol: "Arbitru WDF · All Breed",
    hash: "ddd1b278ddf55141d8f2bca8857160b38cc64024e3f5b4368cbebee329442817",
    materiale: [
      { titlu: "Suport de curs 4.2.4 — Handling expozițional (PDF)", url: "/cursuri-materiale/georgeta-mihaela-chivu/suport-curs-4-2-4-handling-expozitional.pdf", md: "/cursuri-materiale/georgeta-mihaela-chivu/suport-curs-4-2-4-handling-expozitional.md" },
      { titlu: "Suport de curs 4.4.5 — Grooming canin (PDF)", url: "/cursuri-materiale/georgeta-mihaela-chivu/suport-curs-4-4-5-grooming-canin.pdf", md: "/cursuri-materiale/georgeta-mihaela-chivu/suport-curs-4-4-5-grooming-canin.md" },
      { titlu: "Orarul cursurilor 4.2.4 și 4.4.5 (PDF)", url: "/cursuri-materiale/georgeta-mihaela-chivu/orar-curs-4-2-4-si-4-4-5.pdf" },
    ],
  },
  {
    slug: "mihail-sorin-iacob",
    nume: "Mihail Sorin Iacob",
    rol: "Arbitru WDF · All Breed",
    hash: "d3c043092f13a97d4d83dd0df96be08162ec7e26ea7241dc1da685c8d89e1b18",
    materiale: [],
  },
  {
    slug: "andreea-daniela-popescu",
    nume: "Andreea-Daniela Popescu",
    rol: "Arbitru WDF · Grupele 3, 5, 9",
    hash: "3a7948f0609b92e2a9a46075b909600eec39244f36bc2477c32f9bbc1484f697",
    materiale: [],
  },
  {
    slug: "alexandru-paul-ciolac",
    nume: "Alexandru Paul Ciolac",
    rol: "Arbitru WDF · Grupele 2, 3, 4, 6, 8",
    hash: "eb393a27cbaf6fd51833e060e8a421912f17b1b12ea8c499e2084305397cc1d7",
    materiale: [],
  },
];
