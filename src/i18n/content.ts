// =========================================================================
// content.ts — helpere pentru colecții bilingve (fișiere în subfoldere ro/ en/).
// id-ul unei înregistrări = "ro/<slug>" sau "en/<slug>".
// =========================================================================
import type { Lang } from "./ui";

/** Slug-ul fără prefixul de limbă (ex. "ro/expo-2026" -> "expo-2026"). */
export function entrySlug(id: string): string {
  return id.replace(/^(ro|en)\//, "");
}

/** True dacă înregistrarea aparține limbii date (după prefixul id-ului). */
export function isLang(id: string, lang: Lang): boolean {
  return id.startsWith(`${lang}/`);
}

/** Formatare de dată localizată (implicit: zi lună an). */
export function formatDate(
  date: Date,
  lang: Lang,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" },
): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ro-RO", opts).format(date);
}
