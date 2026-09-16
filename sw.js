/* ============================================================
   MFD Analytics — Service Worker
   Caches the app shell + external libraries so it works offline
============================================================ */
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = 'mfd-analytics-' + CACHE_VERSION;

/* Files to cache on first install */
const PRECACHE_URLS = [
  './',
  './vikrant_analytics.html',
  './manifest.json',
  './vikrant.jpg',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

/* ---- INSTALL: pre-cache everything ---- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('Precache skip:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* ---- ACTIVATE: clear old caches ---- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ---- FETCH: network-first for HTML, cache-first for assets ---- */
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  const isHTML =
    request.destination === 'document' ||
    request.url.endsWith('.html') ||
    request.url.endsWith('/');

  /* HTML: try network, fall back to cache */
  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request)
            .then(r => r || caches.match('./vikrant_analytics.html'))
        )
    );
    return;
  }

  /* Assets: cache-first, network fallback */
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => cached);
    })
  );
});

/* ---- MESSAGE: allow the app to trigger updates ---- */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});