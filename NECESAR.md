# De ce mai e nevoie — materiale, date și decizii

> Scheletul site-ului (M0–M2) e gata și funcțional. Înainte de pagina principală (M3) și de
> conținut, adună materialele de mai jos. Marchează `[x]` pe măsură ce le ai.
> Locul exact unde merge fiecare e indicat în paranteză.

---

## A. Identitate vizuală
- [ ] **Logo oficial** — vectorial `.svg` (ideal) + `.png` transparent. → `public/images/logo.svg` / `logo.png`
- [ ] **Favicon** — avem un placeholder (labă aurie pe scut verde). Înlocuiește cu logoul real dacă vrei. → `public/favicon.svg`
- [ ] **Imagine Open Graph** (preview la share pe Facebook/WhatsApp), 1200×630 px. → `public/images/og-default.jpg`
- [ ] **Paletă confirmată** — culorile actuale (verde heraldic + auriu) sunt în `src/styles/tokens.css`. Spune dacă vrei alte nuanțe exacte.

## B. Imagini pentru pagini
- [ ] **Imagine hero** (prima secțiune de pe homepage), orizontală, min. 1920×1080 px — sau un scurt clip video. → `public/images/`
- [ ] **Fotografii de secțiune** (expoziții, educație, despre) — 3–6 imagini de calitate. → `public/images/`
- [ ] **Galerie multimedia** — set de poze (și eventual link-uri video). → `public/images/galerie/`

## C. Date oficiale (în `src/data/site.ts`)
- [x] Denumire juridică completă — „Asociația Club Federal Chinologic - Royal"
- [x] **CIF** — 48828041
- [x] **IBAN** + banca — RO07 RNCB 0263 1767 9657 0001 (BCR)
- [x] Telefon oficial — +40 741 387 026
- [x] E-mail oficial — club.chinologic.royal@gmail.com
- [x] Program de lucru — L–V 08–18, S–D 10–14
- [ ] Număr de înregistrare în Registrul Asociațiilor și Fundațiilor
- [ ] Adresă sediu (exactă) — încă neprimită
- [ ] Link-uri reale social media: Facebook · Instagram · YouTube · TikTok
- [ ] **Domeniul final** al site-ului (ex. `cfc-royal.ro`) → se pune în `astro.config.mjs` și `src/data/site.ts`

## D. Texte instituționale (conținut redacțional)
- [ ] Prezentare scurtă asociație (homepage) + slogan/tagline
- [ ] Despre · Misiune · Viziune · Valori · Obiective · Istoric
- [ ] **Conducere** — nume, funcție, foto pentru fiecare persoană
- [ ] Text „Devino membru" + beneficii + cotizații + pași de înscriere
- [ ] Statistici instituționale (nr. membri, expoziții/an, rase etc.) pentru secțiunea de cifre

## E. Conținut pentru colecții (un fișier `.md` = o pagină generată automat)
Schemele sunt deja definite în `src/content.config.ts`. Pentru fiecare ai nevoie de:
- [ ] **Expoziții** — titlu, dată, loc, organizator, tip (CAC / Campionat Mondial WDF / …), regulament PDF, rezultate, galerie
- [ ] **Arbitri** — nume, foto, calificări/rase licențiate, țară, status
- [ ] **Canise** — afix, proprietar, rase, nr. înregistrare, contact
- [ ] **Standarde de rasă** — nume rasă, nr. standard, grupă (WDF), talie/greutate, standard PDF, imagini
- [ ] **Comunicate / Articole** — text + categorie (știre/interviu/editorial)
- [ ] **Evenimente** — titlu, dată, locație
- [ ] **Organizații afiliate** — nume, logo, site, județ (cele din `docs/structura-site.md`)
- [ ] **Membri de onoare** — nume, rol, foto
- [ ] **Cursuri** — titlu, nivel, durată
- [ ] **Documente** — fișier PDF + tip (statut/regulament/financiar/formular)

## F. Documente PDF (de urcat în `public/`)
- [ ] Statut · Act constitutiv
- [ ] Regulamente (expoziții, chinologice)
- [ ] Situații financiare / rapoarte
- [ ] Formulare (înscriere membru, înscriere expoziție)

## G. Pagini juridice (GDPR) — pot genera eu drafturi, tu confirmi
- [ ] Politica de confidențialitate
- [ ] Politica privind cookie-urile
- [ ] Termeni și condiții
> Spune-mi și pot scrie drafturi standard pe care le revizuiește un jurist.

## H. Decizii de luat (când ești pregătit)
- [ ] **Magazin**: Snipcart sau Stripe (modul separat, mai târziu). Acum e doar loc în meniu.
- [ ] **Slug-uri EN**: păstrăm slug-uri identice (`/en/organizatia/`) sau le traducem (`/en/organization/`)?
- [ ] **Analytics**: dacă vrei (ex. Plausible, fără cook-uri) — se încarcă doar după consimțământ.
- [ ] **Newsletter**: rămâne pe Netlify Forms sau integrăm un serviciu (Mailchimp/Brevo)?

---

## Ce e deja gata (nu trebuie să faci nimic)
- Structura tehnică Astro (static, RO/EN), build verificat.
- Antet, subsol, meniu cu submeniuri, comutator de limbă, banner cookie.
- Fonturile instituționale self-host (diacritice RO corecte).
- Schemele tuturor colecțiilor (`src/content.config.ts`).
- SEO de bază (meta, Open Graph, hreflang, schema.org Organization), sitemap, căutare statică.

## Următorul pas tehnic (când revii)
**M3 — pagina principală completă** (hero + toate secțiunile), apoi M4–M7 conform [PLAN.md](PLAN.md).
