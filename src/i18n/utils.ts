// =========================================================================
// utils.ts — helpere i18n pentru rutele /ro/ și /en/.
// =========================================================================
import { ui, defaultLang, languages, type Lang, type UiKey } from "./ui";

/** Limba din URL (din primul segment de cale). Implicit RO. */
export function getLangFromUrl(url: URL): Lang {
  const seg = url.pathname.split("/")[1];
  return seg === "en" ? "en" : "ro";
}

/** Funcția de traducere pentru o limbă; cade pe RO dacă o cheie lipsește. */
export function useTranslations(lang: Lang) {
  return function t(key: UiKey): string {
    return ui[lang][key] ?? ui[defaultLang][key];
  };
}

/**
 * Prefixează o cale cu limba și normalizează slash-urile (trailing slash).
 *
 * O cale care ÎNCEPE cu „/" se întoarce neatinsă: registrul genealogic („/registru/")
 * și platforma cursurilor stau la rădăcină, în afara structurii pe limbi. Fără excepția
 * asta, meniul le-ar trimite la /ro/registru/, care nu există.
 *
 * Excepția excepției: paginile publice ale registrului („/caine/",
 * „/verifica-pedigree/") au și variantă engleză, sub „/en/". Un meniu englezesc
 * trebuie să ducă acolo, nu la pagina românească.
 */
export function localizePath(path: string, lang: Lang): string {
  if (path.startsWith("/")) {
    return lang === "en" && PAGINI_REGISTRU.includes(path) ? "/en" + path : path;
  }
  const clean = path.replace(/^\/+|\/+$/g, "");
  return clean ? `/${lang}/${clean}/` : `/${lang}/`;
}

/** Cealaltă limbă (RO ↔ EN). */
export function getAltLang(lang: Lang): Lang {
  return lang === "ro" ? "en" : "ro";
}

/**
 * Calea echivalentă în cealaltă limbă, păstrând restul căii și parametrii.
 * Notă: presupune rute oglindite. Pentru pagini fără echivalent direct,
 * pasează `fallback` (ex. pagina principală a limbii țintă).
 */
export function switchLangPath(url: URL, toLang: Lang, fallback?: string): string {
  // Parametrii se păstrează: pe „/caine/?r=CFCR-P-2026-0001" schimbarea limbii nu
  // trebuie să piardă câinele deschis, iar pe „/cautare?q=" nu trebuie să piardă căutarea.
  const cautare = url.search;

  // Paginile publice ale registrului: româna stă la rădăcină, fiindcă adresa e tipărită
  // în codul QR de pe certificate și nu se mai poate schimba; engleza stă sub „/en/".
  const cale = url.pathname.endsWith("/") ? url.pathname : url.pathname + "/";
  const faraPrefix = cale.startsWith("/en/") ? cale.slice(3) : cale;
  if (PAGINI_REGISTRU.includes(faraPrefix)) {
    return (toLang === "en" ? "/en" + faraPrefix : faraPrefix) + cautare;
  }

  const parts = url.pathname.split("/");
  if (parts[1] === "ro" || parts[1] === "en") {
    parts[1] = toLang;
    return (parts.join("/") || `/${toLang}/`) + cautare;
  }
  return fallback ?? `/${toLang}/`;
}

/**
 * Paginile publice ale registrului genealogic: RO la rădăcină, EN sub „/en/".
 * Sunt singurele rute nesimetrice din site — /caine/ din cauza codurilor QR deja
 * tipărite, iar celelalte ca să stea alături de el, în aceeași familie de adrese.
 */
export const PAGINI_REGISTRU = [
  "/caine/",
  "/verifica-pedigree/",
  "/registru-public/",
  "/cuiburi/",
  "/drumul-spre-campion/",
];

export { languages, defaultLang };
export type { Lang, UiKey };
