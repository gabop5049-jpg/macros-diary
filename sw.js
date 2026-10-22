// Offline support: every app file is saved on install. Online, the network is tried first so
// updates show up right away; offline (or if the network fails), the saved copy is used.
const CACHE = 'macro-diary';
const FILES = ['./', 'index.html', 'app.js', 'calc.js', 'manifest.webmanifest', 'icon.svg',
  'icon-192.png', 'icon-512.png', 'vendor/zxing-browser.min.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only this app's own files. Barcode lookups go straight to Open Food Facts and need internet.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
