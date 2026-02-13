const CACHE_NAME = 'sf-pro-cache-v2';
const DATA_CACHE_NAME = 'sf-pro-data-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install: Cache app shell
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  const cacheWhitelist = [CACHE_NAME, DATA_CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control immediately
  );
});

// Fetch: Network-first with cache fallback for API, cache-first for static assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip caching for non-GET requests or chrome-extension URLs
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle Supabase API requests with network-first strategy
  if (url.origin.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone response for caching
          const responseToCache = response.clone();
          // Only cache successful responses
          if (response.status === 200) {
            caches.open(DATA_CACHE_NAME)
              .then(cache => {
                cache.put(request, responseToCache);
              });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                console.log('[SW] Serving cached data for:', request.url);
                return cachedResponse;
              }
              // Return a generic offline response
              return new Response(
                JSON.stringify({ error: 'Offline - cached data not available' }),
                { 
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
    return;
  }

  // Handle app assets with cache-first strategy
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          return response;
        }
        // Not in cache, fetch from network
        return fetch(request)
          .then(response => {
            // Don't cache if not successful
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            // Clone and cache
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(request, responseToCache);
              });
            return response;
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Background Sync: Queue failed requests for retry when online
self.addEventListener('sync', event => {
  if (event.tag === 'sync-supabase') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(
      // Placeholder for future background sync implementation
      Promise.resolve()
    );
  }
});

// Push notifications support (placeholder for future enhancement)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});