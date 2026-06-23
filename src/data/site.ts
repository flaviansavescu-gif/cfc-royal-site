// =========================================================================
// site.ts — datele instituționale globale (sursă unică).
// Date oficiale reale. [PLACEHOLDER] = încă de completat (logo, imagini, adresă).
// =========================================================================

export const SITE = {
  /** Domeniul final (se sincronizează cu `site` din astro.config.mjs). */
  domain: "https://cfc-royal.ro",

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
  affiliationUrl: "https://wdf-international.org/",

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
    regNumber: "36/A/I din 21.09.2023",
  },

  contact: {
    email: "club.chinologic.royal@gmail.com",
    phone: "+40 741 387 026",
    address: {
      ro: "Str. Mihai Eminescu nr. 43, bloc C11, sc. A, et. 8, ap. 33, Râmnicu Vâlcea, jud. Vâlcea, 240076",
      en: "43 Mihai Eminescu St., bl. C11, st. A, fl. 8, apt. 33, Râmnicu Vâlcea, Vâlcea County, 240076",
    },
    schedule: {
      ro: ["Luni–Vineri: 08:00–18:00", "Sâmbătă–Duminică: 10:00–14:00"],
      en: ["Monday–Friday: 8:00 AM–6:00 PM", "Saturday–Sunday: 10:00 AM–2:00 PM"],
    },
  },

  /** Profiluri social media. */
  social: {
    facebook: "https://www.facebook.com/cfc.Royal.ro",
    instagram: "https://www.instagram.com/cfc.royal.ro",
    youtube: "https://www.youtube.com/@ClubFederalChinologic-Royal",
    tiktok: "https://www.tiktok.com/@cfc.royal.ro",
  },
} as const;

export type SiteData = typeof SITE;
