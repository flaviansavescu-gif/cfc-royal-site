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

- **SPF:** `v=spf1 include:zohomail.eu include:spf.brevo.com ~all` — cuprinde amândoi
  expeditorii. ✔ pus în ziua de 29 iulie 2026.
- **DKIM:** configurat pentru amândouă (`brevo1`, `brevo2`, `zmail`).
- **DMARC:** `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` — se raportează, dar nu se
  oprește nimic. **Rămas de urcat la `quarantine` după 29 august 2026.**

### Ce e de schimbat, în DNS-ul de la Netlify

**Netlify → Domains → cfc-royal.ro → DNS records.**

#### ✔ Pasul 1 — FĂCUT la 29 iulie 2026: Brevo a intrat și în SPF

Valoarea de acum, pe `cfc-royal.ro` (rădăcină):

```
v=spf1 include:zohomail.eu include:spf.brevo.com ~all
```

Mesajele automate se dovedesc de-acum și prin SPF, nu doar prin DKIM: dacă mâine cheia
DKIM de la Brevo se schimbă din greșeală, mesajele tot ajung.

**O singură înregistrare SPF pe domeniu.** Două se anulează reciproc. Netlify nu dă „Edit"
pe TXT — se șterge cea veche și se adaugă cea nouă, în ordinea asta: cât timp nu există
niciuna, DKIM ține locul; dacă ar exista două deodată, SPF-ul ar fi invalid.
La câmpul Name se scrie numele întreg, `cfc-royal.ro`, nu se lasă gol.

#### Pasul 2, după 29 august 2026: DMARC se face lucrativ

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

### Copie ACUM, în afara programului

Copiile automate cad duminica. Când vrei una pe loc — după ce ai schimbat parola de
criptare, înaintea probei anuale, sau înaintea unei schimbări mari — există funcția
`copie-acum.mjs`. Rulează exact aceeași logică (registrul + celelalte magazii), apoi
**aduce arhivele înapoi de pe ramură și le descifrează cu parola de acum**: răspunsul nu
spune doar „am scris o arhivă", ci „am scris o arhivă pe care parola de acum chiar o
deschide".

E protejată cu secretul comun `EXPO_SYNC_SECRET` (cel dintre manager și site), printr-un
POST — nu în adresă, ca să nu rămână în jurnale. Cel mai simplu se apasă de pe laptop:
dublu-clic pe `Copie acum (site).cmd` din folderul de operare (secretul se ia singur din
`.env`-ul managerului).

### Schimbarea unei parole de criptare

O parolă nouă **nu** deschide arhivele vechi — sunt criptate cu cea veche. Ordinea contează:

1. Pune parola nouă în Netlify (`BACKUP_REGISTRU_PAROLA`) **și pe telefon, în aceeași clipă**.
2. Redeploy (schimbarea unei variabile intră în funcții doar la următorul deploy).
3. Rulează **Copie acum** → arhive proaspete, criptate cu parola nouă, auto-verificate.
4. Șterge de pe ramură arhivele vechi: nimeni nu le mai poate deschide, iar dacă rămân par
   copii de nădejde când nu sunt.

Datele vii nu se ating niciodată — se schimbă doar cheia copiilor de aici înainte.

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
