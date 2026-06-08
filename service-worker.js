const CACHE_NAME = "fitness-log-v7";
const LOCAL_ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=7",
  "./app.js?v=7",
  "./manifest.json"
];
const REMOTE_ASSETS = [
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        const remoteCache = REMOTE_ASSETS.map(url => cache.add(url).catch(() => null));
        return Promise.all([cache.addAll(LOCAL_ASSETS), ...remoteCache]);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
