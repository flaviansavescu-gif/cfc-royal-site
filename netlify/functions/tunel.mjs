// tunel.mjs — adresa STABILĂ a managerului de expoziții.
//
// Problema: tunelul Cloudflare al managerului primește altă adresă la fiecare pornire,
// deci QR-urile tipărite ar muri la orice repornire. Soluția: QR-urile arată mereu spre
// cfc-royal.ro/r/<cale>, iar managerul anunță aici (cu secretul comun) adresa curentă a
// tunelului; noi doar redirecționăm. Dacă tunelul nu e viu, servim o pagină prietenoasă
// care se reîncearcă singură — nu o eroare de browser.
//
//  POST {secret, actiune:"seteaza", url}  -> memorează adresa tunelului (+ ora)
//  POST {secret, actiune:"sterge"}        -> uită adresa (tunel oprit ordonat)
//  GET  ?tinta=<cale>                     -> 302 spre <tunel>/<cale>  (via redirect /r/*)
import { getStore } from "@netlify/blobs";

const CHEIE = "tunel/curent";
// Scriptul de tunel reanunță adresa la câteva minute; peste pragul ăsta îl considerăm mort.
const PROSPETIME_MS = 15 * 60 * 1000;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

const paginaAsteptare = `<!doctype html>
<html lang="ro"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="20">
<title>Neconectat — CFC Royal</title>
<style>
  body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center}
  .c{max-width:26rem}h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#475569;line-height:1.5;margin:.25rem 0}
  .p{display:inline-block;margin-top:1rem;border:2px solid #cbd5e1;border-top-color:#059669;border-radius:50%;width:28px;height:28px;animation:r 1s linear infinite}
  @keyframes r{to{transform:rotate(360deg)}}
</style></head><body><div class="c">
<h1>Ecranele expoziției nu sunt conectate acum</h1>
<p>Managerul de expoziție nu este pornit sau nu are internet în acest moment.</p>
<p>Pagina reîncearcă singură la 20 de secunde — las-o deschisă.</p>
<div class="p"></div>
</div></body></html>`;

export default async (req) => {
  const store = getStore("expozitii");

  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    if (!body || !process.env.EXPO_SYNC_SECRET || body.secret !== process.env.EXPO_SYNC_SECRET) {
      return json({ eroare: "Neautorizat" }, 401);
    }
    if (body.actiune === "seteaza") {
      // Doar HTTPS și doar un nume de gazdă curat — nimic altceva nu poate fi memorat,
      // deci nici cineva care ar ghici secretul nu poate redirecționa spre orice.
      if (!/^https:\/\/[a-z0-9][a-z0-9.-]*[a-z0-9]$/i.test(String(body.url || ""))) {
        return json({ eroare: "URL invalid" }, 400);
      }
      await store.setJSON(CHEIE, { url: body.url, la: Date.now() });
      return json({ ok: true });
    }
    if (body.actiune === "sterge") {
      await store.delete(CHEIE);
      return json({ ok: true });
    }
    return json({ eroare: "Acțiune necunoscută" }, 400);
  }

  // GET: redirecționăm către tunelul viu; altfel, pagina de așteptare.
  const u = new URL(req.url);
  // La rescrierea /r/* funcția primește URL-ul ORIGINAL (/r/<cale>), nu pe cel rescris —
  // deci calea se ia din pathname; ?tinta= rămâne pentru apelurile directe ale funcției.
  let tinta = (u.searchParams.get("tinta") || "").replace(/^\/+/, "");
  if (!tinta && /^\/r(\/|$)/.test(u.pathname)) tinta = u.pathname.replace(/^\/r\/?/, "");
  const stare = await store.get(CHEIE, { type: "json" }).catch(() => null);
  const viu = stare && stare.url && Date.now() - (stare.la || 0) < PROSPETIME_MS;
  if (viu && /^[a-z0-9/_-]*$/i.test(tinta)) {
    return new Response(null, {
      status: 302,
      // Fără cache: adresa tunelului se schimbă; browserul trebuie să întrebe mereu.
      headers: { Location: stare.url + "/" + tinta, "Cache-Control": "no-store" },
    });
  }
  return new Response(paginaAsteptare, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
};
