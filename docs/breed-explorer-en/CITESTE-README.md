# Explorator de standarde — varianta ENGLEZĂ (arhivă)

Aceasta este copia **în limba engleză** a Exploratorului de standarde (Breed Standards Explorer),
păstrată înainte de traducerea interfeței în română (08.08.2026).

## Ce conține
- `wdf-breed-standards-explorer.html` — pagina aplicației (interfață în engleză, `lang="en"`)
- `assets/app.js` — logica aplicației, cu toate șirurile de interfață în engleză
- `assets/styles.css`, `assets/icons/`, `manifest.webmanifest`, `sw.js`

## Cum se folosește independent
Se deschide `wdf-breed-standards-explorer.html` direct în browser. Aplicația funcționează
offline pentru interfață. **Datele raselor** (fișele) NU sunt incluse aici: în producție sunt
servite de funcția Netlify `breed-date.mjs` din `netlify/functions/_breed/breeds.json`.
Pentru o rulare complet independentă cu date, copiază acel `breeds.json` într-un
`data/breeds.json` lângă acest fișier și, la nevoie, generează `data/seed-data.js`
(vezi instrucțiunile din antetul fișierului HTML).

## De ce există
Varianta care rulează pe site (`public/breed-explorer/`) este în ROMÂNĂ. Aceasta rămâne ca
rezervă, pentru a putea reveni la textul-sursă englez sau a folosi aplicația în engleză separat.

Nu este publicată pe cfc-royal.ro (folderul `docs/` nu face parte din site-ul generat).
