// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Domeniul final se setează aici înainte de publicare (folosit la sitemap + URL-uri absolute).
const SITE = "https://cfc-royal.ro";

// https://astro.build/config
export default defineConfig({
  site: SITE,
  output: "static",
  trailingSlash: "always",
  i18n: {
    defaultLocale: "ro",
    locales: ["ro", "en"],
    routing: {
      // RO e implicit, dar îl ținem prefixat (/ro/) pentru simetrie și claritate instituțională.
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      // Zonele private/noindex nu au ce căuta în sitemap — altfel Google reclamă
      // „URL trimis, dar marcat noindex". Aici: platforma de cursuri, registrul
      // genealogic (spațiile de lucru), spațiul crescătorilor și confirmarea de montă.
      // Paginile publice /ro/cursuri/ și /en/cursuri/ rămân incluse (nu încep cu /cursuri/).
      filter: (page) => {
        const cale = new URL(page).pathname;
        return !["/cursuri/", "/registru/", "/crescatori/", "/confirmare-monta/"].some((p) => cale.startsWith(p));
      },
    }),
  ],
  build: {
    format: "directory",
  },
  vite: {
    server: {
      fs: {
        // Manualul de studiu individual stă în rădăcina proiectului, nu în `public/`, ca să
        // NU fie publicat: la build ajunge doar în pachetul funcției `material-protejat`.
        // În producție nu e expus (se publică doar `dist/`), dar serverul de dezvoltare
        // servește implicit fișierele din rădăcină — aici îi interzicem explicit accesul,
        // ca materialul să nu fie accesibil nici local, fără trecerea prin poarta de rol.
        deny: ["**/material-studiu/**"],
      },
    },
  },
});
