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
      ro: ["Coordonarea activității executive curente și implementarea hotărârilor Consiliului Director", "Planificarea și coordonarea activităților organizatorice", "Logistică, premii și coordonarea rețelei de voluntari", "Supravegherea Secretariatului General și a procedurii de admitere a membrilor"],
      en: ["Coordination of day-to-day executive activity and implementation of the Board's decisions", "Planning and coordination of organisational activities", "Logistics, prizes and coordination of the volunteer network", "Oversight of the General Secretariat and of the member admission procedure"],
    },
  },
  {
    photo: "/images/arbitri/flavian-savescu.webp",
    name: "Flavian-Sergiu Savescu",
    role: {
      ro: "Vicepreședinte Tehnic și de Arbitraj · Președinte al Colegiului de Arbitri",
      en: "Technical and Judging Vice-President · President of the Panel of Judges",
    },
    // Atribuțiile urmează Regulamentul intern Art. 10 (VP-ul PROPUNE/AVIZEAZĂ; Consiliul
    // Director hotărăște) + Reg. Centru Art. 7 (sistemul digital, în subordinea VP Tehnic).
    responsibilities: {
      ro: ["Coordonarea Colegiului de Arbitri, în calitate de Președinte ex officio", "Propunerea către Consiliul Director a autorizării, menținerii și retragerii calității de arbitru", "Aplicarea regulamentelor tehnice WDF și a standardelor de rasă; avizarea repartizării arbitrilor", "Coordonarea sistemului digital și a organizării tehnice a expozițiilor — site, registru genealogic, platformele de arbitraj și de expoziție"],
      en: ["Coordination of the Panel of Judges, as ex officio President", "Proposing to the Board the authorisation, maintenance and withdrawal of judge status", "Application of WDF technical regulations and breed standards; endorsement of judge assignments", "Coordination of the digital system and the technical organisation of shows — website, genealogical registry, judging and show platforms"],
    },
  },
  {
    photo: "/images/arbitri/mihail-cosmin-neagu.webp",
    name: "Mihail Cosmin Neagu",
    role: { ro: "Membru cu atribuții în guvernanță și conformitate", en: "Member with governance and compliance responsibilities" },
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
