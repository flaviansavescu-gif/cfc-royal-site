// =========================================================================
// site.ts — datele instituționale globale (sursă unică).
// ⚠️ Valorile marcate [PLACEHOLDER] trebuie înlocuite cu datele reale
//    ale Clubului Federal Chinologic Royal înainte de publicare.
// =========================================================================

export const SITE = {
  /** Domeniul final (se sincronizează cu `site` din astro.config.mjs). */
  domain: "https://cfc-royal.netlify.app",

  name: {
    ro: "Clubul Federal Chinologic Royal",
    en: "Royal Federal Canine Club",
  },
  shortName: "CFC Royal",

  tagline: {
    ro: "Asociație chinologică națională",
    en: "National cynological association",
  },

  description: {
    ro: "Clubul Federal Chinologic Royal — asociație chinologică națională: expoziții canine, corp de arbitri, canise înregistrate, standarde de rasă și educație chinologică.",
    en: "Royal Federal Canine Club — national cynological association: dog shows, panel of judges, registered kennels, breed standards and canine education.",
  },

  /** Imagine implicită Open Graph (1200×630). [PLACEHOLDER] */
  defaultImage: "/images/og-default.jpg",
  logo: "/images/logo.png", // [PLACEHOLDER]

  /** Date oficiale — afișate în footer / pagina Contact / Transparență. [PLACEHOLDER] */
  legal: {
    fullName: "Clubul Federal Chinologic Royal", // denumirea juridică completă
    cif: "RO00000000", // [PLACEHOLDER]
    iban: "RO00 XXXX 0000 0000 0000 0000", // [PLACEHOLDER]
    bank: "", // [PLACEHOLDER]
    regNumber: "", // nr. registru asociații/fundații [PLACEHOLDER]
  },

  contact: {
    email: "contact@cfc-royal.ro", // [PLACEHOLDER]
    phone: "+40 700 000 000", // [PLACEHOLDER]
    address: {
      ro: "Reșița, județul Caraș-Severin, România", // [PLACEHOLDER]
      en: "Reșița, Caraș-Severin County, Romania", // [PLACEHOLDER]
    },
    schedule: {
      ro: "Luni–Vineri, 09:00–17:00",
      en: "Monday–Friday, 9:00 AM–5:00 PM",
    },
  },

  /** Profiluri social media (lasă gol dacă nu există încă). [PLACEHOLDER] */
  social: {
    facebook: "",
    instagram: "",
    youtube: "",
    tiktok: "",
  },
} as const;

export type SiteData = typeof SITE;
