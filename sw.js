// Arco Solar — service worker
// Caches the app shell so the PWA opens instantly and still works offline
// (in offline mode, the app falls back to the clear-sky solar-position model
// instead of live Open-Meteo data — see js/solar-api.js).

const CACHE_NAME = 'arco-solar-v1';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/i18n.js',
  './js/storage.js',
  './js/solar-api.js',
  './js/skin.js',
  './js/skin-photo.js',
  './js/timer.js',
  './js/history.js',
  './js/alerts.js',
  './js/ui.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './legal/privacy.html',
  './legal/terms.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for API calls (so data stays fresh when online),
// cache-first for the app shell (so it still opens offline).
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const isApi = url.includes('open-meteo.com');

  if (isApi) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({ offline: true }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Tapping a local reminder notification focuses/opens the app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientsArr) => {
      if (clientsArr.length) return clientsArr[0].focus();
      return self.clients.openWindow('./index.html');
    })
  );
});
