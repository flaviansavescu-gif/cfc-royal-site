// examen-final.mjs — examenul final al Școlii de Arbitraj.
// Banca de întrebări stă NUMAI aici (server) — corectarea nu apare în paginile publice.
// La fiecare susținere se extrage aleatoriu un subset de întrebări (fără cheia de răspuns),
// se corectează pe server, se aplică pauza de reîncercare și se anunță secretariatul.
//
// POST { id, actiune:"stare" }                 -> { activ, nrExtrase, prag, promovat, poateSustine, urmatoareaData }
// POST { id, actiune:"start" }                 -> { sesiune:[{id,text,optiuni}], prag, nrExtrase }
// POST { id, actiune:"trimite", raspunsuri }   -> { corecte, total, procent, promovat, urmatoareaData }
// POST { cod, actiune:"admin" }                -> { candidati:{cid:{promovat,ultimaData,incercari}} }
// POST { cod, actiune:"reset", candidatId }    -> { ok }
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const ADMIN_HASH = "66c260e81fd07dae6c76578609d8e4982cb92bd510a7fde396069de586bd2bfb";
const NR_INTREBARI = 25;      // câte se extrag la un examen (sau toată banca, dacă e mai mică)
const MIN_ACTIV = 10;         // banca minimă pentru ca examenul să fie „activ”
const PRAG = 75;              // procent minim de promovare
const COOLDOWN_ZILE = 7;      // pauză după o picare
const COOLDOWN_MS = COOLDOWN_ZILE * 24 * 60 * 60 * 1000;

// Banca de întrebări (provizorie — lectorii o extind la 25+). corect = indexul opțiunii corecte.
const BANCA = [
  { id: "f1",  text: "Câte grupe de rase cuprinde clasificarea World Dog Federation (WDF)?", optiuni: ["8 grupe", "10 grupe", "12 grupe"], corect: 1 },
  { id: "f2",  text: "La o expoziție cu CACIB, cea mai înaltă distincție de rasă pe sex este:", optiuni: ["CAC", "CACIB", "CAJC"], corect: 1 },
  { id: "f3",  text: "Certificatul CAJC se acordă:", optiuni: ["câinilor din clasa Tineret care obțin calificativul maxim", "exclusiv campionilor", "câinilor din clasa Veterani"], corect: 0 },
  { id: "f4",  text: "La WDF există titlul BOS (Best Opposite Sex)?", optiuni: ["Da, este obligatoriu", "Nu, nu se acordă", "Doar la expozițiile naționale"], corect: 1 },
  { id: "f5",  text: "Ringul de onoare (Best in Show) la WDF se clasează:", optiuni: ["pe primele 5 locuri (Top 5) pe categorii", "doar locul 1", "pe grupe (Best in Group)"], corect: 0 },
  { id: "f6",  text: "Calificativul necesar pentru a putea acorda certificatele de tip CAC este:", optiuni: ["Foarte Bun", "Excelent", "Bun"], corect: 1 },
  { id: "f7",  text: "Un câine descalificat (DSQ) la o expoziție:", optiuni: ["primește totuși un calificativ", "nu primește niciun calificativ sau titlu", "primește automat locul 4"], corect: 1 },
  { id: "f8",  text: "Arbitrul evaluează câinele prin comparație cu:", optiuni: ["ceilalți câini din ring, indiferent de standard", "standardul oficial al rasei", "preferințele proprietarului"], corect: 1 },
  { id: "f9",  text: "Absența unui câine strigat în ring se consemnează ca:", optiuni: ["Absent", "Excelent", "CAC"], corect: 0 },
  { id: "f10", text: "Codul etic al arbitrului impune, în primul rând:", optiuni: ["favorizarea cunoscuților", "imparțialitate și evitarea conflictelor de interese", "arbitrarea rapidă, fără examinare"], corect: 1 },
  { id: "f11", text: "Fișa de arbitraj a câinelui conține:", optiuni: ["doar numele câinelui", "aprecierea descriptivă, calificativul și eventualele titluri", "doar semnătura arbitrului"], corect: 1 },
  { id: "f12", text: "În clasificarea WDF, grupa a 4-a este denumită:", optiuni: ["Teckeli", "Câini tip Bull", "Ogari"], corect: 1 },
];

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const nrExtrase = () => Math.min(NR_INTREBARI, BANCA.length);
const activ = () => BANCA.length >= MIN_ACTIV;

// Amestecare Fisher–Yates (rulăm în funcția Netlify, unde Math.random e disponibil).
function amesteca(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Eligibilitate din dosarul de examen: { promovat, poateSustine, urmatoareaData }
function eligibilitate(dosar) {
  if (dosar && dosar.promovat) return { promovat: true, poateSustine: false, urmatoareaData: null };
  const ultima = dosar && dosar.ultimaData ? Date.parse(dosar.ultimaData) : NaN;
  if (!isNaN(ultima)) {
    const gata = ultima + COOLDOWN_MS;
    if (Date.now() < gata) return { promovat: false, poateSustine: false, urmatoareaData: new Date(gata).toISOString() };
  }
  return { promovat: false, poateSustine: true, urmatoareaData: null };
}

async function candidatNume(store, id) {
  try {
    const c = await store.get("candidat/" + id, { type: "json" });
    return c ? String(c.nume || "").trim() : null;
  } catch { return null; }
}

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const store = getStore("cursuri");
  const actiune = body.actiune || "stare";

  // ——— Acțiuni de administrator ———
  if (actiune === "admin" || actiune === "reset") {
    if (sha256(body.cod || "") !== ADMIN_HASH) return json({ eroare: "Cod de administrator incorect." }, 401);

    if (actiune === "reset") {
      const cid = taie(body.candidatId, 128);
      if (!cid) return json({ eroare: "Lipsește candidatul." }, 400);
      try { await store.delete("examen/" + cid); } catch (err) { console.error(err); }
      return json({ ok: true });
    }

    const candidati = {};
    try {
      const { blobs } = await store.list({ prefix: "examen/" });
      for (const b of blobs) {
        const cid = b.key.slice("examen/".length);
        const d = await store.get(b.key, { type: "json" });
        if (d) candidati[cid] = { promovat: !!d.promovat, ultimaData: d.ultimaData || null, incercari: Array.isArray(d.incercari) ? d.incercari.length : 0 };
      }
    } catch (err) { console.error("Listare examene eșuată:", err); }
    return json({ candidati });
  }

  // ——— Acțiuni de candidat (identificat prin id) ———
  const id = taie(body.id, 128);
  if (!id) return json({ eroare: "Intră cu codul tău personal pentru a susține examenul." }, 401);
  const nume = await candidatNume(store, id);
  if (!nume) return json({ eroare: "Cod de candidat invalid." }, 401);

  let dosar = null;
  try { dosar = await store.get("examen/" + id, { type: "json" }); } catch {}
  const elig = eligibilitate(dosar);

  if (actiune === "stare") {
    return json({ activ: activ(), nrExtrase: nrExtrase(), prag: PRAG, ...elig });
  }

  if (actiune === "start") {
    if (!activ()) return json({ eroare: "Examenul final nu este încă activ." }, 409);
    if (!elig.poateSustine)
      return json({ eroare: elig.promovat ? "Ai promovat deja examenul final." : "Poți relua examenul mai târziu.", urmatoareaData: elig.urmatoareaData }, 409);
    const sesiune = amesteca(BANCA).slice(0, nrExtrase()).map((q) => ({ id: q.id, text: q.text, optiuni: q.optiuni }));
    return json({ sesiune, prag: PRAG, nrExtrase: nrExtrase() });
  }

  if (actiune === "trimite") {
    if (!activ()) return json({ eroare: "Examenul final nu este încă activ." }, 409);
    if (!elig.poateSustine)
      return json({ eroare: elig.promovat ? "Ai promovat deja examenul final." : "Poți relua examenul mai târziu.", urmatoareaData: elig.urmatoareaData }, 409);

    const raspunsuri = body.raspunsuri && typeof body.raspunsuri === "object" ? body.raspunsuri : null;
    const asteptat = nrExtrase();
    const chei = raspunsuri ? Object.keys(raspunsuri) : [];
    if (!raspunsuri || chei.length !== asteptat)
      return json({ eroare: "Răspunde la toate întrebările examenului." }, 400);

    let corecte = 0;
    for (const qid of chei) {
      const q = BANCA.find((x) => x.id === qid);
      if (q && Number(raspunsuri[qid]) === q.corect) corecte++;
    }
    const total = asteptat;
    const procent = Math.round((corecte / total) * 100);
    const promovat = procent >= PRAG;
    const acum = new Date().toISOString();

    // Actualizăm dosarul de examen (fiecare candidat pe cheia lui — fără curse).
    const incercari = (dosar && Array.isArray(dosar.incercari) ? dosar.incercari : []).slice(-9);
    incercari.push({ data: acum, procent, promovat });
    const nouDosar = { promovat: !!(dosar && dosar.promovat) || promovat, ultimaData: acum, incercari };
    try { await store.setJSON("examen/" + id, nouDosar); } catch (err) { console.error("Salvare examen eșuată:", err); }

    // Notificare secretariat (Brevo).
    const apiKey = process.env.BREVO_API_KEY;
    if (apiKey) {
      const html = `
        <h2 style="margin:0 0 8px">Examen final — Școala de Arbitraj</h2>
        <p><b>Candidat:</b> ${nume.replace(/</g, "&lt;")}</p>
        <p><b>Scor:</b> ${corecte} / ${total} (${procent}%) — <b>${promovat ? "PROMOVAT ✅" : "NEPROMOVAT ❌"}</b></p>
        <p style="color:#888;font-size:12px">Trimis automat de platforma de cursuri — cfc-royal.ro/cursuri/</p>`;
      try {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            sender: { name: "Școala de Arbitraj CFC-Royal", email: "newsletter@cfc-royal.ro" },
            to: [{ email: "contact@cfc-royal.ro" }],
            subject: `[Examen final ${promovat ? "PROMOVAT" : "nepromovat"}] ${nume} (${procent}%)`,
            htmlContent: html,
          }),
        });
      } catch (err) { console.error("E-mail examen eșuat:", err); }
    } else {
      console.error("BREVO_API_KEY lipsește — rezultatul examenului nu a fost trimis pe e-mail.");
    }

    const urmatoareaData = promovat ? null : new Date(Date.now() + COOLDOWN_MS).toISOString();
    return json({ corecte, total, procent, promovat, prag: PRAG, urmatoareaData });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
};
