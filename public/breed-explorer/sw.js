/* ============================================================
   Explorator de standarde CFC-Royal — Service Worker
   Enables offline use and PWA installability when the app is
   served over HTTPS (e.g. https://cfc-royal.ro/breed-explorer/)
   or from http://localhost. It has no effect on file:// (where
   service workers are not permitted) — the app still runs there
   via the embedded seed-data.js fallback.

   Strategy
   --------
   • App shell (html/css/js/icons/manifest): cache-first, with a
     background refresh so updates are picked up next visit.
   • Data (breeds.json): network-first, falling back to cache when
     offline, so the latest published dataset wins when online.
   • Navigations: try network, fall back to the cached shell.

   Bump CACHE_VERSION whenever you change app files so clients
   fetch the new versions.
   ============================================================ */

// BUMP LA FIECARE SCHIMBARE de fișiere sau de date. Dacă rămâne neschimbat, browserul
// nu vede nicio versiune nouă: nu rulează „install"/„activate", cache-ul vechi nu se
// șterge, iar aplicația instalată rulează codul VECHI peste datele noi — sau, offline,
// rămâne cu setul vechi de rase. v3 = importul celor 334 de standarde WDF.
// v4 = datele nu mai sunt fișier public. Vin printr-o funcție autentificată
// (breed-date), deci NU se mai pun în cache aici: ar fi o copie fără poartă.
// v5 = interfața tradusă integral în română + curățarea dublurilor/non-WDF (390 rase).
// v5.0.1 = nota din date (disclaimer) tradusă + breed_count corect; forțează reîmprospătarea cache-ului.
// v5.1.0 = redenumire: „CFCR Breed Standards Explorer" -> „Explorator de standarde CFC-Royal".
// v5.2.0 = cele 3 lecții din Curriculum traduse; numele a 4 grupe se traduceau greșit
// (cheile I18N nu se potriveau cu șirul din date) și lecția 3 arăta 0 rase.
// v5.3.0 = panoul „Despre acest instrument" în română; defecte completate din sursa WDF
// la 6 rase care aveau fișa goală (Hovawart, Kerry Blue, Canadian Eskimo, Carolina,
// Westphalian Dachsbracke, Biewer).
const CACHE_VERSION = "cfcr-v5.5.0";
const CACHE_NAME = "cfcr-cache-" + CACHE_VERSION;

// Paths are relative to the service worker scope (the app folder).
// Doar învelișul aplicației. Datele (breeds) NU sunt aici — se cer online, cu cod.
const APP_SHELL = [
  "./",
  "./index.html",
  "./wdf-breed-standards-explorer.html",
  "./assets/styles.css",
  "./assets/app.js",
  "./manifest.webmanifest",
  "./assets/icons/favicon-32.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cache what we can; never fail the whole install if one asset 404s.
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle same-origin requests; let the network handle everything else.
  if (url.origin !== self.location.origin) return;

  // Cererile de date (funcția breed-date) sunt POST și trec direct la rețea — nu se
  // cachează niciodată: datele au poartă, o copie locală ar ocoli-o.
  if (url.pathname.indexOf("/.netlify/functions/") === 0) return;

  // Navigations: network-first with cached shell fallback (offline support).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(req).then((r) => r || caches.match("./wdf-breed-standards-explorer.html"))
      )
    );
    return;
  }

  // Everything else (assets): cache-first with background refresh.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
