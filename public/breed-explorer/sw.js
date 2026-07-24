/* ============================================================
   CFCR Breed Standards Explorer — Service Worker
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

const CACHE_VERSION = "cfcr-v2.0.1";
const CACHE_NAME = "cfcr-cache-" + CACHE_VERSION;

// Paths are relative to the service worker scope (the app folder).
const APP_SHELL = [
  "./",
  "./index.html",
  "./wdf-breed-standards-explorer.html",
  "./assets/styles.css",
  "./assets/app.js",
  "./data/seed-data.js",
  "./data/breeds.json",
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

function isDataRequest(url) {
  return url.pathname.endsWith("/data/breeds.json") || url.pathname.endsWith("breeds.json");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle same-origin requests; let the network handle everything else.
  if (url.origin !== self.location.origin) return;

  // Data: network-first (fresh dataset when online, cached when offline).
  if (isDataRequest(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

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
