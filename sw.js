const CACHE_NAME = "runtime_files_v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(
    caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
));
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
    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request)),
    );
});
