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
 * O cale care ÎNCEPE cu „/" se întoarce neatinsă: registrul genealogic („/caine/",
 * „/verifica-pedigree/", „/registru/") și platforma cursurilor stau la rădăcină, în
 * afara structurii pe limbi. Fără excepția asta, meniul le-ar trimite la /ro/caine/,
 * care nu există.
 */
export function localizePath(path: string, lang: Lang): string {
  if (path.startsWith("/")) return path;
  const clean = path.replace(/^\/+|\/+$/g, "");
  return clean ? `/${lang}/${clean}/` : `/${lang}/`;
}

/** Cealaltă limbă (RO ↔ EN). */
export function getAltLang(lang: Lang): Lang {
  return lang === "ro" ? "en" : "ro";
}

/**
 * Calea echivalentă în cealaltă limbă, păstrând restul căii.
 * Notă: presupune rute oglindite. Pentru pagini fără echivalent direct,
 * pasează `fallback` (ex. pagina principală a limbii țintă).
 */
export function switchLangPath(url: URL, toLang: Lang, fallback?: string): string {
  const parts = url.pathname.split("/");
  if (parts[1] === "ro" || parts[1] === "en") {
    parts[1] = toLang;
    return parts.join("/") || `/${toLang}/`;
  }
  // Paginile registrului genealogic („/caine/", „/verifica-pedigree/") stau la rădăcină,
  // cu o singură adresă în ambele limbi — codul QR de pe certificat duce acolo și nu se
  // mai poate schimba. Pentru ele, comutatorul păstrează pagina și cere limba prin
  // `?lang=`, în loc să arunce omul pe prima pagină a celeilalte limbi.
  if (PAGINI_FARA_LIMBA.some((p) => url.pathname.startsWith(p))) {
    const cautare = new URLSearchParams(url.search);
    cautare.set("lang", toLang);
    return url.pathname + "?" + cautare.toString();
  }
  return fallback ?? `/${toLang}/`;
}

/** Pagini care trăiesc la rădăcină și își aleg limba din `?lang=`. */
export const PAGINI_FARA_LIMBA = ["/caine/", "/verifica-pedigree/"];

export { languages, defaultLang };
export type { Lang, UiKey };
