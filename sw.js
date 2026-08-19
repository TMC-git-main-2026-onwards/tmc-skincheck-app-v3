// TMC SkinCheck service worker — makes the web app installable and gives it
// an offline app shell. Bump VERSION on every release so clients pick up the
// new bundle on next load.
//
// Scope notes:
//  - Only same-origin GETs are handled; cross-origin calls (Open-Meteo,
//    OpenStreetMap, postcodes.io, Google Fonts, the TMC logo) pass through to
//    the network untouched, so nothing external is ever served stale.
//  - Navigations are network-first with a cached-shell fallback, so an update
//    is picked up when online but the app still opens with no signal.
const VERSION = 'tmc-skincheck-v0.4.2';
const SHELL = ['./', './index.html', './logic.js', './icons.js', './manifest.webmanifest',
               './assets/icons/icon-192.png', './assets/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never intercept third parties

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
