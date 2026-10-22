// Offline support that is safe behind Cloudflare Access.
// CACHE_VERSION is replaced by `node build.mjs` on every build. Changing it changes this file's
// bytes, which is what makes phones install the new version and drop the old cache.
const CACHE_VERSION = 'dev';
const CACHE_PREFIX = 'macro-diary-';
const CACHE = CACHE_PREFIX + CACHE_VERSION;
const FILES = ['./', 'index.html', 'app.js', 'calc.js', 'stats.js', 'ideas.js', 'backup.js', 'manifest.webmanifest', 'icon.svg',
  'icon-192.png', 'icon-512.png', 'vendor/zxing-browser.min.js'];

// Only a real copy of our own file is worth saving. A redirect (expired Access session), an
// opaque or cross-origin response, or an error page must never end up in the offline copy.
const cacheable = (res) => res.ok && !res.redirected && res.type === 'basic';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // If any file comes back as a login page, the install fails and the old version keeps working.
    await Promise.all(FILES.map(async (f) => {
      const res = await fetch(f, { cache: 'reload', credentials: 'same-origin' });
      if (!cacheable(res)) throw new Error(`Not caching ${f}: ${res.status} ${res.type}`);
      await cache.put(f, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Only our own caches: other apps on the same origin (e.g. github.io) keep theirs.
    for (const k of await caches.keys()) if (k.startsWith(CACHE_PREFIX) && k !== CACHE) await caches.delete(k);
    // The cache from before versioning was called just 'macro-diary'.
    await caches.delete('macro-diary');
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Barcode lookups (Open Food Facts) and anything not GET go straight to the network.
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate') {
    // Page loads: network first, and whatever the network says is passed through untouched,
    // including the redirect to the Access login page. The cache is used only when offline.
    e.respondWith(fetch(req).then((res) => {
      if (cacheable(res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); }
      return res;
    }).catch(() => caches.match('./')));
    return;
  }

  // App files: network first so they match the page, but if the network fails or answers with
  // something that isn't our file (a login redirect), the saved copy is the better answer.
  e.respondWith(fetch(req).then((res) => {
    if (cacheable(res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }
    return caches.match(req, { ignoreSearch: true }).then((hit) => hit || res);
  }).catch(() => caches.match(req, { ignoreSearch: true })));
});
