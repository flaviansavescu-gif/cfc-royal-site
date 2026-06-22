// =========================================================================
// collections.ts — registru central al colecțiilor de conținut.
// Fiecare colecție declară: slug URL, etichete RO/EN, cum se construiește cardul
// (arhivă), rândurile de meta (pagina de detaliu), JSON-LD opțional și sortarea.
// Rutele dinamice [collection]/index și [collection]/[slug] folosesc acest registru,
// deci adăugarea unei colecții = o intrare aici (nu fișiere noi de pagină).
// =========================================================================
import type { Lang } from "../i18n/ui";
import { formatDate } from "../i18n/content";

type Data = Record<string, any>;
export interface MetaRow { label: string; value: string; wide?: boolean }
export interface CardData { title: string; meta?: string; excerpt?: string; tag?: string; image?: string }

export interface CollectionDef {
  name: string; // cheia colecției din content.config.ts
  slug: string; // baza URL (sub /ro/ și /en/)
  label: Record<Lang, string>;
  intro: Record<Lang, string>;
  empty: Record<Lang, string>;
  eyebrow: Record<Lang, string>;
  card: (d: Data, lang: Lang) => CardData;
  metaRows?: (d: Data, lang: Lang) => MetaRow[];
  jsonLd?: (d: Data, lang: Lang) => Record<string, unknown>;
  sort?: (a: Data, b: Data) => number;
  /** Grupare în arhivă pe categorii (ex. regulamente). */
  groupBy?: (d: Data) => string;
  groupOrder?: string[];
  /** Traduce eticheta unui grup (cheia categoriei -> text localizat). */
  groupLabel?: (key: string, lang: Lang) => string;
  /** Portret/poză afișat(ă) pe pagina de detaliu (ex. arbitri, membri). */
  portrait?: (d: Data) => string | undefined;
}

// Categorii regulamente: cheia (RO, din schema) -> etichetă localizată
const REG_CATS: Record<string, Record<Lang, string>> = {
  "Titluri": { ro: "Titluri", en: "Titles" },
  "Proceduri de arbitraj": { ro: "Proceduri de arbitraj", en: "Judging procedures" },
  "Etică și conduită": { ro: "Etică și conduită", en: "Ethics & conduct" },
  "Contestații și abateri": { ro: "Contestații și abateri", en: "Appeals & violations" },
  "Roluri": { ro: "Roluri", en: "Roles" },
};
const regCat = (key: string, lang: Lang) => REG_CATS[key]?.[lang] ?? key;

// helper bilingv scurt
const L = (lang: Lang, ro: string, en: string) => (lang === "en" ? en : ro);
const fmt = (date: Date | undefined, lang: Lang) => (date ? formatDate(date, lang) : "");
const row = (label: string, value: unknown, wide = false): MetaRow | null =>
  value ? { label, value: String(value), wide } : null;
const rows = (...items: (MetaRow | null)[]): MetaRow[] => items.filter((x): x is MetaRow => !!x);

export const collectionDefs: CollectionDef[] = [
  {
    name: "expozitii",
    slug: "expozitii",
    label: { ro: "Expoziții", en: "Dog Shows" },
    intro: { ro: "Expoziții canine organizate sub egida clubului.", en: "Dog shows held under the club's aegis." },
    empty: { ro: "Nicio expoziție publicată momentan.", en: "No shows published yet." },
    eyebrow: { ro: "Calendar expozițional", en: "Show calendar" },
    sort: (a, b) => a.startDate.getTime() - b.startDate.getTime(),
    card: (d, lang) => ({
      title: d.title,
      meta: `${d.city} · ${fmt(d.startDate, lang)}`,
      tag: d.showType,
      excerpt: d.summary,
    }),
    metaRows: (d, lang) =>
      rows(
        row(L(lang, "Dată", "Date"), d.endDate ? `${fmt(d.startDate, lang)} – ${fmt(d.endDate, lang)}` : fmt(d.startDate, lang)),
        row(L(lang, "Locație", "Venue"), d.venue),
        row(L(lang, "Oraș / Județ", "City / County"), `${d.city}, ${d.county}`),
        row(L(lang, "Tip expoziție", "Show type"), d.showType),
        row(L(lang, "Organizator", "Organiser"), d.organizer),
        row(L(lang, "Înscrieri", "Registration"), d.registration?.open ? L(lang, "Deschise", "Open") : L(lang, "Închise", "Closed")),
      ),
    jsonLd: (d) => {
      const iso = (date: Date) => date.toISOString().slice(0, 10);
      return {
        "@context": "https://schema.org",
        "@type": "Event",
        name: d.title,
        startDate: iso(d.startDate),
        ...(d.endDate ? { endDate: iso(d.endDate) } : {}),
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: { "@type": "Place", name: d.venue, address: { "@type": "PostalAddress", addressLocality: d.city, addressRegion: d.county, addressCountry: d.country } },
        organizer: { "@type": "Organization", name: d.organizer },
        ...(d.summary ? { description: d.summary } : {}),
      };
    },
  },

  {
    name: "arbitri",
    slug: "arbitri",
    label: { ro: "Colegiul de arbitri", en: "Panel of judges" },
    intro: { ro: "Arbitri licențiați ai clubului.", en: "The club's licensed judges." },
    empty: { ro: "Niciun arbitru publicat momentan.", en: "No judges published yet." },
    eyebrow: { ro: "Organizația", en: "Organization" },
    sort: (a, b) => a.title.localeCompare(b.title, "ro"),
    portrait: (d) => d.photo,
    card: (d) => ({
      title: d.title,
      meta: d.role || d.country,
      excerpt: (d.qualifications || []).join(", ") || d.summary,
      image: d.photo,
    }),
    metaRows: (d, lang) =>
      rows(
        row(L(lang, "Funcție", "Role"), d.role),
        row(L(lang, "Calificare", "Qualification"), (d.qualifications || []).join(", ")),
        row(L(lang, "Țară", "Country"), d.country),
        row(L(lang, "Oraș", "City"), d.city),
        row(L(lang, "Afiliere", "Affiliation"), d.affiliation),
        row(L(lang, "Nr. licență", "Licence no."), d.licenseNumber),
        row(L(lang, "Status", "Status"), d.status),
      ),
  },

  {
    name: "canise",
    slug: "canise",
    label: { ro: "Canise înregistrate", en: "Registered kennels" },
    intro: { ro: "Canise înregistrate la club.", en: "Kennels registered with the club." },
    empty: { ro: "Nicio canisă publicată momentan.", en: "No kennels published yet." },
    eyebrow: { ro: "Organizația", en: "Organization" },
    sort: (a, b) => a.title.localeCompare(b.title, "ro"),
    card: (d) => ({ title: d.title, meta: [d.city, d.county].filter(Boolean).join(", "), excerpt: (d.breeds || []).join(", ") }),
    metaRows: (d, lang) =>
      rows(
        row(L(lang, "Afix", "Affix"), d.affix),
        row(L(lang, "Proprietar", "Owner"), d.owner),
        row(L(lang, "Rase", "Breeds"), (d.breeds || []).join(", ")),
        row(L(lang, "Nr. înregistrare", "Reg. no."), d.registrationNumber),
        row(L(lang, "Localitate", "Location"), [d.city, d.county].filter(Boolean).join(", ")),
        row(L(lang, "Status", "Status"), d.status),
      ),
  },

  {
    name: "standarde-rasa",
    slug: "standarde-rasa",
    label: { ro: "Standarde de rasă", en: "Breed standards" },
    intro: { ro: "Documentație de referință pentru rasele recunoscute.", en: "Reference documentation for recognised breeds." },
    empty: { ro: "Niciun standard publicat momentan.", en: "No standards published yet." },
    eyebrow: { ro: "Chinologie", en: "Cynology" },
    sort: (a, b) => a.title.localeCompare(b.title, "ro"),
    card: (d) => ({ title: d.title, meta: d.originCountry || d.breedGroup, excerpt: d.summary }),
    metaRows: (d, lang) =>
      rows(
        row(L(lang, "Nume original", "Original name"), d.nameOriginal),
        row(L(lang, "Grupă", "Group"), d.breedGroup),
        row(L(lang, "Țară de origine", "Country of origin"), d.originCountry),
        row(L(lang, "Recunoaștere", "Recognition"), d.recognition),
        row(L(lang, "Talie (M)", "Height (M)"), d.heightMales),
        row(L(lang, "Talie (F)", "Height (F)"), d.heightFemales),
      ),
  },

  {
    name: "organizatii-afiliate",
    slug: "afiliati",
    label: { ro: "Asociații afiliate", en: "Affiliated associations" },
    intro: { ro: "Organizații care activează sub egida clubului.", en: "Organisations operating under the club's aegis." },
    empty: { ro: "Niciun afiliat publicat momentan.", en: "No affiliates published yet." },
    eyebrow: { ro: "Afiliați", en: "Affiliates" },
    sort: (a, b) => a.title.localeCompare(b.title, "ro"),
    card: (d) => ({ title: d.title, meta: d.county, excerpt: d.summary, image: d.logo }),
    metaRows: (d, lang) =>
      rows(
        row(L(lang, "Președinte", "President"), d.president),
        row(L(lang, "Localitate", "Location"), [d.city, d.county].filter(Boolean).join(", ")),
        row(L(lang, "Adresă", "Address"), d.address),
        row(L(lang, "Telefon", "Phone"), d.phone),
        row(L(lang, "E-mail", "Email"), d.contactEmail),
        row("CIF", d.cif),
        row("IBAN", d.iban),
        row("Facebook", d.facebook ? d.facebook.replace(/^https?:\/\//, "").replace(/\/$/, "") : undefined, true),
        row(L(lang, "Website", "Website"), d.website ? d.website.replace(/^https?:\/\//, "").replace(/\/$/, "") : undefined, true),
      ),
  },

  {
    name: "comunicate",
    slug: "comunicate",
    label: { ro: "Comunicate", en: "Press releases" },
    intro: { ro: "Comunicate oficiale ale clubului.", en: "Official press releases." },
    empty: { ro: "Niciun comunicat publicat momentan.", en: "No press releases yet." },
    eyebrow: { ro: "Noutăți", en: "News" },
    sort: (a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0),
    card: (d, lang) => ({ title: d.title, meta: fmt(d.publishedAt, lang), tag: d.category, excerpt: d.summary }),
    metaRows: (d, lang) =>
      rows(
        row(L(lang, "Categorie", "Category"), d.category),
        row(L(lang, "Publicat", "Published"), fmt(d.publishedAt, lang)),
      ),
  },

  {
    name: "articole",
    slug: "articole",
    label: { ro: "Articole", en: "Articles" },
    intro: { ro: "Articole, interviuri și editoriale.", en: "Articles, interviews and editorials." },
    empty: { ro: "Niciun articol publicat momentan.", en: "No articles published yet." },
    eyebrow: { ro: "Noutăți", en: "News" },
    sort: (a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0),
    card: (d, lang) => ({ title: d.title, meta: fmt(d.publishedAt, lang), tag: d.category, excerpt: d.summary }),
    metaRows: (d, lang) =>
      rows(
        row(L(lang, "Categorie", "Category"), d.category),
        row(L(lang, "Publicat", "Published"), fmt(d.publishedAt, lang)),
      ),
  },

  {
    name: "evenimente",
    slug: "evenimente",
    label: { ro: "Evenimente", en: "Events" },
    intro: { ro: "Evenimente organizate de club.", en: "Events organised by the club." },
    empty: { ro: "Niciun eveniment publicat momentan.", en: "No events published yet." },
    eyebrow: { ro: "Noutăți", en: "News" },
    sort: (a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0),
    card: (d, lang) => ({ title: d.title, meta: fmt(d.date, lang), excerpt: d.summary }),
    metaRows: (d, lang) =>
      rows(
        row(L(lang, "Dată", "Date"), fmt(d.date, lang)),
        row(L(lang, "Locație", "Location"), d.location),
      ),
  },

  {
    name: "membri-onoare",
    slug: "membri-onoare",
    label: { ro: "Membri de onoare", en: "Honorary members" },
    intro: { ro: "Personalități recunoscute de club.", en: "Personalities recognised by the club." },
    empty: { ro: "Niciun membru de onoare publicat momentan.", en: "No honorary members yet." },
    eyebrow: { ro: "Organizația", en: "Organization" },
    sort: (a, b) => a.title.localeCompare(b.title, "ro"),
    portrait: (d) => d.photo,
    card: (d) => ({ title: d.title, meta: d.role, excerpt: d.summary, image: d.photo }),
    metaRows: (d, lang) => rows(row(L(lang, "Distincție", "Distinction"), d.role)),
  },

  {
    name: "cursuri",
    slug: "cursuri",
    label: { ro: "Cursuri", en: "Courses" },
    intro: { ro: "Cursuri și programe de formare.", en: "Courses and training programmes." },
    empty: { ro: "Niciun curs publicat momentan.", en: "No courses published yet." },
    eyebrow: { ro: "Educație", en: "Education" },
    sort: (a, b) => a.title.localeCompare(b.title, "ro"),
    card: (d) => ({ title: d.title, meta: d.level, excerpt: d.summary }),
    metaRows: (d, lang) =>
      rows(
        row(L(lang, "Nivel", "Level"), d.level),
        row(L(lang, "Durată", "Duration"), d.duration),
      ),
  },

  {
    name: "regulamente",
    slug: "regulamente",
    label: { ro: "Regulamente WDF", en: "WDF Regulations" },
    intro: { ro: "Proceduri de arbitraj, titluri și conduită — regulamentul WDF (World Dog Federation).", en: "Judging procedures, titles and conduct — the WDF (World Dog Federation) regulations." },
    empty: { ro: "Niciun regulament publicat momentan.", en: "No regulations published yet." },
    eyebrow: { ro: "Expoziții", en: "Dog Shows" },
    sort: (a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title, "ro"),
    groupBy: (d) => d.category,
    groupOrder: ["Titluri", "Proceduri de arbitraj", "Etică și conduită", "Contestații și abateri", "Roluri"],
    groupLabel: regCat,
    card: (d, lang) => ({ title: d.title, tag: regCat(d.category, lang), excerpt: d.summary }),
    metaRows: (d, lang) => rows(row(L(lang, "Categorie", "Category"), regCat(d.category, lang))),
  },

  {
    name: "documente",
    slug: "documente",
    label: { ro: "Documente", en: "Documents" },
    intro: { ro: "Documente publice ale clubului.", en: "The club's public documents." },
    empty: { ro: "Niciun document publicat momentan.", en: "No documents published yet." },
    eyebrow: { ro: "Transparență", en: "Transparency" },
    sort: (a, b) => a.title.localeCompare(b.title, "ro"),
    card: (d) => ({ title: d.title, tag: d.docType, excerpt: d.summary }),
    metaRows: (d, lang) =>
      rows(
        row(L(lang, "Tip document", "Document type"), d.docType),
        row(L(lang, "Fișier", "File"), d.file),
      ),
  },
];

/** Caută definiția după slug-ul URL. */
export function defBySlug(slug: string): CollectionDef | undefined {
  return collectionDefs.find((d) => d.slug === slug);
}
