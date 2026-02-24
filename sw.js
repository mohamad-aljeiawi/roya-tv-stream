/* ══════════════════════════════════════
   Service Worker — Roya TV PWA
   ══════════════════════════════════════ */

const CACHE_NAME = "roya-tv-v1";

// App shell files to cache for offline
const APP_SHELL = [
  "/",
  "/index.html",
  "/css/main.css",
  "/js/config.js",
  "/js/ui.js",
  "/js/quality.js",
  "/js/player.js",
  "/js/app.js",
  "/manifest.json",
  "/assets/icons/icon-192x192.png",
  "/assets/icons/icon-512x512.png",
  "/assets/icons/apple-touch-icon.png",
];

// External resources (cache with network-first strategy)
const CDN_RESOURCES = [
  "https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js",
  "https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap",
];

/* ── Install: Cache app shell ── */
self.addEventListener("install", (event) => {
  console.log("[SW] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching app shell");
      return cache.addAll(APP_SHELL);
    }),
  );
  // Activate immediately
  self.skipWaiting();
});

/* ── Activate: Clean old caches ── */
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...");
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          }),
      );
    }),
  );
  // Take control of all pages immediately
  self.clients.claim();
});

/* ── Fetch: Smart caching strategy ── */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API calls (proxy) — always network, never cache
  if (
    url.pathname.includes("/functions/") ||
    url.hostname.includes("supabase")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Stream URLs — always network
  if (url.pathname.includes(".m3u8") || url.pathname.includes(".ts")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // CDN resources — network first, fallback to cache
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // App shell — cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, clone));
        return response;
      });
    }),
  );
});
