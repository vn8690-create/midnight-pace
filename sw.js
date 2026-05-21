const CACHE_NAME = 'midnight-pace-v2';
const assets = [
  'index.html',
  'style.css',
  'script.js',
  'manifest.json'
];

// Cài đặt và kích hoạt Service Worker ngầm
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assets);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Giữ ứng dụng hoạt động mượt mà ngay cả khi mạng chập chờn lúc chạy bộ
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
