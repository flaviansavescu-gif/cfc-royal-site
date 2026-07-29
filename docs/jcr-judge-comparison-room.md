# ADR — Judge Comparison Room (JCR)

Modul pedagogic pentru platforma Școlii de Arbitraj (`/cursuri/`). Cursanții analizează
aceeași resursă (foto/set imagini), trimit răspunsuri individuale ascunse, apoi compară
cu baremul lectorului. Instrument didactic — **nu** produce verdicte oficiale.

## 1. Realitatea stack-ului (adaptarea specificației)

Specificația e scrisă generic (DB relațională, Prisma, migrații, RBAC pe rute tipizate).
Platforma REALĂ e alta și **nu o rescriem**:

| Specificație generică | Realitatea CFC-Royal | Decizie |
|---|---|---|
| DB SQL + migrații + FK | **Fără DB.** Persistență = **Netlify Blobs** (KV JSON) | Modelăm „tabelele" ca namespace-uri de chei Blob. „Migrațiile" = layout de chei documentat + seed idempotent. |
| API tipizat (rute REST) | **Netlify Functions** `.mjs` | Un handler per resursă, validare pe server, ca funcțiile existente. |
| Auth cu sesiuni/JWT per user | **Gating pe cod** (admin/lector/candidat) | RBAC = verificare hash cod (admin/lector) sau cod individual candidat (`login-cursuri`) + apartenență la sesiune. |
| Prisma types | TS în `src/data` + JSDoc în funcții | Tipuri partajate într-un `src/data/jcr.ts` (interfețe) + validatori pe server. |
| Test runner (vitest/jest) | **Niciunul instalat** | Algoritmii de comparație = funcții pure în `.mjs`, testate cu `node --test` (zero dependențe noi). Integrare lector↔cursant: checklist manual documentat (fără `netlify dev` local). |

Fără dependențe majore noi. Refolosim: `@netlify/blobs`, `CursuriLayout`, tokenurile de design, convenția funcțiilor `*-cursuri.mjs`, gating-ul din `data/cursuri.ts`.

## 2. Roluri și RBAC

- **Administrator** — cod admin (`ADMIN_HASH`): config, taxonomii, standarde WDF, audit.
- **Lector** — cod lector (`LECTORI[].hash`, slug): CRUD sesiuni, barem, publicare, vede toate răspunsurile, feedback.
- **Cursant** — cod individual (candidat, `login-cursuri` → `id`): vede doar sesiunile alocate; scrie/trimite propriul răspuns; NU vede baremul/răspunsurile altora înainte de deblocare.
- **Moderator/observator** — cod dedicat opțional (fază ulterioară), permisiuni de citire configurabile.

**Fiecare funcție** verifică: (a) rolul prin hash cod, ȘI (b) apartenența la sesiune/grupă
(candidatul trebuie să fie în `session.participants`; lectorul trebuie să fie proprietarul
sau co-lector). Niciodată doar rolul global.

## 3. Model de date (namespace-uri Blob, store `jcr`)

```
jcr/session/<sessionId>                         -> Session (metadata, status, visibility, resourceRef, criteriaSetId, wdfStdRef)
jcr/session-index                               -> [{id,titlu,status,grupa,rasa,lector,termen}]  (listă pt. filtrare)
jcr/participants/<sessionId>                    -> { candidateIds:[...], grupa }
jcr/resource/<resourceId>/meta                  -> CaseResource (tip, autor, licență, alt-text, imageKeys[])
jcr/resource/<resourceId>/img/<n>               -> binar imagine (privat; servit prin funcție gated)
jcr/criteria/<criteriaSetId>                    -> Criteria[] (rubrică: cod, etichetă, zonă anatomică, tip)
jcr/response/<sessionId>/<candidateId>          -> Response (observations[], calificativ, clasament[], justificare, status draft/submitted, timp, formVersion)
jcr/reference/<sessionId>                       -> ReferenceEvaluation (observations[], defecte, calificativ, clasament, ponderi, explicații+referințe std); ASCUNS până la unlockAt/manual
jcr/comparison/<sessionId>/<candidateId>        -> ComparisonResult (cache; recalculabil)
jcr/feedback/<sessionId>/<candidateId>          -> Feedback individual;  jcr/feedback/<sessionId>/_group -> feedback colectiv
jcr/wdf-std/<rasa>/<versiune>                   -> WdfStandardVersion (sursă, dată, status current/deprecated)
jcr/audit/<sessionId>/<ts>-<rand>               -> AuditEvent (actor, acțiune, țintă)
```

Fără FK reale → integritatea se aplică în cod. Indexare = chei-listă (`session-index`) +
`store.list({prefix})`. Soft-delete: nu e standardul proiectului → folosim `status:"archived"`.

## 4. Endpointuri (Netlify Functions)

Toate `POST {cod, actiune, ...}`, răspuns JSON `no-store`, ca funcțiile existente.

- `jcr-sesiuni.mjs` — lector/admin: `lista|creaza|salveaza|publica|inchide|arhiveaza|detalii`; cursant: `alocate|detalii(gated)`.
- `jcr-resurse.mjs` — lector: `upload|meta|sterge`; servire imagine gated: `jcr-media.mjs?token`.
- `jcr-raspuns.mjs` — cursant: `schita|trimite|autoal-meu`; lector: `toate(sessionId)`.
- `jcr-barem.mjs` — lector: `salveaza|publica`; cursant: `citeste` (doar după unlock).
- `jcr-comparatie.mjs` — cursant: `a-mea(sessionId)` (după unlock); lector: `grup(sessionId)` (anonimizat; `deblocheaza-nume`).
- `jcr-feedback.mjs` — lector: `salveaza|publica(individual|grup)`; cursant: `citeste`.
- `jcr-raport.mjs` — lector: `sesiune(sessionId)` + `export-csv`.
- Algoritmi puri: `netlify/functions/_jcr/compare.mjs` (defecte, calificativ, Spearman/Kendall) — importat de funcții + testat cu `node --test`.

## 5. Algoritmi de comparație (deterministă, explicabilă)

- **Defecte**: pe `cod` + `gravitate`. Ieșire per defect: `acord | acord-parțial(gravitate diferită) | omis | suplimentar`.
- **Calificativ**: scală ordinală (Excellent > Very Good > Good > Sufficient > …). Scor = distanță (diferența de index), cu semn.
- **Clasament**: **Spearman ρ** și **Kendall τ** dacă ≥ 2 exemplare; altfel „N/A".
- **Text/observații**: rubrică + etichete, potrivire deterministă pe `criteriaId`. Similitudine semantică = **opțională, etichetată explicit, aprobată de lector** (fază ulterioară; NU în MVP, NU prezentată ca adevăr).
- Fiecare rezultat poartă `motiv` (de ce e încadrat așa).

## 6. Media
Upload prin `jcr-resurse.mjs` (validare tip `image/jpeg|png|webp`, dimensiune max, doar lector).
Stocare privată în Blobs. Servire prin `jcr-media.mjs` care verifică accesul (participant la
sesiune sau lector) și întoarce imaginea — echivalentul „URL-urilor semnate".

## 7. Interfață (Astro sub `/cursuri/`, `CursuriLayout`)
- `cursuri/analiza/index.astro` — dashboard cursant (sesiuni active, termene, progres, feedback recent).
- `cursuri/analiza/[sesiune].astro` — Sala de analiză (resursă mare, formular, cronometru opțional, schiță/trimitere; slot pt. adnotări vizuale).
- `cursuri/analiza/[sesiune]/comparatie.astro` — comparație individuală (răspuns vs barem + feedback).
- `cursuri/admin/analiza/index.astro` — listă sesiuni lector + „Sesiune nouă".
- `cursuri/admin/analiza/[sesiune].astro` — editor lector (metadate, resursă, rubrică, barem, vizibilitate, publicare) + comparație grup + raport.
Responsive, accesibil (tastatură, contrast, focus, label), RO, pregătit i18n.

## 8. Securitate & audit
Validare integrală pe server; limită upload; audit la: publicare sesiune, trimitere răspuns,
modificare barem, deblocare identitate, export. Baremul/răspunsurile NU se expun înainte de
momentul/permisiunea corectă (gardă în funcție, nu doar în UI).

## 9. Livrare pe faze
- **Faza 0 (acest ADR)** — plan + tipuri + layout chei. ✅
- **Faza 1 (MVP, pilot 1 rasă / 1 grupă)**: sesiune cu **1 fotografie** + rubrică simplă; formular structurat (observații/defecte/gravitate/calificativ/clasament/justificare); schiță+trimitere ascunsă; barem; **comparație individuală deterministă**; feedback individual; audit de bază. Teste unitare pt. `compare.mjs`.
- **Faza 2**: comparație de grup anonimizată + raport de sesiune + export CSV + istoric cursant.
- **Faza 3**: set de imagini, standarde WDF versionate legate de criterii, moderator/observator.
- **Faza 4 (după 2–3 sesiuni reale)**: adnotări vizuale, video, câine virtual, similitudine semantică (opțională, aprobată de lector).

## 10. Riscuri
- Fără DB → integritate în cod + teste; atenție la curse la scriere concurentă (Blobs e „last write wins" — folosim chei per-candidat, evităm documente partajate mari).
- Fără `netlify dev` local → fluxul lector↔cursant se validează pe deploy (preview) + teste unitare pe algoritmi.
- Costuri Blobs la imagini → limită dimensiune + una–două imagini/sesiune în MVP.

## 11. Decizii deschise (pentru proprietar)
1. Alocarea cursanților la sesiune: pe **toată grupa** vs. **selecție explicită** de candidați?
2. Participanții sunt **candidații existenți** (coduri individuale) — corect? (moderatorii vin în Faza 3)
3. „Timp limită" al sesiunii = **soft** (doar cronometru informativ) vs. **hard** (blochează trimiterea)?
