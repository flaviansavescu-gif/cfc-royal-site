# cfc-royal.ro — descrierea completă a caracteristicilor site-ului

Site-ul instituțional al **Clubului Federal Chinologic – Royal** (membru World Dog
Federation), împreună cu platforma proprie a Școlii de Arbitraj și serviciile live
legate de managerul de expoziții. Live la **cfc-royal.ro** (apex), găzduit pe Netlify,
publicat automat din depozitul GitHub la fiecare commit.

*Actualizat: 21 iulie 2026.*

---

## 1. Fundația tehnică și identitatea

- **Astro 5, site static pur** — fără WordPress, fără bază de date clasică; partea
  dinamică rulează în funcții Netlify + Netlify Blobs.
- **Bilingv**: rute `/ro/` (implicit) și `/en/`, cu comutator de limbă robust
  (slug-uri identice în ambele limbi); platforma de cursuri și serviciile live sunt
  în română.
- **Design instituțional**: paletă verde heraldic + auriu pe fundal deschis; titluri
  Source Serif 4, text Source Sans 3, CIF/IBAN în IBM Plex Mono — toate definite
  într-o singură sursă de tokens; fonturi self-hosted (fără CDN-uri externe), cu
  cache imuabil.
- **Diacritice românești corecte** (ș/ț cu virgulă) peste tot.
- **Accesibilitate** (țintă WCAG 2.1 AA), zero JavaScript inutil, performanță de site
  static.
- **Antete de securitate** (X-Frame-Options, nosniff, Referrer-Policy,
  Permissions-Policy); rădăcina apex servește direct homepage-ul RO prin rewrite,
  ca linkul scurt cfc-royal.ro să genereze corect cardul social
  (WhatsApp/Facebook, Open Graph).
- **Pagina 404**, robots.txt generat, redirecționări istorice întreținute
  (redenumiri de secțiuni fără linkuri moarte).

## 2. Structura publică (navigația)

- **Acasă** — pagina principală, cu identitatea clubului.
- **Organizația**: Despre asociație · Conducere · **Colegiul de arbitri** · **Canise
  înregistrate** · **Membri de onoare** · Transparență instituțională (statut și
  documente).
- **Membri**: Devino membru · Beneficii · **Cotizații** (cu IBAN-ul clubului, titular,
  bancă).
- **Expoziții**: **Înscriere online** · Calendar expozițional (afișul anual) ·
  **Expoziții organizate** (calendarul viu — vezi §5) · Câini campioni.
- **Chinologie**: **Standardele raselor** (cele 5 rase de ciobănești românești:
  Bălan, Carpatin, Corb, de Bucovina — Grupa II conform WDF, Mioritic) ·
  **Regulamente WDF**.
- **Educație**: Centrul de Dezvoltare a Competențelor Chinologice · Cursuri
  (platforma Școlii de Arbitraj — vezi §7).
- **Asociații membre** — organizațiile afiliate clubului.
- **Noutăți**: Comunicate · Articole · Evenimente.
- **Magazin** — secțiune planificată (modul separat, ulterior).
- **Contact** — formular prin Netlify Forms.
- **Juridic** (în subsol): Politica de confidențialitate · Politica de cookie-uri ·
  Termeni și condiții.

## 3. Conținutul ca sistem (14 colecții)

Tot conținutul care crește stă în colecții tipizate (un fișier Markdown = o pagină,
cu schemă validată la build): **arbitri**, **articole**, **campioni**, **canise**,
**comunicate**, **cursuri**, **documente**, **evenimente**, **expoziții**,
**membri de onoare**, **organizații afiliate**, **pagini** (conținutul static al
secțiunilor), **regulamente**, **standarde de rasă**. Paginile individuale se
generează printr-un layout unic de înregistrare; adăugarea de conținut nu cere
niciun cod.

## 4. Registrul public al arbitrilor (/arbitri/)

- Adună **două surse, dedup după nume**: colegiul editorial (colecția `arbitri`) și
  **arbitrii certificați automat prin Școala de Arbitraj** (cei marcați „public" la
  certificare apar singuri, cu grupele WDF autorizate și localitatea).
- Sursă unică de adevăr pentru cine are drept de arbitraj și pe ce grupe — aceeași
  informație alimentează și avertismentele din managerul de expoziții.

## 5. Expoziții — serviciile publice legate de manager

### Formularul de înscriere online (RO/EN)
- Lista expozițiilor **publicate din manager** (dispare automat la închiderea
  catalogului sau la ștergere — fără „expoziții fantomă").
- Nomenclatorul complet WDF: **431 de rase pe grupele 1–10**, cu căutare în listă.
- Validări impuse și pe server: clasa față de vârsta câinelui **la data expoziției**,
  microcip obligatoriu, pedigree obligatoriu cu excepția declarată a **pedigree-ului
  de tipicitate**, e-mail valid, GDPR bifat.
- **Data nașterii se tastează** (zz.ll.aaaa, punctele se pun singure) — fără
  calendarul greoi de pe telefon.
- **Plata taxei**: formularul afișează taxa clasei alese și datele de plată (IBAN),
  și cere obligatoriu bifa „Am plătit taxa" + **dovada plății** (poză/PDF, max. 4 MB)
  la clasele cu taxă; dovada e stocată criptat și ștearsă după importul în manager.
- Confirmare vizibilă cu rezumatul trimiterii; **e-mail automat de primire** (Brevo,
  de pe domeniul clubului, cu SPF/DKIM configurate).
- Blocul informativ „Cum funcționează înscrierea" (5 pași) — vizibil și când nu sunt
  expoziții deschise.
- Protecții: limită de dimensiune, limitare de ritm, deduplicare, secret comun pentru
  acțiunile managerului.

### Calendarul competițional viu (/ro/expozitii · /en/expozitii)
- **Înscrieri deschise**: edițiile publicate, cu termen și buton spre formular.
- **Rezultate publicate**: DOAR edițiile cu rezultate publicate (edițiile de test sau
  retrase nu apar niciodată public), cu link spre pagina lor.
- Trimitere spre transmisia live din ziua expoziției.

### Rezultatele publicate (/rezultate-live/)
- Pagina fiecărei ediții cu **doar titlurile acordate** (CAJC/CAC/CACIB, BOB-uri,
  Best Puppy, BBR, clasările Best in Show) — decizia clubului: fără calificativele
  individuale ale câinilor; index al edițiilor publicate; publicare și retragere din
  manager, cu secretul comun.

### Adresele stabile și transmisia live
- **`cfc-royal.ro/r/<cale>`** — adrese permanente pentru ecranele de ring, ringul de
  onoare și panoul public: site-ul redirecționează spre tunelul curent al
  managerului, deci **QR-urile tipărite nu expiră niciodată**; tunel oprit = pagină
  de așteptare politicoasă care se reîncearcă singură.
- **`cfc-royal.ro/live`** — linkul veșnic al panoului: duce mereu la programul live
  al expoziției curente (managerul anunță singur care e).

### Verificarea certificatelor (/verifica)
- Orice certificat oficial emis de manager poartă un **cod QR de verificare**:
  pagina publică `/verifica?c=…` confirmă autenticitatea actului — codul conține
  datele și o **semnătură HMAC** recalculată pe server (certificat
  auto-verificabil, fără bază de date).

## 6. Newsletter, căutare, formulare

- **Newsletter**: abonare prin funcție proprie în Brevo, cu pagină de mulțumire.
- **Căutare pe site** (Pagefind): index generat la build, căutare instantanee fără
  server, cu diacritice.
- **Contact**: formular Netlify Forms cu protecție anti-spam.

## 7. Platforma Școlii de Arbitraj (/cursuri/)

Platformă proprie, integrată în site (funcții Netlify + Blobs) — fără servicii
externe de e-learning.

- **Acces**: cod de acces + **coduri individuale de candidat** (generate de admin,
  alfabet fără caractere ambigue, ușor de dictat); candidatul e identificat prin
  amprenta codului — codul nu se expune niciodată.
- **17 module de curs** cu conținut structurat; **test grilă per modul**, corectat
  **pe server** (cheile nu ajung niciodată în browser), prag de promovare 70%;
  modulele pot fi deschise/ascunse de admin, pe măsură ce avansează seria.
- **Anunțuri** către candidați; **tabloul de progres** al fiecărui candidat.
- **Examenul final**: bancă de întrebări pe server, extrage 25, prag 75%, pauză de
  7 zile după picare, notificarea secretariatului pe e-mail la fiecare susținere.
- **Asistențele de ring** (stagiul practic): programul celor 5 expoziții cu arbitrii
  coordonatori; candidatul își vede numirile, prezențele și **evaluarea primită de la
  arbitrul de bază** (calificativ + observații — venite din managerul de expoziții);
  adminul administrează numirile și vede evaluările în matrice.
- **Certificarea pe grupe WDF**: matrice candidat × 10 grupe + marcaj „Public" +
  localitate → arbitrul apare **automat** în registrul public /arbitri/.
- **Spațiile lectorilor** cu **teleprompter** pentru predare.
- **Administrare**: candidați (coduri), module, anunțuri, progres, rezultate,
  asistențe, certificare.
- **Punțile cu managerul de expoziții** (secret comun): starea candidaților și
  numirilor, scrierea prezențelor și evaluărilor din ring, **dosarul complet al
  candidatului** (module + examen + asistențe + autorizare) pentru PDF-ul comisiei
  de certificare, lista autorizărilor pe grupe.

## 8. Infrastructura de date și securitatea

- **Netlify Blobs** — două depozite: `expozitii` (configurațiile publicate, coada de
  înscrieri, dovezile de plată, rezultatele publicate, adresa tunelului) și `cursuri`
  (candidați, progres, examene, asistențe, evaluări, autorizări).
- **Secrete**: acțiunile managerului sunt protejate de un secret comun
  (EXPO_SYNC_SECRET); platforma de cursuri de coduri cu hash; cheile de e-mail
  (Brevo) doar în variabile de mediu.
- **E-mail de pe domeniul clubului**: Brevo (site) și Zoho (manager), cu SPF, DKIM și
  DMARC publicate în DNS.
- **Confidențialitate**: panourile publice nu expun date personale; dovezile de
  plată se șterg din cloud după import; rezultatele publice conțin doar titlurile;
  paginile juridice (GDPR, cookie-uri, termeni) sunt publicate.
- **Fluxul de publicare**: commit → GitHub → build Netlify automat; regulă de lucru:
  nu se publică fără confirmarea proprietarului.
