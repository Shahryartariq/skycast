// Skycast's service worker. One job: when a page can't load because the phone is offline,
// show a short offline page instead of the browser's error. Weather is never cached here,
// so nobody is shown an old forecast as if it were current.
const CACHE = "skycast-offline-v1";
const OFFLINE_FILES = ["/offline.html", "/fallback.css", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(OFFLINE_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }
  // The offline page's own stylesheet and icon, when offline.
  const path = new URL(request.url).pathname;
  if (request.method === "GET" && OFFLINE_FILES.includes(path)) {
    event.respondWith(fetch(request).catch(() => caches.match(path)));
  }
});
