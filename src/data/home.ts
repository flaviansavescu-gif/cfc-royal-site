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
  events: { title: string; intro: string; viewAll: string; viewAllSlug: string };
  news: { title: string; viewAll: string; viewAllSlug: string };
  membership: { title: string; body: string; cta: string; slug: string };
  affiliates: { title: string; intro: string; viewAll: string; viewAllSlug: string };
  standards: { title: string; intro: string; viewAll: string; viewAllSlug: string };
  education: { title: string; intro: string; items: CardItem[] };
  stats: { title: string; items: { value: string; label: string }[] };
  gallery: { title: string; intro: string; note: string };
  partners: { title: string; note: string; logos: { src: string; alt: string; url?: string }[] };
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
    intro:
      "Expozițiile și evenimentele chinologice organizate sub egida Club Federal Chinologic – Royal, în țară și sub patronaj internațional World Dog Federation.",
    viewAll: "Vezi calendarul expozițional",
    viewAllSlug: "calendar-expozitional",
  },
  news: {
    title: "Ultimele noutăți",
    viewAll: "Toate noutățile",
    viewAllSlug: "noutati",
  },
  membership: {
    title: "Devino membru",
    body: "Alătură-te comunității Club Federal Chinologic Royal: acces la expoziții, înregistrarea canisei, sprijin pentru crescători și recunoaștere instituțională.",
    cta: "Vezi beneficiile",
    slug: "membri/devino-membru",
  },
  affiliates: {
    title: "Asociații și cluburi membre",
    intro:
      "Club Federal Chinologic – Royal lucrează împreună cu asociații și cluburi chinologice din toată țara, care împărtășesc aceleași standarde și valori. Împreună construim o rețea națională solidă, în sprijinul crescătorilor și al câinilor de rasă.",
    viewAll: "Vezi asociațiile membre",
    viewAllSlug: "membrii",
  },
  standards: {
    title: "Standarde de rasă",
    intro:
      "Aici găsești standardele raselor autohtone românești de ciobănești, dar și standardele celorlalte rase recunoscute de World Dog Federation.",
    viewAll: "Vezi standardele",
    viewAllSlug: "standarde-rasa",
  },
  education: {
    title: "Educație chinologică",
    intro: "Formare pentru arbitri, crescători și pasionați.",
    items: [
      { title: "Centrul de Dezvoltare a Competențelor Chinologice", excerpt: "Formarea arbitrilor, comisarilor de ring, organizatorilor și prezentatorilor chinologi.", slug: "educatie/centrul-competentelor-chinologice" },
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
    note: "Afișele primelor expoziții din 2026. Galeriile foto vor urma.",
  },
  partners: {
    title: "Parteneri",
    note: "",
    logos: [
      { src: "/images/parteneri/iipc.webp", alt: "International Institute of Professional Cynology (IIPC)" },
      { src: "/images/parteneri/anicp.webp", alt: "Asociația Națională a Instructorilor Canini Profesioniști (ANICP)" },
      { src: "/images/parteneri/trops.webp", alt: "TROPS" },
      { src: "/images/centrul-competentelor.webp", alt: "Centrul de Dezvoltare a Competențelor Chinologice — CFC-Royal" },
    ],
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
    intro:
      "The dog shows and cynological events organised under the aegis of the Royal Federal Canine Club, across the country and under international World Dog Federation patronage.",
    viewAll: "View the show calendar",
    viewAllSlug: "calendar-expozitional",
  },
  news: {
    title: "Latest news",
    viewAll: "All news",
    viewAllSlug: "noutati",
  },
  membership: {
    title: "Become a member",
    body: "Join the Royal Federal Canine Club community: access to shows, kennel registration, support for breeders and institutional recognition.",
    cta: "See the benefits",
    slug: "membri/devino-membru",
  },
  affiliates: {
    title: "Member associations & clubs",
    intro:
      "The Royal Federal Canine Club works together with cynological associations and clubs from across the country that share the same standards and values. Together we are building a strong national network, in support of breeders and purebred dogs.",
    viewAll: "View member associations",
    viewAllSlug: "membrii",
  },
  standards: {
    title: "Breed standards",
    intro:
      "Here you will find the standards of the Romanian native shepherd breeds, as well as the standards of the other breeds recognised by the World Dog Federation.",
    viewAll: "View standards",
    viewAllSlug: "standarde-rasa",
  },
  education: {
    title: "Canine education",
    intro: "Training for judges, breeders and enthusiasts.",
    items: [
      { title: "Centre for Cynological Competencies", excerpt: "Training judges, ring stewards, organisers and presenters.", slug: "educatie/centrul-competentelor-chinologice" },
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
    note: "Posters of the first 2026 dog shows. Photo galleries to follow.",
  },
  partners: {
    title: "Partners",
    note: "",
    logos: [
      { src: "/images/parteneri/iipc.webp", alt: "International Institute of Professional Cynology (IIPC)" },
      { src: "/images/parteneri/anicp.webp", alt: "National Association of Professional Dog Instructors (ANICP)" },
      { src: "/images/parteneri/trops.webp", alt: "TROPS" },
      { src: "/images/centrul-competentelor.webp", alt: "Centre for the Development of Cynological Competencies — CFC-Royal" },
    ],
  },
};

export function getHome(lang: Lang): HomeContent {
  return lang === "en" ? en : ro;
}
