// =========================================================================
// home.ts — conținutul paginii principale (bilingv).
// CARDURILE sunt EXEMPLE de structură (marcate `demo`), nu date reale — vor fi
// înlocuite la M4–M5 cu interogări din colecții. Textele de secțiune sunt redacționale.
// =========================================================================
import type { Lang } from "../i18n/ui";

export interface CardItem {
  title: string;
  meta?: string;
  excerpt?: string;
  tag?: string;
  slug: string; // cale relativă (fără prefix de limbă)
  demo?: boolean;
}

interface HomeContent {
  hero: {
    kicker: string;
    title: string;
    subtitle: string;
    ctaPrimary: { label: string; slug: string };
    ctaSecondary: { label: string; slug: string };
  };
  intro: { title: string; body: string };
  events: { title: string; intro: string; viewAll: string; viewAllSlug: string; items: CardItem[] };
  news: { title: string; viewAll: string; viewAllSlug: string; items: CardItem[] };
  membership: { title: string; body: string; cta: string; slug: string };
  affiliates: { title: string; intro: string; viewAll: string; viewAllSlug: string };
  standards: { title: string; intro: string; viewAll: string; viewAllSlug: string; items: CardItem[] };
  education: { title: string; intro: string; items: CardItem[] };
  stats: { title: string; items: { value: string; label: string }[] };
  gallery: { title: string; intro: string; note: string };
  partners: { title: string; note: string };
}

const ro: HomeContent = {
  hero: {
    kicker: "Asociație chinologică națională",
    title: "Nu construim campioni. Construim o parte din ceea ce face posibilă existența lor.",
    subtitle:
      "Club Federal Chinologic – Royal aduce împreună crescători, arbitri și specialiști din toate ramurile chinologiei, dedicați menținerii unor standarde ridicate în creșterea, selecția și evaluarea câinilor de rasă.",
    ctaPrimary: { label: "Devino membru", slug: "membri/devino-membru" },
    ctaSecondary: { label: "Calendar expoziții", slug: "expozitii" },
  },
  intro: {
    title: "Despre Club Federal Chinologic – Royal",
    body: "Oferim crescătorilor și proprietarilor de câini de rasă reprezentare la nivel național și internațional, suport pentru obținerea certificatelor de origine (pedigree), expoziții chinologice, seminarii și o comunitate primitoare în care să îți împărtășești pasiunea pentru câini. Credem în dialog, în experiență și în proiecte care lasă ceva în urmă.",
  },
  events: {
    title: "Calendar evenimente",
    intro: "Următoarele expoziții și evenimente chinologice.",
    viewAll: "Vezi tot calendarul",
    viewAllSlug: "expozitii",
    items: [
      { title: "Expoziție Națională Canină", meta: "Reșița · 12 sept. 2026", tag: "Națională", slug: "expozitii", demo: true },
      { title: "Expoziție Internațională WDF", meta: "Timișoara · 3 oct. 2026", tag: "Internațională", slug: "expozitii", demo: true },
      { title: "Specială de rasă — Ciobănesc", meta: "Buzău · 18 oct. 2026", tag: "Specială", slug: "expozitii", demo: true },
    ],
  },
  news: {
    title: "Ultimele noutăți",
    viewAll: "Toate noutățile",
    viewAllSlug: "noutati",
    items: [
      { title: "Calendar expozițional 2026 — anunț oficial", meta: "10 iun. 2026", tag: "Comunicat", excerpt: "Programul complet al expozițiilor organizate sub egida clubului.", slug: "comunicate", demo: true },
      { title: "Noi arbitri licențiați în corpul de arbitri", meta: "2 iun. 2026", tag: "Știre", excerpt: "Trei noi arbitri au promovat examenele de specializare.", slug: "comunicate", demo: true },
      { title: "Interviu: creșterea responsabilă a raselor autohtone", meta: "20 mai 2026", tag: "Interviu", excerpt: "Despre conservarea raselor românești de câini ciobănești.", slug: "articole", demo: true },
    ],
  },
  membership: {
    title: "Devino membru",
    body: "Alătură-te comunității Club Federal Chinologic Royal: acces la expoziții, înregistrarea canisei, sprijin pentru crescători și recunoaștere instituțională.",
    cta: "Vezi beneficiile",
    slug: "membri/devino-membru",
  },
  affiliates: {
    title: "Asociații și cluburi afiliate",
    intro:
      "Club Federal Chinologic – Royal lucrează împreună cu asociații și cluburi chinologice din toată țara, care împărtășesc aceleași standarde și valori. Împreună construim o rețea națională solidă, în sprijinul crescătorilor și al câinilor de rasă.",
    viewAll: "Vezi afiliații",
    viewAllSlug: "afiliati",
  },
  standards: {
    title: "Standarde de rasă",
    intro: "Documentație de referință pentru rasele recunoscute.",
    viewAll: "Toate standardele",
    viewAllSlug: "standarde-rasa",
    items: [
      { title: "Ciobănesc Românesc Carpatin", meta: "Rasă autohtonă", slug: "standarde-rasa", demo: true },
      { title: "Ciobănesc Românesc Mioritic", meta: "Rasă autohtonă", slug: "standarde-rasa", demo: true },
      { title: "Ciobănesc Românesc de Bucovina", meta: "Rasă autohtonă", slug: "standarde-rasa", demo: true },
    ],
  },
  education: {
    title: "Educație chinologică",
    intro: "Formare pentru arbitri, crescători și pasionați.",
    items: [
      { title: "Școala de arbitraj", excerpt: "Program de formare pentru viitorii arbitri de expoziție.", slug: "educatie/scoala-arbitraj" },
      { title: "Cursuri și webinare", excerpt: "Sesiuni despre standarde, creștere și îngrijire.", slug: "cursuri" },
      { title: "Examene și certificări", excerpt: "Atestarea competențelor chinologice.", slug: "educatie/examene" },
    ],
  },
  stats: {
    title: "CFC–Royal în cifre",
    items: [
      { value: "167", label: "Membri activi" },
      { value: "20+", label: "Expoziții organizate" },
      { value: "23", label: "Canise înregistrate" },
      { value: "10", label: "Arbitri licențiați" },
    ],
  },
  gallery: {
    title: "Galerie multimedia",
    intro: "Imagini și momente din expoziții și evenimente.",
    note: "Galeria foto/video va fi disponibilă în curând.",
  },
  partners: {
    title: "Parteneri",
    note: "Spațiu pentru logourile partenerilor și sponsorilor.",
  },
};

const en: HomeContent = {
  hero: {
    kicker: "National cynological association",
    title: "We don't build champions. We build a part of what makes their existence possible.",
    subtitle:
      "The Royal Federal Canine Club brings together breeders, judges and specialists from every branch of cynology, dedicated to maintaining high standards in the breeding, selection and evaluation of purebred dogs.",
    ctaPrimary: { label: "Become a member", slug: "membri/devino-membru" },
    ctaSecondary: { label: "Show calendar", slug: "expozitii" },
  },
  intro: {
    title: "About the Royal Federal Canine Club",
    body: "We offer breeders and owners of purebred dogs national and international representation, support in obtaining pedigree certificates, dog shows, seminars and a welcoming community in which to share your passion for dogs. We believe in dialogue, experience and projects that leave something behind.",
  },
  events: {
    title: "Events calendar",
    intro: "Upcoming dog shows and cynological events.",
    viewAll: "View full calendar",
    viewAllSlug: "expozitii",
    items: [
      { title: "National Dog Show", meta: "Reșița · Sep 12, 2026", tag: "National", slug: "expozitii", demo: true },
      { title: "International Show WDF", meta: "Timișoara · Oct 3, 2026", tag: "International", slug: "expozitii", demo: true },
      { title: "Breed Specialty — Shepherd", meta: "Buzău · Oct 18, 2026", tag: "Specialty", slug: "expozitii", demo: true },
    ],
  },
  news: {
    title: "Latest news",
    viewAll: "All news",
    viewAllSlug: "noutati",
    items: [
      { title: "2026 show calendar — official announcement", meta: "Jun 10, 2026", tag: "Release", excerpt: "The full programme of shows held under the club's aegis.", slug: "comunicate", demo: true },
      { title: "New licensed judges join the panel", meta: "Jun 2, 2026", tag: "News", excerpt: "Three new judges passed their specialisation exams.", slug: "comunicate", demo: true },
      { title: "Interview: responsible breeding of native breeds", meta: "May 20, 2026", tag: "Interview", excerpt: "On preserving Romanian shepherd dog breeds.", slug: "articole", demo: true },
    ],
  },
  membership: {
    title: "Become a member",
    body: "Join the Royal Federal Canine Club community: access to shows, kennel registration, support for breeders and institutional recognition.",
    cta: "See the benefits",
    slug: "membri/devino-membru",
  },
  affiliates: {
    title: "Affiliated associations & clubs",
    intro:
      "The Royal Federal Canine Club works together with cynological associations and clubs from across the country that share the same standards and values. Together we are building a strong national network, in support of breeders and purebred dogs.",
    viewAll: "View affiliates",
    viewAllSlug: "afiliati",
  },
  standards: {
    title: "Breed standards",
    intro: "Reference documentation for recognised breeds.",
    viewAll: "All standards",
    viewAllSlug: "standarde-rasa",
    items: [
      { title: "Carpathian Shepherd Dog", meta: "Native breed", slug: "standarde-rasa", demo: true },
      { title: "Mioritic Shepherd Dog", meta: "Native breed", slug: "standarde-rasa", demo: true },
      { title: "Bucovina Shepherd Dog", meta: "Native breed", slug: "standarde-rasa", demo: true },
    ],
  },
  education: {
    title: "Canine education",
    intro: "Training for judges, breeders and enthusiasts.",
    items: [
      { title: "Judging school", excerpt: "Training programme for future show judges.", slug: "educatie/scoala-arbitraj" },
      { title: "Courses & webinars", excerpt: "Sessions on standards, breeding and care.", slug: "cursuri" },
      { title: "Exams & certifications", excerpt: "Certification of cynological competence.", slug: "educatie/examene" },
    ],
  },
  stats: {
    title: "CFC–Royal in numbers",
    items: [
      { value: "167", label: "Active members" },
      { value: "20+", label: "Shows organised" },
      { value: "23", label: "Registered kennels" },
      { value: "10", label: "Licensed judges" },
    ],
  },
  gallery: {
    title: "Multimedia gallery",
    intro: "Images and moments from shows and events.",
    note: "The photo/video gallery will be available soon.",
  },
  partners: {
    title: "Partners",
    note: "Space for partner and sponsor logos.",
  },
};

export function getHome(lang: Lang): HomeContent {
  return lang === "en" ? en : ro;
}
