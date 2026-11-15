/* Retirement worker only: cleans the PWA installed during the experiment.
 * No fetch handler, no caching and no new app registration.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.registration.unregister();
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('brejo-weblab-'))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});
