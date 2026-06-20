# PLAN — Site instituțional Club Federal Chinologic Royal

Asociație chinologică **națională** (RO), afiliată **WDF — World Dog Federation** (NU FCI),
bilingv **RO/EN**. Astro static → Netlify.
Fără WordPress, fără bază de date. Conținut care crește = content collections (un fișier = o pagină).

> Identitate: site-ul aparține **Club Federal Chinologic Royal** (denumire juridică:
> „Asociația Club Federal Chinologic - Royal"). Asociația din Caraș-Severin și celelalte
> din `structura-site.md` sunt **afiliate**.

---

## Stack
- Astro 5+ (`output: "static"`), TypeScript pentru scheme.
- i18n nativ Astro: `/ro/` (implicit, prefixat) și `/en/`.
- Fonturi self-host în `public/fonts/` (Source Serif 4, Source Sans 3, IBM Plex Mono; subset latin + latin-ext).
- Design tokens unici în `src/styles/tokens.css`.
- Netlify Forms (contact + newsletter). Căutare statică cu Pagefind.
- SEO: meta + Open Graph + schema.org (Organization / Event). Sitemap via `@astrojs/sitemap`.
- GDPR: banner cookie; orice analytics/pixel doar după consimțământ.

## Structura de foldere
```
astro.config.mjs · netlify.toml · package.json · tsconfig.json · CLAUDE.md · PLAN.md
docs/            structura-site.md, prompt.txt
public/fonts/    *.woff2 (self-host)   public/images/
src/
  content.config.ts          # scheme colecții (în src/, NU în src/content/)
  content/<colecție>/*.md     # un fișier = o pagină
  data/                       # site.ts (date oficiale), nav.ts (meniuri)
  i18n/                       # ui.ts (stringuri), utils.ts (helpers limbă)
  styles/                     # tokens.css, fonts.css, global.css
  components/                 # Header, Footer, Card, Hero, Seo, CookieBanner…
  layouts/                    # BaseLayout, RecordLayout
  pages/ro/ · pages/en/       # rute oglindite + archive/[slug] per colecție
```

## Colecții (definite în `src/content.config.ts`)
expozitii · arbitri · canise · standarde-rasa · comunicate · evenimente ·
organizatii-afiliate · membri-onoare · cursuri · documente · articole.
Galerie foto/video: JSON în `src/data/` sau colecție dedicată (de decis la M5).

## Ordinea de implementare (commit per modul)
- **M0 — Schelet & config** ✅ *(în lucru)*: mutare fișiere, package.json, astro.config, tsconfig,
  netlify.toml, fonts.css + woff2, global.css, .gitignore, git init, pagină placeholder.
- **M1 — Layout & i18n**: `BaseLayout`, `Seo`, `i18n/ui.ts` + `utils.ts`, redirect `/` → `/ro/`.
- **M2 — Header + Footer**: TopBar (limbă/căutare/magazin/cont), MainNav, LangSwitcher, Footer, CookieBanner.
- **M3 — Front-page**: `/ro/` + `/en/` cu toate secțiunile (date demo).
- **M4 — RecordLayout + Expoziții**: layout generic, archive + `[slug]`, 1–2 fișiere demo, schema.org Event.
- **M5 — Restul colecțiilor**: arbitri, canise, standarde-rasă, articole, comunicate, evenimente, etc.
- **M6 — Pagini statice + juridice + Contact**: secțiuni instituționale, GDPR, Netlify Forms.
- **M7 — Finisaje**: sitemap/robots, 404, căutare Pagefind, Magazin = doar loc în meniu.

## Deploy (NU se publică fără confirmarea proprietarului)
1. Local: `npm install` → `npm run dev` (necesită Node 20+).
2. `npm run build` → `dist/`.
3. Netlify: conectează repo, build `npm run build`, publish `dist` (vezi `netlify.toml`).
4. Setează domeniul real în `astro.config.mjs` (`site`) înainte de publicare.

## De stabilit ulterior (conținut)
- Nume oficial complet, CIF, IBAN, adresă, contact → `src/data/site.ts`.
- Logo / favicon / imagine hero.
- Conturile reale de social media.
- Magazin: Snipcart vs Stripe (modul separat, mai târziu).
