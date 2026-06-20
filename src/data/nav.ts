// =========================================================================
// nav.ts — structura de navigație (meniu principal + footer).
// Sursă unică pentru linkuri. Slug-uri IDENTICE în RO/EN (doar eticheta se traduce),
// ca să rămână robust comutatorul de limbă. Etichetele bilingve stau aici (fișier de date).
// NOTĂ: multe pagini-țintă se construiesc la M3–M6; până atunci unele linkuri dau 404.
// =========================================================================
import type { UiKey } from "./../i18n/ui";

export interface NavLink {
  slug: string; // relativ, fără prefix de limbă; "" = pagina principală a secțiunii
  label: { ro: string; en: string };
  external?: boolean;
}

export interface NavItem extends NavLink {
  children?: NavLink[];
}

/** Meniu principal (cu submeniuri pentru dropdown). */
export const mainNav: NavItem[] = [
  { slug: "", label: { ro: "Acasă", en: "Home" } },
  {
    slug: "organizatia",
    label: { ro: "Organizația", en: "Organization" },
    children: [
      { slug: "organizatia/despre", label: { ro: "Despre asociație", en: "About us" } },
      { slug: "organizatia/conducere", label: { ro: "Conducere", en: "Leadership" } },
      { slug: "arbitri", label: { ro: "Corpul de arbitri", en: "Panel of judges" } },
      { slug: "canise", label: { ro: "Canise înregistrate", en: "Registered kennels" } },
      { slug: "membri-onoare", label: { ro: "Membri de onoare", en: "Honorary members" } },
      { slug: "organizatia/transparenta", label: { ro: "Transparență instituțională", en: "Transparency" } },
    ],
  },
  {
    slug: "membri",
    label: { ro: "Membri", en: "Members" },
    children: [
      { slug: "membri/devino-membru", label: { ro: "Devino membru", en: "Become a member" } },
      { slug: "membri/beneficii", label: { ro: "Beneficii", en: "Benefits" } },
      { slug: "membri/cotizatii", label: { ro: "Cotizații", en: "Fees" } },
      { slug: "membri/formulare", label: { ro: "Formulare și documente", en: "Forms & documents" } },
      { slug: "membri/intrebari-frecvente", label: { ro: "Întrebări frecvente", en: "FAQ" } },
    ],
  },
  {
    slug: "expozitii",
    label: { ro: "Expoziții", en: "Dog Shows" },
    children: [
      { slug: "expozitii", label: { ro: "Calendar expozițional", en: "Show calendar" } },
      { slug: "expozitii/inscrieri", label: { ro: "Înscrieri", en: "Registration" } },
      { slug: "expozitii/regulamente", label: { ro: "Regulamente", en: "Regulations" } },
      { slug: "expozitii/rezultate", label: { ro: "Rezultate și clasamente", en: "Results & rankings" } },
    ],
  },
  {
    slug: "chinologie",
    label: { ro: "Chinologie", en: "Cynology" },
    children: [
      { slug: "standarde-rasa", label: { ro: "Standardele raselor", en: "Breed standards" } },
      { slug: "chinologie/legislatie", label: { ro: "Legislație", en: "Legislation" } },
      { slug: "chinologie/biblioteca", label: { ro: "Bibliotecă digitală", en: "Digital library" } },
      { slug: "chinologie/resurse", label: { ro: "Resurse și descărcări", en: "Resources & downloads" } },
    ],
  },
  {
    slug: "educatie",
    label: { ro: "Educație", en: "Education" },
    children: [
      { slug: "educatie/scoala-arbitraj", label: { ro: "Școala de arbitraj", en: "Judging school" } },
      { slug: "cursuri", label: { ro: "Cursuri", en: "Courses" } },
      { slug: "educatie/webinare", label: { ro: "Webinare", en: "Webinars" } },
      { slug: "educatie/examene", label: { ro: "Examene și certificări", en: "Exams & certifications" } },
    ],
  },
  {
    slug: "afiliati",
    label: { ro: "Afiliați", en: "Affiliates" },
    children: [
      { slug: "afiliati", label: { ro: "Asociații afiliate", en: "Affiliated associations" } },
      { slug: "afiliati/devino-afiliat", label: { ro: "Devino afiliat", en: "Become an affiliate" } },
    ],
  },
  {
    slug: "noutati",
    label: { ro: "Noutăți", en: "News" },
    children: [
      { slug: "comunicate", label: { ro: "Comunicate", en: "Press releases" } },
      { slug: "articole", label: { ro: "Articole", en: "Articles" } },
      { slug: "evenimente", label: { ro: "Evenimente", en: "Events" } },
    ],
  },
  { slug: "magazin", label: { ro: "Magazin", en: "Shop" } },
  { slug: "contact", label: { ro: "Contact", en: "Contact" } },
];

/** Coloane de linkuri în footer (titlul = cheie din ui.ts). */
export interface FooterColumn {
  titleKey: UiKey;
  links: NavLink[];
}

export const footerNav: FooterColumn[] = [
  {
    titleKey: "footer.organization",
    links: [
      { slug: "organizatia/despre", label: { ro: "Despre noi", en: "About us" } },
      { slug: "organizatia/conducere", label: { ro: "Organigramă", en: "Structure" } },
      { slug: "organizatia/transparenta", label: { ro: "Statut și documente", en: "Statute & documents" } },
    ],
  },
  {
    titleKey: "footer.activities",
    links: [
      { slug: "expozitii", label: { ro: "Expoziții", en: "Dog shows" } },
      { slug: "educatie/scoala-arbitraj", label: { ro: "Educație", en: "Education" } },
      { slug: "standarde-rasa", label: { ro: "Standarde de rasă", en: "Breed standards" } },
      { slug: "noutati", label: { ro: "Noutăți", en: "News" } },
    ],
  },
  {
    titleKey: "footer.members",
    links: [
      { slug: "membri/devino-membru", label: { ro: "Devino membru", en: "Become a member" } },
      { slug: "membri/beneficii", label: { ro: "Beneficii", en: "Benefits" } },
    ],
  },
  {
    titleKey: "footer.legal",
    links: [
      { slug: "juridic/confidentialitate", label: { ro: "Confidențialitate", en: "Privacy Policy" } },
      { slug: "juridic/cookie-uri", label: { ro: "Politica cookie-uri", en: "Cookie Policy" } },
      { slug: "juridic/termeni", label: { ro: "Termeni și condiții", en: "Terms & Conditions" } },
    ],
  },
];
