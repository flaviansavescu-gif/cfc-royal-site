# ADR — Profilul de interese pe rase (orientare candidat → lector)

**Data:** 25 iulie 2026 · **Modul:** Școala de Arbitraj (`/cursuri/`)

## Context și scop
Asociația are nevoie de arbitri și e benefic ca cei noi să aibă competențe cât mai
extinse. Candidații își exprimă interesul pentru **grupe și rase**, iar pe baza acestuia:
1. sunt orientați către un **lector potrivit** (mentor);
2. sunt **încurajați spre lărgime** (minim 2 grupe la trimitere);
3. secretariatul vede **cererea agregată** pentru prioritatea standardelor din Breed Explorer.

## Decizii
- **Doar candidații** își aleg rasele (nu lectorii). Vizibilitate **neanonimă** — adminul
  vede alegerea fiecărui candidat.
- **Minim 2 grupe** la salvare. O rasă aleasă contează automat și ca interes pentru grupa ei
  (grupe efective = grupe bifate ∪ grupele raselor alese) — pârghia de lărgime.
- **Repartizare:** un **lector principal** per candidat (schimbabil); un lector poate avea mai
  mulți candidați. Sistemul **sugerează** lectorul după suprapunerea de grupe, la egalitate
  după încărcare (cine are mai puțini candidați), apoi alfabetic. Adminul **confirmă** manual.
- **Competențele lectorilor pe grupe** derivă din prezentările lor (`rol` din `data/cursuri.ts`):
  „All Breed" = toate 10 grupele; altfel grupele enumerate. Sincronizate în
  `LECTOR_GRUPE` din funcție.
- **Deficitul de arbitri pe grupe** îl setează adminul o dată; candidații îl văd evidențiat.
- **Nomenclatorul WDF** (10 grupe + 431 rase, RO/EN) este **exportat din Managerul de
  Expoziții** (`prisma/seed-data/breeds.json` + `lib/domeniu.ts`) în `src/data/nomenclator-wdf.ts`.
  Se regenerează din Manager când se schimbă nomenclatorul (nu se editează manual).

## Arhitectură (ca JCR/PAA)
- Astro static + Netlify Blobs (store **`interese`**) + o funcție `interese-rase.mjs`.
- Store: `profil/<cid>` (alegerile candidatului), `alocare/<cid>` (lectorul principal, separat
  ca să nu se suprascrie reciproc cu editările candidatului), `deficit` (grupe).
- RBAC prin `_paa/lib.mjs`: candidat prin `cid` (bearer din localStorage), lector/admin prin cod.
  - Candidat: `meniu`, `salveaza`.
  - Admin: `toate` (profiluri + sugestii + agregare + deficit + lectori), `aloca`, `deficit`.
  - Lector/admin: `candidatii-mei` (lectorul își vede candidații; adminul îi vede pe toți).

## Pagini
- `/cursuri/interese/` — candidatul (10 grupe pliabile, 431 rase, căutare, minim 2 grupe, notă).
- `/cursuri/admin/` § „Interese pe rase" — profiluri per candidat, indicator de lărgime,
  sugestie de lector, dropdown de repartizare, setare deficit, cerere agregată.
- `/cursuri/lector/<slug>/` § „Candidații mei repartizați" — lista candidaților alocați +
  profilul lor (grupe, rase, notă), read-only.

## Verificare
- `npm run build` (304 pagini, fără erori); `node --check` pe funcție.
- Pagina candidatului verificată în browser: 431 rase / 10 grupe, gating minim-2, logica de
  grupe efective prin rase, căutare — fără erori de consolă.
- Comportamentul funcțiilor se testează real **doar pe deploy** (Netlify Functions + Blobs nu
  rulează sub `astro dev`). De rulat după publicare: gating 401 pe cod greșit, 200 pe pagini.

## Rămas / idei ulterioare
- Notificare către lector la repartizare; istoric al schimbărilor de lector.
- Filtrare/sortare candidați în panou; export CSV al cererii agregate.
- Regenerarea automată a nomenclatorului la schimbări în Manager.
