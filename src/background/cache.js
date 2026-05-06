import { CACHE_TTL_MS, STORAGE_KEYS } from '../shared/constants.js';

// djb2 hash — fast, no crypto needed, collision probability negligible
// for a personal browser extension (<50k unique URLs over its lifetime).
function urlToKey(url) {
  let hash = 5381;
  for (let i = 0; i < url.length; i++) {
    hash = (((hash << 5) + hash) ^ url.charCodeAt(i)) >>> 0;
  }
  return `${STORAGE_KEYS.SCORE_CACHE}_${hash.toString(16)}`;
}

export { urlToKey };

export async function getCachedScore(url, storage) {
  const key = urlToKey(url);
  const result = await storage.get(key);
  const entry = result[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    await storage.remove(key);
    return null;
  }
  return entry.data;
}

export async function setCachedScore(url, data, storage) {
  const key = urlToKey(url);
  await storage.set({ [key]: { data, timestamp: Date.now() } });
}

export async function clearCachedScore(url, storage) {
  await storage.remove(urlToKey(url));
}
