# Structura site-ului — asociație chinologică națională

> Notă pentru implementare: acest document descrie **structura de conținut și arhitectura informațională** (IA).
> Implementarea tehnică este **Astro static + Netlify** (vezi `prompt.txt` și `CLAUDE.md`), **nu WordPress**.
> Unde documentul original spunea "Custom Post Types", citește "content collections Astro"; unde spunea
> "WooCommerce", citește "modul de magazin separat (Snipcart/Stripe), mai târziu".

## Două categorii de conținut

**1. Conținut static** — pagini instituționale care se modifică rar:
Acasă, Despre Club, Contact, Devino membru, Statut, Politica de confidențialitate, Beneficii membri.

**2. Conținut dinamic** — informații care cresc permanent, administrate ca colecții (un fișier = o pagină):
Expoziții, Arbitri, Canise, Standarde de rasă, Articole, Comunicate, Evenimente, Organizații afiliate,
Cursuri, Galerie foto, Galerie video, Documente.
Fiecare înregistrare generează automat propria pagină, din același șablon (RecordLayout).

---

## Meniul principal
Acasă · Organizația · Membri · Expoziții · Chinologie · Educație · Afiliați · Noutăți · Magazin · Contact

---

## 1. ACASĂ
Pagina principală conține:
- Hero (prima secțiune vizibilă: imagine/fundal video, numele organizației, slogan, text scurt, 1–2 butoane principale)
- Prezentarea asociației
- Calendarul următoarelor evenimente
- Ultimele noutăți
- Devino membru
- Asociații și cluburi afiliate
- Standarde de rasă
- Educație
- Statistici instituționale
- Galerie multimedia
- Newsletter
- Parteneri
- Footer

## 2. ORGANIZAȚIA
Subpagini: Despre Asociație · Misiune · Viziune · Valori · Obiective · Istoric · Conducerea · Organigrama ·
Corpul de Arbitri · Canise înregistrate · Membri de Onoare · Parteneri · Organizații internaționale ·
Transparență instituțională.

În cadrul secțiunii Transparență: Statut · Act constitutiv · Regulamente · Hotărâri · CIF · IBAN ·
Situații financiare · Documente publice.

## 3. MEMBRI
Subpagini: Devino membru · Beneficii · Cotizații · Formulare · Documente · Întrebări frecvente.
Zona „Contul meu" este accesibilă prin autentificare și nu apare în meniul principal.

## 4. EXPOZIȚII
Subpagini: Calendar expozițional · Evenimente · Înscrieri · Regulamente · Rezultate · Clasamente ·
Galerie · Organizatori · Sponsori.
Expozițiile sunt o colecție dedicată (un fișier = o expoziție).

## 5. CHINOLOGIE
Subpagini: Standardele raselor · Legislație · Regulamente chinologice · Bibliotecă digitală ·
Dicționar chinologic · Resurse · Descărcări.
Standardele raselor sunt o colecție separată, fiecare rasă cu propria pagină generată automat.

## 6. EDUCAȚIE
Subpagini: Școala de Arbitraj · Cursuri · Webinare · Examene · Certificări · Biblioteca educațională ·
Materiale foto-video.

## 7. ASOCIAȚII MEMBRE / AFILIATE
Subpagini: Străjerii Munților · Asociația Chinologică din Caraș-Severin · Club Federal Chinologic Buzău ·
Asociația Chinologică Profesională · Centrul Profesional de Dezvoltare a Competențelor Chinologice ·
Devino afiliat.

## 8. NOUTĂȚI
Subpagini: Comunicate · Știri · Interviuri · Evenimente · Articole · Editoriale.
Articolele sunt administrate printr-o colecție dedicată (cu câmp de categorie).

## 9. MAGAZIN
Modul separat, pentru mai târziu (pe site static: Snipcart sau Stripe). Acum doar un loc în meniu.

## 10. CONTACT
Conținut: Formular de contact · Hartă Google · Adresă · Program · Telefon · E-mail · CIF · IBAN.

---

## Navigație

### Header superior
Selector limbă (RO / EN) · Căutare · Magazin · Contul meu

### Footer
- **Organizația:** Despre noi · Organigramă · Statut · Documente
- **Activități:** Expoziții · Educație · Standarde · Noutăți
- **Membri:** Devino membru · Beneficii · Contul meu
- **Informații juridice:** Politica de confidențialitate · Politica privind cookie-urile · Termeni și condiții · Politica magazinului
- **Date oficiale:** Adresă · Telefon · E-mail · CIF · IBAN · Program
- **Social media:** Facebook · Instagram · YouTube · TikTok
- **Newsletter:** formular de abonare

---

## Colecții recomandate (conținut dinamic)
Expoziții · Arbitri · Canise · Standarde de rasă · Articole · Comunicate · Evenimente ·
Organizații afiliate · Membri de onoare · Cursuri · Galerie foto · Galerie video · Documente.

## Funcționalități pentru dezvoltări viitoare
Platforma trebuie să permită integrarea, fără restructurări majore, a modulelor:
registru genealogic online; registrul arbitrilor; registrul caniselor; sistem online de înscriere la
expoziții; emiterea certificatelor și diplomelor; verificarea documentelor prin cod QR; platformă
e-learning; bibliotecă digitală extinsă; zonă dedicată membrilor și afiliaților; fluxuri administrative
interne; panouri dedicate comisiilor; automatizări pentru Secretariat; integrarea serviciilor AI;
interoperabilitate cu platforme și organizații partenere.

## Principiul general de dezvoltare
Ecosistem digital instituțional, modular și scalabil. Structura informațională rămâne stabilă în timp,
astfel încât extinderea să se facă prin adăugarea de conținut și funcționalități noi, fără reorganizarea
arhitecturii existente.
