# Proiect: Site instituțional asociație chinologică (Astro, static)

## Arhitectură
- Astro 5+, output static pur. Deploy pe Netlify. Fără WordPress, fără bază de date.
- Conținut care crește -> content collections în `src/content/`, scheme în `src/content.config.ts`.
- Un singur `RecordLayout` pentru paginile individuale ale colecțiilor.
- i18n: rute `/ro/` (implicit) și `/en/`. Fără stringuri hardcodate în afara fișierelor de conținut.

## Design (instituțional, NU literar)
- Paletă + fonturi: `src/styles/tokens.css` (sursă unică). Fără culori/fonturi hardcodate în componente.
- Titluri: Source Serif 4. Text: Source Sans 3. CIF/IBAN: IBM Plex Mono.
- Paletă: verde heraldic + auriu (decorativ), fundal deschis.
- Diacritice RO corecte (ș/ț cu virgulă). `font-display: swap`; self-host în `public/fonts/`.
- Accesibil (WCAG 2.1 AA), performant, zero JS inutil.

## Conținut
- Scheme în `src/content.config.ts` (Astro 5+, `loader: glob`). Un fișier = o pagină.
- Documentul de structură / IA: `docs/structura-site.md`.
- Formulare: Netlify Forms (`data-netlify` + form ascuns de detecție).

## Workflow
- Plan înainte de cod pentru orice modul nou. Commit per modul, mesaje clare.
- Nu publica pe Netlify fără confirmarea mea.
- Magazinul: modul separat, mai târziu (Snipcart sau Stripe, nu WooCommerce).
