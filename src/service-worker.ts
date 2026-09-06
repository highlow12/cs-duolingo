import { build, files, version } from "$service-worker";

const workerCache = `cs-duolingo-${version}`;
const assets = [...build, ...files];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(workerCache).then((cache) => cache.addAll(assets)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key !== workerCache)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque")
          return response;
        const copy = response.clone();
        void caches
          .open(workerCache)
          .then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});
