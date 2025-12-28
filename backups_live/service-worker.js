self.addEventListener('install', (event) => {
  // Activate immediately so updates roll out fast.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Take control of uncontrolled clients as soon as we're active.
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch; caching handled by HTTP caches/CDN.
self.addEventListener('fetch', () => {
  // No-op; rely on network and browser cache.
});
