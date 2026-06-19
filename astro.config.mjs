// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Domeniul final se setează aici înainte de publicare (folosit la sitemap + URL-uri absolute).
const SITE = "https://cfc-royal.netlify.app";

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
  integrations: [sitemap()],
  build: {
    format: "directory",
  },
});
