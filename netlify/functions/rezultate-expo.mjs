// rezultate-expo.mjs — rezultatele publicate ale expozițiilor CFC-Royal.
//
// Managerul publică (cu secretul comun) pagina HTML cu DOAR titlurile acordate —
// decizie a clubului: public nu merg calificativele individuale ale câinilor, doar
// titlurile (CAJC/CAC/CACIB, BOB-uri, Best Puppy, BBR, clasările Best in Show).
//
//  POST {secret, actiune:"publica", showId, nume, data, html} -> memorează pagina
//  POST {secret, actiune:"retrage", showId}                   -> o retrage
//  GET  /rezultate-live/<showId>                              -> servește pagina
//  GET  /rezultate-live                                       -> index cu edițiile publicate
import { getStore } from "@netlify/blobs";
import { secretEgal } from "./_comun/secret.mjs";
import { obtineIndexCachedat } from "./_comun/index-cachedat.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";

// Indexul edițiilor publicate, cachedat (PERF: fără list()+get() per ediție la fiecare
// vizitator). TTL generos, fiindcă publicarea/retragerea ȘTERG cache-ul pe loc — în ziua
// expoziției, o ediție nou-publicată apare în listă imediat, nu după expirarea TTL-ului.
const CHEIE_INDEX = "index-rezultate";
const TTL_INDEX_MS = 10 * 60e3;

async function construiesteIndexRezultate(store) {
  const randuri = [];
  const { blobs } = await store.list({ prefix: "rezultate/" });
  for (const b of blobs) {
    const r = await store.get(b.key, { type: "json" }).catch(() => null);
    if (r) randuri.push({ showId: b.key.slice("rezultate/".length), nume: r.nume, data: r.data });
  }
  randuri.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  return { generat: new Date().toISOString(), randuri };
}

import { json } from "./_comun/raspuns.mjs";

// Scapă și ghilimelele/apostroful: valorile intră și în atribute (href="...").
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// CSP defensiv pentru paginile de rezultate (adăugat la auditul de securitate). Pagina cu
// titluri e HTML BRUT, publicat de Manager cu secretul comun, și e servită pe ORIGINEA APEX
// (aceeași cu platforma /cursuri/). Dacă secretul ar scăpa vreodată, un script strecurat aici
// ar putea citi datele platformei din același domeniu. Blocăm de la rădăcină: `script-src
// 'none'` oprește orice JavaScript (exportul e HTML+CSS static — titlurile rămân lizibile),
// iar `connect-src 'none'`/`form-action 'none'` taie orice scurgere. Un CSS și imagini inline
// tot merg (stilul paginii), doar codul executabil nu.
const CSP_REZULTATE =
  "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self' data:; connect-src 'none'; " +
  "base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'self'";

/** Anteturi pentru un răspuns HTML de rezultate: tip + CSP + nosniff (+ cache opțional). */
const anteturiHtml = (cache) => ({
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": CSP_REZULTATE,
  "X-Content-Type-Options": "nosniff",
  ...(cache ? { "Cache-Control": cache } : {}),
});

export default async (req) => {
  const store = getStore("expozitii");

  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    if (!body || !secretEgal(body.secret, process.env.EXPO_SYNC_SECRET)) {
      return json({ eroare: "Neautorizat" }, 401);
    }
    if (body.actiune === "publica") {
      // Regula casei (SEC-001): orice segment de cheie Blob venit din afară trece prin
      // segmentCheieValid — chiar și în spatele secretului Managerului.
      const showId = String(body.showId || "").slice(0, 80);
      const html = String(body.html || "");
      if (!showId || !segmentCheieValid(showId)) return json({ eroare: "Referință invalidă." }, 400);
      if (!html.startsWith("<!doctype html>")) return json({ eroare: "Pagină invalidă." }, 400);
      if (html.length > 900_000) return json({ eroare: "Pagina depășește limita." }, 400);
      await store.setJSON("rezultate/" + showId, {
        nume: String(body.nume || "").slice(0, 200),
        data: String(body.data || "").slice(0, 40),
        html,
        publicatLa: new Date().toISOString(),
      });
      await store.delete(CHEIE_INDEX).catch(() => {}); // ediția nouă să apară imediat în listă
      return json({ ok: true });
    }
    // Titlurile per câine, pentru fișa din cartea de origini (/caine/).
    // Cheia e MICROCIPUL, nu numele: numele se scrie în zece feluri, cipul nu. Pagina
    // publică a expoziției rămâne cum a fost — aici se împinge doar palmaresul, ca să
    // apară pe fișa exemplarului alături de ascendență.
    if (body.actiune === "titluri") {
      const microcip = String(body.microcip || "").replace(/[\s-]/g, "").slice(0, 30);
      if (!/^\d{10}$|^\d{15}$/.test(microcip)) return json({ eroare: "Microcip invalid." }, 400);
      const titluri = Array.isArray(body.titluri) ? body.titluri.slice(0, 200).map((t) => ({
        titlu: String(t?.titlu || "").slice(0, 60),
        expozitie: String(t?.expozitie || "").slice(0, 160),
        data: String(t?.data || "").slice(0, 10),
        arbitru: String(t?.arbitru || "").slice(0, 120),
        clasa: String(t?.clasa || "").slice(0, 60),
      })) : [];
      // Progresul spre titlurile de campion — „Drumul spre Campion". Vine gata calculat
      // din motorul de omologare al Managerului (Art. 39); aici doar se igienizează.
      const campionate = Array.isArray(body.campionate) ? body.campionate.slice(0, 10).map((c) => ({
        cod: String(c?.cod || "").slice(0, 40),
        eticheta: String(c?.eticheta || "").slice(0, 60),
        indeplinit: !!c?.indeplinit,
        detaliu: String(c?.detaliu || "").slice(0, 300),
        omologari: Array.isArray(c?.omologari) ? c.omologari.slice(0, 20).map((a) => Number(a) || 0).filter(Boolean) : [],
      })) : [];
      await store.setJSON("titluri/" + microcip, {
        titluri, campionate, nume: String(body.nume || "").slice(0, 120), actualizat: new Date().toISOString(),
      });
      return json({ ok: true, microcip, titluri: titluri.length });
    }

    if (body.actiune === "retrage") {
      const showIdRetras = String(body.showId || "").slice(0, 80);
      if (!segmentCheieValid(showIdRetras)) return json({ eroare: "Referință invalidă." }, 400);
      await store.delete("rezultate/" + showIdRetras);
      await store.delete(CHEIE_INDEX).catch(() => {}); // ediția retrasă să dispară imediat din listă
      return json({ ok: true });
    }
    return json({ eroare: "Acțiune necunoscută." }, 400);
  }

  // GET — pagina unei ediții sau indexul. Calea vine din redirectul /rezultate-live/*
  // (funcția primește URL-ul ORIGINAL, nu pe cel rescris — lecția funcției tunel).
  const u = new URL(req.url);
  let showId = u.searchParams.get("showId") || "";
  if (!showId && /^\/rezultate-live\//.test(u.pathname)) showId = u.pathname.replace(/^\/rezultate-live\//, "").replace(/\/+$/, "");

  if (showId) {
    const r = await store.get("rezultate/" + showId, { type: "json" }).catch(() => null);
    if (!r || !r.html) {
      return new Response("<h1>Rezultatele acestei expoziții nu sunt publicate.</h1>", {
        status: 404,
        headers: anteturiHtml(),
      });
    }
    return new Response(r.html, { headers: anteturiHtml("public, max-age=60") });
  }

  // Index: edițiile publicate, cele mai noi primele (cachedat; vezi CHEIE_INDEX).
  let randuri = [];
  try {
    const idx = await obtineIndexCachedat(store, {
      cheie: CHEIE_INDEX, ttlMs: TTL_INDEX_MS, construieste: construiesteIndexRezultate,
    });
    randuri = idx?.randuri || [];
  } catch {}
  const lista = randuri.length
    ? `<ul>${randuri.map((r) => `<li><a href="/rezultate-live/${esc(r.showId)}">${esc(r.nume || r.showId)}</a>${r.data ? ` <small>(${esc(r.data)})</small>` : ""}</li>`).join("")}</ul>`
    : "<p>Nicio ediție publicată încă.</p>";
  return new Response(
    `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rezultate expoziții — CFC Royal</title>
<style>body{font-family:system-ui,sans-serif;max-width:44rem;margin:0 auto;padding:2rem 1.25rem;color:#1a2433;line-height:1.6}h1{color:#1F4D3A}a{color:#1F4D3A}small{color:#5b6472}</style>
</head><body><h1>Rezultatele expozițiilor</h1>${lista}
<p><small>Club Federal Chinologic – Royal · World Dog Federation</small></p></body></html>`,
    { headers: anteturiHtml("public, max-age=60") },
  );
};
