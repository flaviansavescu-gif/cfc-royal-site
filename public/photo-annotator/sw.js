/* Service worker — Photo Anatomy Annotator. App shell cache-first; restul network-first.
   Bump CACHE_VERSION la orice schimbare de fișiere ale aplicației. */
const CACHE_VERSION = "paa-v1.0.0";
const CACHE_NAME = "paa-cache-" + CACHE_VERSION;
const SHELL = [
  "./",
  "./index.html",
  "./assets/style.css",
  "./assets/app.js",
  "./manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // funcțiile Netlify (POST) nu se cache-uiesc
  const url = new URL(req.url);
  if (url.pathname.indexOf("/.netlify/") === 0) return; // niciodată API
  // shell: cache-first cu împrospătare în fundal
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
