const CACHE_NAME = "career-architect-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/src/main.tsx",
  "/src/App.tsx",
  "/src/index.css",
  "/icon.svg",
  "/manifest.json"
];

// Install service worker and cache static content
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Allow caching to fail gracefully on dynamic local dev environment paths
      return cache.addAll(ASSETS).catch((err) => {
        console.warn("Service Worker non-critical pre-cache warning:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event (clean up old caches)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event listener (required for PWA downloadability)
self.addEventListener("fetch", (event) => {
  // Let the browser handle standard requests (local dev server APIs)
  if (event.request.url.includes("/api/") || event.request.method !== "GET") {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Fallback to cache index.html for SPA router robustness offline
        return caches.match("/");
      });
    })
  );
});
