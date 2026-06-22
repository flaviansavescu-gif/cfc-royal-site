// =========================================================================
// conducere.ts — Consiliul Director (date bilingve + foto).
// =========================================================================
import type { Lang } from "../i18n/ui";

export interface Leader {
  photo: string;
  name: string;
  founder?: boolean;
  role: Record<Lang, string>;
  responsibilities: Record<Lang, string[]>;
}

export const leaders: Leader[] = [
  {
    photo: "/images/arbitri/alexandru-paul-ciolac.webp",
    name: "Alexandru Paul Ciolac",
    founder: true,
    role: { ro: "Președinte", en: "President" },
    responsibilities: {
      ro: ["Reprezentare națională și internațională", "Strategie și dezvoltare instituțională", "Relația cu World Dog Federation", "Registrul Genealogic"],
      en: ["National and international representation", "Strategy and institutional development", "Relationship with the World Dog Federation", "Genealogical Register"],
    },
  },
  {
    photo: "/images/conducere/iuliana-ramona-ciolac.webp",
    name: "Iuliana Ramona Ciolac",
    role: { ro: "Vicepreședinte Executiv", en: "Executive Vice-President" },
    responsibilities: {
      ro: ["Coordonarea activității executive curente", "Implementarea hotărârilor Consiliului Director", "Supravegherea Secretariatului General", "Coordonarea Comisiei de Validare a Cererilor de Admitere"],
      en: ["Coordination of day-to-day executive activity", "Implementation of the Board's decisions", "Oversight of the General Secretariat", "Coordination of the Admission Applications Validation Committee"],
    },
  },
  {
    photo: "/images/arbitri/razvan-martin.webp",
    name: "Florin Răzvan Martin",
    role: { ro: "Vicepreședinte Organizatoric", en: "Organisational Vice-President" },
    responsibilities: {
      ro: ["Planificarea și coordonarea activităților organizatorice", "Organizarea expozițiilor, competițiilor și evenimentelor", "Logistică, premii și suport operațional", "Coordonarea rețelei teritoriale de voluntari"],
      en: ["Planning and coordination of organisational activities", "Organising shows, competitions and events", "Logistics, prizes and operational support", "Coordination of the territorial network of volunteers"],
    },
  },
  {
    photo: "/images/arbitri/mihail-cosmin-neagu.webp",
    name: "Mihail Cosmin Neagu",
    role: { ro: "Director Instituțional — Guvernanță și Conformitate", en: "Institutional Director — Governance & Compliance" },
    responsibilities: {
      ro: ["Dezvoltare instituțională și organizațională", "Modernizarea regulamentelor și a procedurilor", "Consultanță juridică și instituțională", "Bună guvernanță, transparență și conformitate"],
      en: ["Institutional and organisational development", "Modernisation of regulations and procedures", "Legal and institutional consultancy", "Good governance, transparency and compliance"],
    },
  },
  {
    photo: "/images/conducere/laura-georgiana-firescu.webp",
    name: "Laura Georgiana Firescu",
    role: { ro: "Secretariat General & Administrativ", en: "General & Administrative Secretariat" },
    responsibilities: {
      ro: ["Evidența membrilor", "Corespondență oficială", "Arhivă administrativă", "Suport organizatoric intern"],
      en: ["Member records", "Official correspondence", "Administrative archive", "Internal organisational support"],
    },
  },
];
