# Poșta, DNS-ul și copiile de siguranță

Trei lucruri care se strică în tăcere. Nimeni nu primește o alertă când un mesaj ajunge în
spam sau când o copie de siguranță nu se mai face — de aceea se verifică, nu se presupun.

---

## 1. Autentificarea e-mailului

Sistemul trimite lucruri care **trebuie** să ajungă: coduri de acces, confirmări de
înscriere, diplome, buletinul Școlii. Dacă domeniul nu-și dovedește mesajele, ele intră în
„promoții" sau în spam.

Se trimite din două locuri:

| De unde | Ce pleacă | Adresa |
|---|---|---|
| **Zoho Mail** | corespondența scrisă de oameni | contact@cfc-royal.ro |
| **Brevo** | mesajele automate ale sistemului | newsletter@cfc-royal.ro |

### Cum se verifică

```bash
node scripts/verifica-posta.mjs
```

Se rulează când schimbi ceva la DNS sau la furnizorul de e-mail, și o dată pe an.

### Starea la 29 iulie 2026

- **SPF:** `v=spf1 include:zohomail.eu ~all` — cuprinde Zoho, **nu** cuprinde Brevo.
- **DKIM:** configurat pentru amândouă (`brevo1`, `brevo2`, `zmail`). Mesajele automate se
  dovedesc, așadar, prin DKIM.
- **DMARC:** `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` — se raportează, dar nu se
  oprește nimic.

Nu e stricat: DKIM aliniat e de ajuns ca DMARC să treacă. Dar totul stă într-un singur
picior, iar rapoartele nu opresc pe nimeni.

### Ce e de schimbat, în DNS-ul de la Netlify

**Netlify → Domains → cfc-royal.ro → DNS records.**

#### Pasul 1, acum: Brevo intră și în SPF

Modifică înregistrarea TXT existentă pentru `cfc-royal.ro`:

| | |
|---|---|
| Tip | TXT |
| Nume | `cfc-royal.ro` (rădăcina) |
| Valoare veche | `v=spf1 include:zohomail.eu ~all` |
| **Valoare nouă** | `v=spf1 include:zohomail.eu include:spf.brevo.com ~all` |

**O singură înregistrare SPF pe domeniu.** Două se anulează reciproc — nu adăuga una nouă,
modific-o pe cea existentă.

Efect: mesajele automate se dovedesc și prin SPF, nu doar prin DKIM. Dacă mâine cheia DKIM
de la Brevo se schimbă din greșeală, mesajele tot ajung.

#### Pasul 2, peste o lună: DMARC se face lucrativ

Intră în Brevo → *Senders, Domains & Dedicated IPs* → raportul DMARC și uită-te o lună la
el. Cauți un singur lucru: **trimite cineva în numele domeniului fără să fie noi?** Dacă
nu, modifică înregistrarea:

| | |
|---|---|
| Tip | TXT |
| Nume | `_dmarc.cfc-royal.ro` |
| Valoare veche | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |
| **Valoare nouă** | `v=DMARC1; p=quarantine; pct=100; rua=mailto:rua@dmarc.brevo.com; fo=1` |

De la `p=quarantine`, un mesaj care se dă drept al asociației fără să se poată dovedi
ajunge în spam la destinatar, nu în inbox. Peste încă o lună liniștită se poate trece la
`p=reject`, care îl oprește de tot.

**Nu sări peste luna de așteptare.** Dacă există un expeditor legitim uitat — un formular
vechi, un serviciu de facturare — `quarantine` îi taie mesajele fără să te anunțe.

După fiecare schimbare, rulează din nou verificatorul. DNS-ul se așază în câteva minute.

---

## 2. Copiile de siguranță

Datele stau în opt magazii Netlify Blobs. Toate au copie automată săptămânală, criptată,
pe ramura privată `backup-registru`, în `copii/`.

| Funcție | Ce salvează | Când |
|---|---|---|
| `registru-backup.mjs` | magazia `registru` — cartea de origini | duminică, 3:00 |
| `magazii-backup.mjs` | `cursuri`, `expozitii`, `jcr`, `paa`, `interese`, `breed`, `acte-revocate` | duminică, 3:30 |

Ce **nu** se salvează, dinadins:

- cheile trecătoare (sesiuni, coduri de instalare, jetoane de dispozitiv, limitări) — nu se
  restaurează nimic din ele, iar o copie care le-ar căra ar fi un dosar de chei;
- paginile-imagine ale materialului de studiu — se refac din PDF-ul original, într-o oră.

Amândouă cer aceleași variabile de mediu: `BACKUP_REGISTRU_PAROLA`, `BACKUP_GITHUB_TOKEN`,
`BACKUP_GITHUB_REPO`, `BACKUP_GITHUB_RAMURA`.

### Cum se deschide o copie

```bash
node scripts/descifreaza-copie.mjs copii/cursuri-2026-08-02.zip.enc
```

Cere parola de la tastatură. Iese un ZIP obișnuit, cu `CUPRINS.md` înăuntru care explică ce
e fiecare lucru. **Parola trebuie să existe și în afara sistemului** — pe telefon, în seif.
O copie pe care n-o poți descifra nu e o copie.

### Proba anuală

O dată pe an, deschide o copie adevărată de pe ramură și uită-te în ea. Lanțul întreg —
arhivare, criptare, descifrare — e probat automat la fiecare build de
`scripts/proba-copie.mjs`, dar proba aceea folosește date născocite. Restaurarea adevărată
se dovedește o singură dată: când ai nevoie de ea.

| Proba făcută la | De cine | Ce s-a deschis | A mers? |
|---|---|---|---|
| | | | |

---

## 3. Verificarea automată a codului

La fiecare împingere în depozit, GitHub rulează `.github/workflows/verifica.yml`:
sintaxa scripturilor din pagini, tarifele din conținut, toate probele și build-ul întreg.
Aceleași probe rulează și înainte de fiecare build (`prebuild`), deci **dacă o probă cade,
site-ul nu se publică.**

Local:

```bash
npm test
```
