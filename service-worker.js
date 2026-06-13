const cacheName = 'life-tracker-v2';
const assetsToCache = ['./','./index.html','./style.css','./app.js','./manifest.json'];
self.addEventListener('install', event => { event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assetsToCache))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== cacheName).map(k => caches.delete(k))))); });
self.addEventListener('fetch', event => { event.respondWith(caches.match(event.request).then(response => response || fetch(event.request))); });
