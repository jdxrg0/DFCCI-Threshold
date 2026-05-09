// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Increment this version string on EVERY deploy so the activate
// handler correctly purges old caches and clients receive fresh assets.
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_NAME = 'dfcci-threshold-v2';

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/favicon.svg',
];

// Install: pre-cache static shell (NOT index.html — it's always fetched fresh)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Take control immediately without waiting for old SW to die
  self.skipWaiting();
});

// Activate: clean up ALL old caches (different CACHE_NAME = old cache)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// Fetch: Smart strategy per resource type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // ── API calls: always go to network, never cache ──────────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // ── Navigation & index.html: Network-FIRST, no cache fallback on success ──
  // This ensures new deployments are always picked up. iOS Safari and
  // other mobile browsers will always get the freshest HTML shell.
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          // Do NOT cache index.html — let the browser always fetch it fresh.
          // Vite content-hashes JS/CSS, so those are safe to cache, but
          // index.html references those hashes and must always be up-to-date.
          return response;
        })
        .catch(() => {
          // Network failed (truly offline) — serve cached shell as last resort
          return caches.match('/index.html');
        })
    );
    return;
  }

  // ── Vite-hashed static assets (JS, CSS): Cache-first ─────────────────────
  // These filenames contain content hashes (e.g. index-BxAk3jdZ.js) so a
  // cache hit is always the correct, immutable version. New builds produce
  // new filenames so there's never a stale-cache problem here.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // ── Everything else: Network-first with cache fallback ────────────────────
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Handle messages from the app (e.g. force update)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
