// =========================================================================
// site.ts — datele instituționale globale (sursă unică).
// Date oficiale reale. [PLACEHOLDER] = încă de completat (logo, imagini, adresă).
// =========================================================================

export const SITE = {
  /** Domeniul final (se sincronizează cu `site` din astro.config.mjs). */
  domain: "https://cfc-royal.netlify.app", // [PLACEHOLDER] domeniu final

  name: {
    ro: "Club Federal Chinologic Royal",
    en: "Royal Federal Canine Club",
  },
  shortName: "CFC Royal",

  tagline: {
    ro: "Asociație chinologică națională",
    en: "National cynological association",
  },

  /** Afiliere: World Dog Federation (NU FCI). */
  affiliation: "WDF — World Dog Federation",
  affiliationLogo: "/images/wdf.webp",

  description: {
    ro: "Club Federal Chinologic Royal — asociație chinologică națională afiliată WDF: expoziții canine, corp de arbitri, canise înregistrate, standarde de rasă și educație chinologică.",
    en: "Royal Federal Canine Club — national cynological association affiliated with the WDF: dog shows, panel of judges, registered kennels, breed standards and canine education.",
  },

  /** Imagine implicită Open Graph (1200×630). [PLACEHOLDER] */
  defaultImage: "/images/og-default.jpg",
  logo: "/images/logo-royal.webp",

  /** Date oficiale — afișate în footer / pagina Contact / Transparență. */
  legal: {
    fullName: "Asociația Club Federal Chinologic - Royal", // denumirea juridică completă
    cif: "48828041",
    iban: "RO07 RNCB 0263 1767 9657 0001",
    bank: "Banca Comercială Română (BCR)",
    regNumber: "", // nr. registru asociații/fundații [PLACEHOLDER]
  },

  contact: {
    email: "club.chinologic.royal@gmail.com",
    phone: "+40 741 387 026",
    address: {
      ro: "", // [PLACEHOLDER] adresă poștală — încă neprimită
      en: "",
    },
    schedule: {
      ro: ["Luni–Vineri: 08:00–18:00", "Sâmbătă–Duminică: 10:00–14:00"],
      en: ["Monday–Friday: 8:00 AM–6:00 PM", "Saturday–Sunday: 10:00 AM–2:00 PM"],
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
