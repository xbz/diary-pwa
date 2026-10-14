// 自毁型 Service Worker：用于清除之前版本遗留的缓存和注册，之后不再使用 SW。
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((client) => client.navigate(client.url)))
  );
});
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
