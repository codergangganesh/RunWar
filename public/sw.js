const CACHE_NAME = 'runwar-cache-v4';

// Only pre-cache critical small assets. Large media and hero images use runtime caching below.
const STATIC_ASSETS = [
  '/logo.png',
  '/manifest.webmanifest',
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Interceptor
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();

  // Skip APIs, InsForge backend, and all external map tile servers
  if (
    url.origin.includes('insforge.app') ||
    hostname.includes('openstreetmap') ||
    hostname.includes('cartocdn') ||
    hostname.includes('arcgisonline') ||
    hostname.includes('stadiamaps') ||
    hostname.includes('mapbox') ||
    pathname.includes('/tile') ||
    pathname.startsWith('/api')
  ) {
    return;
  }

  // 1. Navigation / HTML requests: Network-First (always get latest Vercel deployment)
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(event.request).then((cached) => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // 2. Static Assets (JS, CSS, Images): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});
