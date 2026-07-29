# NECESAR — actualizat (iunie 2026)

> Site instituțional **Club Federal Chinologic – Royal**. Cea mai mare parte a conținutului real este
> deja integrată. Mai jos: ce a mai rămas (prioritar) și, ca referință, ce e gata.
> ☑ = gata / integrat · ☐ = de adunat.

---

## ⏳ CE A MAI RĂMAS (de la tine)

### Imagini
- ☐ **Poze pentru 2 arbitri**: Andreea-Daniela Popescu și Alexandra Andreea Duță (ceilalți 8 au poză).
- ☐ **Imagine hero** pentru pagina principală (orizontală, min. 1920×1080) — acum e fundal verde solid.
- ☐ **Fotografii de secțiune / galerie** (expoziții, evenimente) — pentru secțiunea Galerie.
- ☐ (opțional) **Poze conducere** pentru pagina Conducere (Ciolac Alexandru, Iuliana Ramona, Firescu Laura).

### Conținut pentru colecții (un fișier = o pagină)
- ☐ **Standarde de rasă** — nume rasă, grupă WDF, talie/greutate, descriere, standard PDF, imagini.
- ☐ **Comunicate / Articole / Editoriale** — text + categorie.
- ☐ **Evenimente** (altele decât expozițiile) — titlu, dată, locație.
- ☐ **Cursuri** — titlu, nivel, durată.
- ☐ **Alte asociații afiliate** (avem Străjerii Munților și Caraș-Severin) — ex. A.Ch. Buzău: nume, logo, județ, contact.
- ☐ **Alți membri de onoare** (dacă e cazul) — nume, rol, foto.

### Documente PDF (de urcat în `public/`)
- ☐ Statut · Act constitutiv
- ☐ Regulamente (cele 19 WDF sunt deja pe site ca pagini; aici = PDF-uri oficiale, dacă vrei și descărcare)
- ☐ **Formular de înscriere membru** (e citat în pagina „Devino membru")
- ☐ Situații financiare / rapoarte

### Decizii de luat (când ești pregătit)
- ☐ **Magazin** — Snipcart sau Stripe (modul separat). Acum e doar loc în meniu.
- ☐ **Analytics** — ex. Plausible (fără cookie-uri), doar după consimțământ.
- ☐ **Newsletter** — rămâne pe Netlify Forms sau integrăm un serviciu (Mailchimp/Brevo)?
- ☐ **Pagini juridice** — drafturile GDPR există pe site; necesită revizuirea unui jurist.
- ☐ **Deploy pe cfc-royal.ro** — pașii sunt pregătiți (Netlify); publicarea o faci tu.

---

## ✅ CE E DEJA GATA

### Identitate vizuală
- ☑ Logo oficial CFC–Royal (header + footer)
- ☑ Favicon (pictograma R, lizibil) + apple-touch-icon
- ☑ Imagine Open Graph (preview la share)
- ☑ Paletă instituțională (verde heraldic + auriu)

### Date oficiale (în footer, Contact, Transparență)
- ☑ Denumire juridică: Asociația Club Federal Chinologic – Royal
- ☑ Domeniu: www.cfc-royal.ro · CIF: 48828041 · IBAN: RO07 RNCB 0263 1767 9657 0001 (BCR)
- ☑ Nr. înregistrare: 36/A/I din 21.09.2023
- ☑ Sediu: Râmnicu Vâlcea, str. Mihai Eminescu nr. 43, jud. Vâlcea, 240076
- ☑ Telefon, e-mail, program · Social: Facebook, Instagram, YouTube, TikTok

### Conținut instituțional
- ☑ Pagina principală: slogan + prezentare + statistici reale (167 membri, 20+ expoziții, 23 canise, 10 arbitri)
- ☑ Despre · Misiune · Viziune · Valori · Obiective · Istoric
- ☑ Conducere — Consiliul Director (5 persoane)
- ☑ Devino membru · Beneficii · Cotizații (100 lei)

### Colecții
- ☑ **Colegiul de arbitri** — 10 arbitri (8 cu poză), cu licențe WDF
- ☑ **Canise** — 23 de canise înregistrate
- ☑ **Expoziții** — 4 expoziții WDF 2026
- ☑ **Regulamente WDF** — 19 documente (RO + EN)
- ☑ Afiliați — 2 asociații · Membri de onoare — 1

### Tehnic
- ☑ Structură Astro statică, bilingv RO/EN, ~188 de pagini
- ☑ SEO (meta, Open Graph, hreflang, schema.org), sitemap, robots, căutare Pagefind
- ☑ Formulare Netlify (contact + newsletter), banner cookie GDPR
- ☑ Pagini juridice (drafturi), 404, accesibilitate

---

*Adaugi conținut editând fișiere `.md` în `src/content/<colecție>/ro|en/`. Verificare locală: `npm run preview`.*
