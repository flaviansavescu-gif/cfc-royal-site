# ADR — Photo Anatomy Annotator (PAA)

Modul educațional pentru Școala de Arbitraj: candidatul încarcă o fotografie laterală a unui
câine, plasează repere anatomice, trage linii/unghiuri, măsoară procente și raporturi, apoi
compară cu standarde de rasă versionate. **Estimări 2D — NU o evaluare oficială.**

## 1. Realitatea stack-ului (adaptarea specificației)

Specificația e scrisă generic (DB relațională, migrații, file storage clasic). Platforma reală:
Astro static + **Netlify Blobs** + **Netlify Functions**, gating pe cod. Nu rescriem arhitectura.

| Specificație | Realitatea CFC-Royal | Decizie |
|---|---|---|
| Migrații (ImageAsset, AnnotationSession, Layer, Annotation, Measurement, BreedStandardVersion, StandardMetric, Review) | Fără DB | Namespace-uri de chei în store `paa` (Blobs). „Migrația" = layout documentat. |
| File storage, „nu base64 în DB" | Netlify Blobs stochează binar | Imaginea = **binar în Blobs** (`paa/image/<id>`), servită doar prin funcție gated. Metadatele separat (JSON). Zero base64 în „DB". |
| Auth cu roluri | Gating pe cod | Cursant = `cid` (id candidat); Lector = cod lector; Admin standarde = cod admin. |
| Teste unit/integrare/e2e | node --test | Măsurătorile (distanță, unghi, raport, status interval) = funcții pure testate; restul = checklist pe deploy. |

**Livrare ca aplicație instalabilă cu cod** (cerință explicită, ca la Breed Explorer): PAA e un
**PWA standalone la `/photo-annotator/`**, cu manifest injectat doar după un **cod de instalare**
(funcție `paa-instalare`, coduri `PAA-XXXXX`, generate de admin). Salvarea sesiunilor folosește
identitatea platformei (cid candidat / cod lector). Link din tabloul candidatului + spațiul lectorului.

## 2. Roluri și RBAC
- **Cursant** (`cid`): propriile sesiuni (creare, salvare, export).
- **Lector** (cod): vede și comentează sesiunile alocate.
- **Administrator de standarde** (cod admin): gestionează standardele versionate + audit.
Fiecare funcție verifică rolul ȘI apartenența (sesiunea aparține candidatului; lectorul e alocat).

## 3. Model de date (store `paa`)
```
paa/session/<id>                 -> AnnotationSession { userId, curs, rasa, stdVersion, creat,
                                     calibrare, layers[], annotations[], measurements[], imageId }
paa/session-index                -> [ {id,userId,rasa,creat,titlu} ]
paa/image/<id>                   -> binar imagine (privat; servit gated)
paa/image-meta/<id>              -> { userId, contentType, w, h, marime, creat }
paa/std/<rasa>/<versiune>        -> BreedStandardVersion { sursa, dataVigoare, status, demo:true,
                                     metrics:[ {metrica,unitate,min,max,tinta,severitate,explicatie} ] }
paa/std-index                    -> [ {rasa,versiune,status,demo} ]
paa/review/<sessionId>           -> [ {lector, text, ts} ]
paa/audit/std/<ts>-<rand>        -> { actor, actiune, tinta }
```

## 4. Adnotări & măsurători (coordonate normalizate 0..1)
- Tipuri adnotări: `point` (reper), `line`, `polyline`, `angle` (A-B-C), `label`, `measurement`.
- Repere: greabăn, crupă, stern, umăr, cot, carp, șold, genunchi, jaret, baza cozii.
- Straturi: vizibil / ascuns / blocat.
- Coordonate 0..1 (independente de rezoluție) + `aspect` (w/h) al imaginii pentru distanțe corecte.
- Funcții pure (`_paa/masuratori.mjs`, testate):
  - `distanta(a,b,aspect)` euclidiană în spațiul imaginii;
  - `unghiABC(a,b,c)` în grade;
  - `procent(x, referinta)`, `raport(x,y)`;
  - `statusInterval(valoare, metric)` -> conform | neconform | informativ | neconcludent.
- Calibrare: **relativ** (implicit, totul raportat la înălțimea la greabăn), **greabăn cunoscut** (cm),
  **reper fizic** (2 puncte + lungime reală).
- Metrici MVP: indice corporal = 100·lungime corp / înălțime greabăn; adâncime torace = 100·adâncime/greabăn;
  segment membru anterior = 100·segment/greabăn; raport craniu-bot.

## 5. Explicații didactice (deterministe)
Din date structurate: *ce s-a măsurat · formula · valoarea · intervalul standardului · următorul reper*.
Interfață server-side pregătită pentru un viitor AI cu **ieșire JSON validată**; AI-ul NU dă verdicte
și NU are acces la imagini fără configurare explicită. (Fază ulterioară.)

## 6. Funcții (Netlify)
`paa-sesiuni` (CRUD + salvare/restaurare) · `paa-imagine` (upload validat + servire gated) ·
`paa-standarde` (admin: CRUD versionat + audit; citire publică pt. calcul) · `paa-review` (lector) ·
`paa-instalare` (coduri de instalare). Algoritmi puri: `_paa/masuratori.mjs`, `_paa/explicatii.mjs`.

## 7. UX
Canvas central; instrumente la stânga; straturi + rezultate la dreapta. Zoom/pan, selecție, undo/redo,
tastatură, focus vizibil, contrast WCAG AA, responsiv. Stări goale, erori de încărcare, avertisment
pentru fotografii neadecvate. Banner permanent „estimări 2D, nu evaluare oficială". Fără decor inutil.
Identitate vizuală CFC-Royal (aceleași tokenuri).

## 8. Livrare pe faze
- **Faza 0** — ADR (acesta). ✅
- **Faza 1 (MVP)**: PWA `/photo-annotator/` instalabil cu cod; auth candidat; upload imagine privată;
  canvas cu repere/linii/unghiuri/etichete + straturi + undo/redo + zoom/pan; cele 4 metrici + calibrare
  relativ & greabăn cunoscut; explicații deterministe; 1 standard **demo** marcat + statusuri; salvare/restaurare;
  export PNG/JSON; teste pt. măsurători.
- **Faza 2**: review lector + comentarii; UI admin standarde versionate + audit; calibrare cu reper fizic; mai multe metrici.
- **Faza 3**: interfață AI (server-side, JSON validat, fără verdicte); reper fizic avansat; video.

## 9. Riscuri
- Fără DB → integritate în cod + teste; imagini în Blobs cu limită de dimensiune.
- Distanțe pe coordonate normalizate → corecție de aspect obligatorie (funcție pură testată).
- Canvas complex → construit incremental, verificat pe deploy (funcțiile Netlify nu rulează local).
- „Nu inventa limite WDF": doar date **demo** marcate explicit până la standarde oficiale validate.

## 10. Decizii deschise (proprietar)
1. Codul de instalare: **separat** pentru PAA (`PAA-…`) sau reutilizăm codurile Breed Explorer?
2. În MVP: rolul „administrator de standarde" = codul de admin existent (recomandat) sau cod nou dedicat?
3. Editorul MVP: **complet** (repere+linii+unghiuri+etichete+straturi+undo/redo) sau întâi o variantă redusă?
