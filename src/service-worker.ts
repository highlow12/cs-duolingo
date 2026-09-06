import { build, files, version } from "$service-worker";

const shellCache = `cs-duolingo-shell-${version}`;
const contentCache = `cs-duolingo-content-${version}`;
const migrationCache = "cs-duolingo-migrations";
const pagesBasePathMigration = new URL(
  "migration-pages-base-path-v2",
  self.registration.scope,
);
const contentAssets = files.filter((asset) => asset.includes("/generated/"));
const shellAssets = files.filter((asset) => !asset.includes("/generated/"));
const appAssets = [...build, ...shellAssets];
let reloadForPagesMigration = false;

function isSameOrigin(request: Request) {
  return new URL(request.url).origin === self.location.origin;
}

async function cacheFirst(request: Request, cacheName: string) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.type !== "opaque") {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function navigationResponse(request: Request) {
  const cache = await caches.open(shellCache);
  // Keep the app shell and content on the same installed release until activation.
  const shellUrl = new URL(".", self.registration.scope);
  const shell = await cache.match(shellUrl);
  if (shell) return shell;
  try {
    return await fetch(request);
  } catch {
    return Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(shellCache);
      const content = await caches.open(contentCache);
      const shellUrl = new URL(".", self.registration.scope);
      const existingCaches = await caches.keys();
      const hasPreviousRelease = existingCaches.some(
        (key) =>
          key.startsWith("cs-duolingo-shell-") && key !== shellCache,
      );

      await shell.addAll(appAssets);
      await shell.add(shellUrl);
      await content.addAll(contentAssets);

      // One-time recovery for releases that cached root-relative Pages URLs.
      // Later updates continue waiting for the learner's confirmation.
      if (hasPreviousRelease) {
        const migrations = await caches.open(migrationCache);
        if (!(await migrations.match(pagesBasePathMigration))) {
          await migrations.put(
            pagesBasePathMigration,
            new Response("complete"),
          );
          reloadForPagesMigration = true;
          await self.skipWaiting();
        }
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("cs-duolingo-") &&
              key !== shellCache &&
              key !== contentCache &&
              key !== migrationCache,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();

      if (reloadForPagesMigration) {
        const clients = await self.clients.matchAll({ type: "window" });
        await Promise.all(
          clients.map((client) => (client as WindowClient).navigate(client.url)),
        );
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !isSameOrigin(event.request)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(navigationResponse(event.request));
    return;
  }

  const cacheName = new URL(event.request.url).pathname.includes("/generated/")
    ? contentCache
    : shellCache;
  event.respondWith(cacheFirst(event.request, cacheName));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE")
    event.waitUntil(self.skipWaiting());
});
