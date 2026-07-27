/* MULTIPOLAR — offline cache. The whole game is static, so it works on a plane. */
const CACHE = 'multipolar-v1';
const ASSETS = [
  './', './index.html', './css/app.css', './icon.svg', './manifest.webmanifest',
  './js/data/powers.js', './js/data/theaters.js', './js/data/actions.js', './js/data/events.js',
  './js/engine/core.js', './js/engine/resolve.js', './js/engine/ai.js', './js/engine/turn.js',
  './js/ui/map.js', './js/ui/ui.js', './js/main.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
    return res;
  }).catch(() => caches.match('./index.html'))));
});
