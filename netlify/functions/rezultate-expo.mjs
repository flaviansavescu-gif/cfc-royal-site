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

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default async (req) => {
  const store = getStore("expozitii");

  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    if (!body || !process.env.EXPO_SYNC_SECRET || body.secret !== process.env.EXPO_SYNC_SECRET) {
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
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new Response(r.html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
    });
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
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } },
  );
};
