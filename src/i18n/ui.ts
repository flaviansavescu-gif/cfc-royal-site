// =========================================================================
// ui.ts — stringuri de interfață RO/EN (sursă unică pentru text non-conținut).
// Regula CLAUDE.md: fără stringuri hardcodate în componente — folosește t("cheie").
// `ro` și `en` TREBUIE să aibă exact aceleași chei.
// =========================================================================

export const languages = {
  ro: "Română",
  en: "English",
} as const;

export const defaultLang: Lang = "ro";
export type Lang = keyof typeof languages;

export const ui = {
  ro: {
    // Accesibilitate
    "a11y.skipToContent": "Sari la conținut",
    "a11y.mainNav": "Meniu principal",
    "a11y.langSwitch": "Schimbă limba",
    "a11y.openMenu": "Deschide meniul",
    "a11y.closeMenu": "Închide meniul",

    // Bara superioară
    "topbar.search": "Căutare",
    "topbar.shop": "Magazin",
    "topbar.account": "Contul meu",
    "topbar.language": "Limbă",

    // Meniu principal
    "nav.home": "Acasă",
    "nav.organization": "Organizația",
    "nav.members": "Membri",
    "nav.exhibitions": "Expoziții",
    "nav.cynology": "Chinologie",
    "nav.education": "Educație",
    "nav.affiliates": "Afiliați",
    "nav.news": "Noutăți",
    "nav.shop": "Magazin",
    "nav.contact": "Contact",

    // Comune
    "common.readMore": "Citește mai mult",
    "common.viewAll": "Vezi toate",
    "common.backHome": "Înapoi la pagina principală",
    "common.becomeMember": "Devino membru",
    "common.loading": "Se încarcă…",
    "common.search.placeholder": "Caută pe site…",

    // Footer — titluri de coloană
    "footer.organization": "Organizația",
    "footer.activities": "Activități",
    "footer.members": "Membri",
    "footer.legal": "Informații juridice",
    "footer.officialData": "Date oficiale",
    "footer.social": "Social media",
    "footer.newsletter": "Newsletter",
    "footer.newsletter.cta": "Abonează-te",
    "footer.newsletter.placeholder": "Adresa ta de e-mail",
    "footer.rights": "Toate drepturile rezervate.",

    // Pagini juridice
    "legal.privacy": "Politica de confidențialitate",
    "legal.cookies": "Politica privind cookie-urile",
    "legal.terms": "Termeni și condiții",

    // Cookie banner
    "cookie.message": "Folosim doar cookie-uri esențiale. Statisticile și conținutul terț se încarcă doar cu acordul tău.",
    "cookie.accept": "Accept",
    "cookie.reject": "Doar esențiale",
    "cookie.more": "Detalii",

    // 404
    "404.title": "Pagină negăsită",
    "404.message": "Ne pare rău, pagina căutată nu există sau a fost mutată.",
  },

  en: {
    "a11y.skipToContent": "Skip to content",
    "a11y.mainNav": "Main menu",
    "a11y.langSwitch": "Change language",
    "a11y.openMenu": "Open menu",
    "a11y.closeMenu": "Close menu",

    "topbar.search": "Search",
    "topbar.shop": "Shop",
    "topbar.account": "My account",
    "topbar.language": "Language",

    "nav.home": "Home",
    "nav.organization": "Organization",
    "nav.members": "Members",
    "nav.exhibitions": "Dog Shows",
    "nav.cynology": "Cynology",
    "nav.education": "Education",
    "nav.affiliates": "Affiliates",
    "nav.news": "News",
    "nav.shop": "Shop",
    "nav.contact": "Contact",

    "common.readMore": "Read more",
    "common.viewAll": "View all",
    "common.backHome": "Back to homepage",
    "common.becomeMember": "Become a member",
    "common.loading": "Loading…",
    "common.search.placeholder": "Search the site…",

    "footer.organization": "Organization",
    "footer.activities": "Activities",
    "footer.members": "Members",
    "footer.legal": "Legal information",
    "footer.officialData": "Official details",
    "footer.social": "Social media",
    "footer.newsletter": "Newsletter",
    "footer.newsletter.cta": "Subscribe",
    "footer.newsletter.placeholder": "Your email address",
    "footer.rights": "All rights reserved.",

    "legal.privacy": "Privacy Policy",
    "legal.cookies": "Cookie Policy",
    "legal.terms": "Terms & Conditions",

    "cookie.message": "We use only essential cookies. Analytics and third-party content load only with your consent.",
    "cookie.accept": "Accept",
    "cookie.reject": "Essential only",
    "cookie.more": "Details",

    "404.title": "Page not found",
    "404.message": "Sorry, the page you are looking for does not exist or has been moved.",
  },
} as const;

/** Cheile valide pentru funcția de traducere. */
export type UiKey = keyof (typeof ui)["ro"];
