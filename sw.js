const CACHE_NAME = "app_files";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("message", (event) => {
    if (event.data?.type !== "CACHE_URLS") return;
    const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            const results = [];
            for (const url of urls) {
                try {
                    const request = new Request(url, { cache: "reload" });
                    const response = await fetch(request);
                    if (response.ok && (new URL(url, self.location.href).origin === self.location.origin || response.type === "basic" || response.type === "cors" || response.type === "opaque")) {
                        await cache.put(request, response.clone());
                        results.push({ url, ok: true });
                    } else {
                        results.push({ url, ok: false });
                    }
                } catch {
                    results.push({ url, ok: false });
                }
            }
            event.ports[0]?.postMessage({ type: "CACHE_RESULT", results });
        }),
    );
});
self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;
    const request = event.request;
    if (request.cache === "no-store") {
        event.respondWith(fetch(request));
        return;
    }
    event.respondWith(
        caches.match(request).then((cached) => cached || fetch(request).then((response) => {
            if (response.ok && new URL(request.url).origin === self.location.origin) {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
        }))
    );
});
