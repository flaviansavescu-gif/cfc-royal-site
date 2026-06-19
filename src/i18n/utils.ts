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

/** Prefixează o cale cu limba și normalizează slash-urile (trailing slash). */
export function localizePath(path: string, lang: Lang): string {
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
  return fallback ?? `/${toLang}/`;
}

export { languages, defaultLang };
export type { Lang, UiKey };
