// Lightweight caching helper
// - cacheImages(urls): uses Cache Storage API to prefetch and cache images
// - saveDataCache(key, data): saves JSON to localStorage
// - loadDataCache(key): loads JSON from localStorage
// - clearCache(): clears image cache and localStorage entries for this app

const CACHE_NAME = 'griya-cache-v1';

export async function cacheImages(urls = []) {
  if (!Array.isArray(urls) || urls.length === 0) return;
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = urls
      .filter(Boolean)
      .map(u => {
        try { return new Request(u, { mode: 'no-cors' }); } catch (e) { return null; }
      })
      .filter(Boolean);
    // Use addAll in small chunks to avoid long lists
    const chunkSize = 10;
    for (let i = 0; i < requests.length; i += chunkSize) {
      const chunk = requests.slice(i, i + chunkSize);
      try {
        await cache.addAll(chunk);
      } catch (e) {
        // Some servers block CORS; fall back to fetch-and-put
        await Promise.all(chunk.map(async (req) => {
          try {
            const res = await fetch(req.url, { mode: 'no-cors' });
            try { await cache.put(req, res.clone()); } catch (e2) { /* ignore */ }
          } catch (err) { /* ignore individual failures */ }
        }));
      }
    }
  } catch (e) {
    // ignore cache errors on browsers that restrict it
    console.warn('cacheImages failed', e);
  }
}

export function saveDataCache(key, data) {
  if (!key) return;
  try {
    localStorage.setItem(`griya_cache:${key}`, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

export function loadDataCache(key) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(`griya_cache:${key}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

export async function clearCache() {
  try {
    if ('caches' in window) await caches.delete(CACHE_NAME);
  } catch (e) {}
  try {
    Object.keys(localStorage).forEach(k => { if (k.startsWith('griya_cache:')) localStorage.removeItem(k); });
  } catch (e) {}
}
