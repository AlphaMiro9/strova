/* Strova service worker – caches the app shell so it opens offline and fast */
const CACHE = 'strova-v1.1.0';
const SHELL = [
  './', 'index.html', 'styles.css', 'music.css', 'manifest.webmanifest',
  'js/store.js', 'js/piped.js', 'js/player.js', 'js/yt.js', 'js/update.js', 'js/music.js', 'js/app.js', 'vendor/hls.min.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API & video go straight to network
  // network first for the shell, so updates arrive quickly; cache as offline fallback
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
