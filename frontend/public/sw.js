// ─────────────────────────────────────────────────────────────────────────────
// SERVICE WORKER V4 - BULLETPROOF OFFLINE HANDLING
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_NAME = 'dfcci-threshold-v4';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // 1. API CALLS - Always Network, with graceful Offline JSON fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline', message: 'You are currently offline.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 2. NAVIGATION (index.html) - Network First, Cache Fallback
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return res;
        })
        .catch(() => {
          // If network fails (OFFLINE), try root or index.html
          return caches.match('/').then(match => match || caches.match('/index.html'));
        })
    );
    return;
  }

  // 3. STATIC ASSETS - Cache First, Network Fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((res) => {
        if (!res || res.status !== 200) return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return res;
      });
    }).catch(() => {
       // If both fail and it's an image, we could return a placeholder
       return new Response('Offline', { status: 503 });
    })
  );
});
