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

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
      const showId = String(body.showId || "");
      const html = String(body.html || "");
      if (!showId || !html.startsWith("<!doctype html>")) return json({ eroare: "Pagină invalidă." }, 400);
      if (html.length > 900_000) return json({ eroare: "Pagina depășește limita." }, 400);
      await store.setJSON("rezultate/" + showId, {
        nume: String(body.nume || "").slice(0, 200),
        data: String(body.data || "").slice(0, 40),
        html,
        publicatLa: new Date().toISOString(),
      });
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
      await store.setJSON("titluri/" + microcip, {
        titluri, nume: String(body.nume || "").slice(0, 120), actualizat: new Date().toISOString(),
      });
      return json({ ok: true, microcip, titluri: titluri.length });
    }

    if (body.actiune === "retrage") {
      await store.delete("rezultate/" + String(body.showId || ""));
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

  // Index: edițiile publicate, cele mai noi primele.
  const randuri = [];
  try {
    const { blobs } = await store.list({ prefix: "rezultate/" });
    for (const b of blobs) {
      const r = await store.get(b.key, { type: "json" }).catch(() => null);
      if (r) randuri.push({ showId: b.key.slice("rezultate/".length), nume: r.nume, data: r.data });
    }
  } catch {}
  randuri.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
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
