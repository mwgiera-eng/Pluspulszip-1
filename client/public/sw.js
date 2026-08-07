const CACHE_VERSION = "v2";
const APP_SHELL_CACHE = `shiftoptima-shell-${CACHE_VERSION}`;
const API_CACHE = `shiftoptima-api-${CACHE_VERSION}`;
const FONT_CACHE = `shiftoptima-fonts-${CACHE_VERSION}`;

const APP_SHELL_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icon-120.png",
  "/icon-152.png",
  "/icon-167.png",
  "/icon-180.png",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.png",
];

// ── Install: precache the app shell ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      Promise.all(
        APP_SHELL_ASSETS.map((url) =>
          cache.add(url).catch(() => {
            console.warn("[SW] Skipped precaching:", url);
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: prune stale caches ─────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k !== APP_SHELL_CACHE &&
                k !== API_CACHE &&
                k !== FONT_CACHE
            )
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch router ─────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Google Fonts — stale-while-revalidate
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(staleWhileRevalidateFont(request));
    return;
  }

  // API calls — network-first, fall back to cached response
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  // Page navigations — cache-first (SPA shell), background network update
  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Static assets — cache-first, populate on miss
  event.respondWith(cacheFirstStatic(request));
});

// ── Strategy: SPA navigation (cache-first + background revalidate) ────────────
// Serves the cached app shell immediately so the app loads instantly offline.
// Fetches a fresh copy in the background and updates the cache for next time.
async function navigationHandler(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cached = await cache.match("/");

  // Kick off a background network fetch regardless
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put("/", response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Return cached shell immediately if available; otherwise wait for network
  if (cached) {
    return cached;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) return networkResponse;

  // Both failed — show offline page
  const offline = await cache.match("/offline.html");
  return offline || new Response("Offline", { status: 503 });
}

// ── Strategy: network-first for API ──────────────────────────────────────────
async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return (
      cached ||
      new Response(JSON.stringify({ error: "Offline", offline: true }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })
    );
  }
}

// ── Strategy: cache-first for static assets ───────────────────────────────────
async function cacheFirstStatic(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Asset unavailable offline", { status: 503 });
  }
}

// ── Strategy: stale-while-revalidate for Google Fonts ────────────────────────
// Serves the cached font immediately; fetches a fresh copy in the background.
// This keeps fonts available offline after the first load.
async function staleWhileRevalidateFont(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await networkFetch) || new Response("Font unavailable offline", { status: 503 });
}
