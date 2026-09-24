let serviceWorkerRegistration;

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    serviceWorkerRegistration = await navigator.serviceWorker.register("sw.js");
    return serviceWorkerRegistration;
  } catch (error) {
    console.warn("Service worker registration failed.", error);
    return null;
  }
}

async function getCachedUrls(urls) {
  const cached = [];
  for (const url of [...new Set((urls || []).filter(Boolean))]) {
    try {
      if (await caches.match(url)) cached.push(url);
    } catch {
      // Ignore unavailable cache storage entries.
    }
  }
  return cached;
}

async function deleteCachedUrls(urls) {
  const requests = [...new Set((urls || []).filter(Boolean))];
  let deleted = 0;
  for (const url of requests) {
    try {
      if (await caches.delete(url)) deleted += 1;
    } catch {
      // Ignore unavailable cache storage entries.
    }
  }
  const cacheNames = await caches.keys();
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    for (const url of requests) {
      if (await cache.delete(url)) deleted += 1;
    }
  }
  return deleted;
}

async function cacheUrls(urls, onProgress = () => {}) {
  const uniqueUrls = [...new Set((urls || []).filter(Boolean))];
  if (!uniqueUrls.length) return { cached: 0, failed: 0 };
  const registration = serviceWorkerRegistration || (await registerServiceWorker());
  if (!registration) throw new Error("Service workers are not supported in this browser.");
  const ready = await navigator.serviceWorker.ready;
  const worker = ready.active;
  if (!worker) throw new Error("The cache environment is not available yet. Reload the page and try again.");

  const cached = [];
  const missing = [];
  for (const url of uniqueUrls) {
    try {
      const response = await caches.match(url);
      (response ? cached : missing).push(url);
    } catch {
      missing.push(url);
    }
  }
  if (!missing.length) return { cached: cached.length, failed: 0 };

  const result = await new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => reject(new Error("Caching timed out.")), 120000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      resolve(event.data?.results || []);
    };
    worker.postMessage({ type: "CACHE_URLS", urls: missing }, [channel.port2]);
  });
  result.forEach((item, index) => onProgress(index + 1, missing.length, item));
  return {
    cached: cached.length + result.filter((item) => item.ok).length,
    failed: result.filter((item) => !item.ok).length,
  };
}

registerServiceWorker();
