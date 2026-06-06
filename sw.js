const CACHE_NAME = 'porto2026-mobile-cache-v8';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './img/icon-192.png',
  './img/icon-512.png'
];

// Install Event: Cache all critical static resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Pre-caching static assets');
        const reloadRequests = ASSETS_TO_CACHE.map(url => new Request(url, { cache: 'reload' }));
        return cache.addAll(reloadRequests);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up outdated caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Intercept network requests
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. Bypass cache for scales database (.enc), PHP backend, and explicit no-cache sync requests
  if (
    url.pathname.endsWith('.enc') ||
    url.pathname.endsWith('.php') ||
    url.searchParams.has('_nocache')
  ) {
    // Force network only
    return;
  }

  // 3. Cache-First Strategy for static assets with Network fallback
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Serve from cache immediately
          return cachedResponse;
        }

        // Fetch from network, cache the resource, and return it
        return fetch(event.request).then(networkResponse => {
          // Check if valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // Clone response and cache it
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch(err => {
          console.warn('[Service Worker] Fetch failed for:', event.request.url, err);
          // Return default offline fallback if needed
        });
      })
  );
});
