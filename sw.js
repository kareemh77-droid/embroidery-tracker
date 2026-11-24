// Network-first for the app itself (so updates arrive), cache fallback so it still opens offline.
const V = 'et-v1';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const zxing = url.hostname === 'unpkg.com' && url.pathname.includes('@zxing');
  if (!sameOrigin && !zxing) return; // API calls go straight to the network
  if (zxing) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const c = res.clone(); caches.open(V).then(k => k.put(req, c)); return res; })));
    return;
  }
  e.respondWith(fetch(req).then(res => { const c = res.clone(); caches.open(V).then(k => k.put(req, c)); return res; }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html'))));
});
