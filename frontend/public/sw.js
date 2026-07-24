// Pen Neer service worker. Deliberately conservative after a stale-cache
// incident (a deploy changes the hashed asset names, and an installed PWA that
// was serving an OLD cached index.html then asked the server for JS/CSS hashes
// that no longer exist -> 404 -> no styles, no React -> a black shell).
//
// Rules that make that impossible:
//  - HTML/navigations are ALWAYS network-first, so a fresh deploy always wins;
//    the cached shell is only a last-resort offline fallback.
//  - Hashed assets under /assets/ are immutable, so cache-first is safe and a
//    briefly-stale shell can still boot from cache instead of going black.
//  - Every activation purges ALL old caches (drops any poisoned shell).
// Never touches the WebSocket or the API.
const CACHE = "penneer-v7";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      // Drop everything, including any poisoned index.html an older SW cached.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

const cachePut = (req, res) => {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // fonts / external -> browser handles it
  if (url.pathname.startsWith("/ws")) return; // never intercept the socket
  if (url.pathname.startsWith("/api")) return; // the API is always live

  // The app shell: network-first so a new deploy is picked up immediately; the
  // cached shell is only used when the network truly fails (offline).
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("/", copy)).catch(() => {});
          }
          return res;
        })
        .catch(async () => (await caches.match("/")) || (await caches.match(req)) || Response.error())
    );
    return;
  }

  // Hashed assets are content-addressed and immutable: cache-first, then fill
  // from network. This is what stops a stale shell from ever going black.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => cachePut(req, res)))
  );
});

// ---- Web Push: real notifications while the app is closed -------------------
self.addEventListener("push", (e) => {
  let data = { title: "Pen Neer", body: "", tag: "penneer", url: "/" };
  try {
    data = { ...data, ...e.data.json() };
  } catch {
    if (e.data) data.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of list) {
        if ("focus" in client) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
