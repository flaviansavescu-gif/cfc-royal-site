// =========================================================================
// content.config.ts — schemele colecțiilor de conținut (Astro 5+)
// Plasare: src/content.config.ts  (ATENȚIE: în src/, NU în src/content/)
// Fișierele de conținut: src/content/<colecție>/*.md (sau .mdx)
// =========================================================================

import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

const lang = z.enum(["ro", "en"]).default("ro");

const seo = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
  })
  .optional();

// câmpuri comune tuturor colecțiilor
const base = {
  title: z.string(), // titlul / numele înregistrării
  lang,
  summary: z.string().optional(),
  cover: z.string().optional(), // cale imagine în /public
  draft: z.boolean().default(false),
  publishedAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  seo,
};

const loader = (folder: string) =>
  glob({ pattern: "**/[^_]*.{md,mdx}", base: `./src/content/${folder}` });

/* EXPOZIȚII — un fișier = o expoziție = o pagină */
const expozitii = defineCollection({
  loader: loader("expozitii"),
  schema: z.object({
    ...base,
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    venue: z.string(),
    city: z.string(),
    county: z.string(), // județ
    country: z.string().default("România"),
    // Tipuri de expoziție (WDF — World Dog Federation). WDF acordă titlurile CAC și CACIB.
    showType: z.enum([
      "CAC",
      "CACIB",
      "Națională",
      "Internațională",
      "Campionat Mondial WDF",
      "Specială de rasă",
      "Regională",
      "Monografică",
    ]),
    organizer: z.string(),
    coOrganizers: z.array(z.string()).optional(),
    sponsors: z
      .array(
        z.object({
          name: z.string(),
          url: z.string().url().optional(),
          logo: z.string().optional(),
        }),
      )
      .optional(),
    judges: z.array(reference("arbitri")).optional(),
    groupsJudged: z.array(z.string()).optional(), // grupe de rase / rase arbitrate
    registration: z
      .object({
        open: z.boolean().default(false),
        deadline: z.coerce.date().optional(),
        url: z.string().url().optional(),
        fee: z.string().optional(),
      })
      .optional(),
    status: z
      .enum(["anunțată", "înscrieri deschise", "în desfășurare", "încheiată"])
      .default("anunțată"),
    regulationPdf: z.string().optional(),
    catalogPdf: z.string().optional(),
    resultsPdf: z.string().optional(),
    gallery: z.array(z.string()).optional(),
    mapUrl: z.string().url().optional(),
    contactEmail: z.string().email().optional(),
  }),
});

/* ARBITRI — title = numele arbitrului */
const arbitri = defineCollection({
  loader: loader("arbitri"),
  schema: z.object({
    ...base,
    photo: z.string().optional(),
    role: z.string().optional(), // ex. „Președinte al Colegiului de Arbitri”
    country: z.string().default("România"),
    city: z.string().optional(),
    judgeType: z
      .enum(["expoziție", "lucru", "specialist rasă"])
      .default("expoziție"),
    qualifications: z.array(z.string()).optional(), // grupe de rase / rase licențiate
    licensedBreeds: z.array(z.string()).optional(),
    licenseNumber: z.string().optional(),
    affiliation: z.string().default("WDF"), // WDF / națională
    languages: z.array(z.string()).optional(),
    since: z.number().optional(),
    status: z.enum(["activ", "onorific", "în formare"]).default("activ"),
    contactEmail: z.string().email().optional(),
  }),
});

/* CANISE — title = numele canisei (afixul) */
const canise = defineCollection({
  loader: loader("canise"),
  schema: z.object({
    ...base,
    affix: z.string(), // afixul înregistrat
    owner: z.string(),
    breeds: z.array(z.string()), // rasele crescute
    registrationNumber: z.string().optional(),
    registeredSince: z.coerce.date().optional(),
    county: z.string().optional(),
    city: z.string().optional(),
    country: z.string().default("România"),
    logo: z.string().optional(),
    website: z.string().url().optional(),
    contactEmail: z.string().email().optional(),
    phone: z.string().optional(),
    status: z.enum(["activă", "suspendată", "inactivă"]).default("activă"),
    gallery: z.array(z.string()).optional(),
  }),
});

/* STANDARDE DE RASĂ — title = numele rasei (RO) */
const standardeRasa = defineCollection({
  loader: loader("standarde-rasa"),
  schema: z.object({
    ...base,
    nameOriginal: z.string().optional(), // nume original / EN
    standardNumber: z.string().optional(), // nr. standard de rasă
    breedGroup: z.string().optional(), // grupa de rasă (conform WDF)
    breedSection: z.string().optional(),
    originCountry: z.string().optional(),
    patronage: z.string().optional(),
    recognition: z
      .enum(["recunoscută", "provizorie", "nerecunoscută"])
      .optional(),
    usage: z.string().optional(), // utilizare
    heightMales: z.string().optional(), // talie masculi
    heightFemales: z.string().optional(), // talie femele
    weight: z.string().optional(),
    coat: z.string().optional(), // tip blană
    colors: z.array(z.string()).optional(),
    temperament: z.string().optional(),
    standardPdf: z.string().optional(),
    images: z.array(z.string()).optional(),
    relatedJudges: z.array(reference("arbitri")).optional(),
  }),
});

/* Restul colecțiilor — același tipar (base + câmpuri proprii) */
const comunicate = defineCollection({
  loader: loader("comunicate"),
  schema: z.object({
    ...base,
    category: z
      .enum(["comunicat", "știre", "interviu", "editorial"])
      .default("comunicat"),
  }),
});

const evenimente = defineCollection({
  loader: loader("evenimente"),
  schema: z.object({
    ...base,
    date: z.coerce.date(),
    location: z.string().optional(),
  }),
});

const organizatiiAfiliate = defineCollection({
  loader: loader("organizatii-afiliate"),
  schema: z.object({
    ...base,
    website: z.string().url().optional(),
    facebook: z.string().url().optional(),
    county: z.string().optional(),
    city: z.string().optional(),
    address: z.string().optional(),
    cif: z.string().optional(),
    iban: z.string().optional(),
    phone: z.string().optional(),
    contactEmail: z.string().email().optional(),
    president: z.string().optional(),
    logo: z.string().optional(),
  }),
});

const membriOnoare = defineCollection({
  loader: loader("membri-onoare"),
  schema: z.object({
    ...base,
    role: z.string().optional(),
    photo: z.string().optional(),
  }),
});

const cursuri = defineCollection({
  loader: loader("cursuri"),
  schema: z.object({
    ...base,
    level: z.string().optional(),
    duration: z.string().optional(),
  }),
});

const documente = defineCollection({
  loader: loader("documente"),
  schema: z.object({
    ...base,
    file: z.string(),
    docType: z
      .enum(["statut", "regulament", "hotărâre", "financiar", "formular", "altele"])
      .default("altele"),
  }),
});

const articole = defineCollection({
  loader: loader("articole"),
  schema: z.object({
    ...base,
    category: z
      .enum(["știre", "interviu", "editorial", "comunicat"])
      .default("știre"),
  }),
});

/* CÂINI CAMPIONI — title = numele câinelui */
const campioni = defineCollection({
  loader: loader("campioni"),
  schema: z.object({
    ...base,
    breed: z.string(), // rasa
    breeder: z.string().optional(), // crescător
    owner: z.string().optional(), // proprietar
    pedigree: z.string().optional(), // seria și nr. pedigree
    championDiploma: z.string().optional(), // seria și nr. diplomă de campion
    championTitle: z.string().optional(), // ex. „Campion Național”
    photo: z.string().optional(),
  }),
});

/* REGULAMENTE — regulamentul WDF (proceduri de arbitraj, titluri, conduită). */
const regulamente = defineCollection({
  loader: loader("regulamente"),
  schema: z.object({
    ...base,
    category: z
      .enum([
        "Titluri",
        "Proceduri de arbitraj",
        "Etică și conduită",
        "Contestații și abateri",
        "Roluri",
      ])
      .default("Proceduri de arbitraj"),
    sourceFile: z.string().optional(), // PDF/DOCX original pentru descărcare
    order: z.number().optional(),
  }),
});

/* PAGINI — pagini instituționale statice (un fișier = o pagină).
   slug = calea, ex. "organizatia/despre" -> /ro/organizatia/despre/ */
const pagini = defineCollection({
  loader: loader("pagini"),
  schema: z.object({
    ...base,
    section: z.string().optional(), // eticheta secțiunii (eyebrow + breadcrumb)
    order: z.number().optional(),
  }),
});

export const collections = {
  expozitii,
  arbitri,
  canise,
  "standarde-rasa": standardeRasa,
  comunicate,
  evenimente,
  "organizatii-afiliate": organizatiiAfiliate,
  "membri-onoare": membriOnoare,
  cursuri,
  documente,
  articole,
  campioni,
  regulamente,
  pagini,
};
