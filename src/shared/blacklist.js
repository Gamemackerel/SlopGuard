import { DEFAULT_BLACKLIST, STORAGE_KEYS } from './constants.js';

export function extractDomain(url) {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function isBlacklisted(url, blacklist) {
  const domain = extractDomain(url);
  if (!domain) return false;
  return blacklist.some(
    (entry) => domain === entry || domain.endsWith('.' + entry),
  );
}

export async function getBlacklist(storage) {
  const result = await storage.get(STORAGE_KEYS.BLACKLIST);
  return result[STORAGE_KEYS.BLACKLIST] ?? [...DEFAULT_BLACKLIST];
}

export async function addDomainToBlacklist(url, storage) {
  const domain = extractDomain(url);
  if (!domain) throw new Error(`Cannot extract domain from: ${url}`);
  const list = await getBlacklist(storage);
  if (list.includes(domain)) return list;
  const updated = [...list, domain];
  await storage.set({ [STORAGE_KEYS.BLACKLIST]: updated });
  return updated;
}

export async function removeDomainFromBlacklist(domain, storage) {
  const list = await getBlacklist(storage);
  const updated = list.filter((d) => d !== domain);
  await storage.set({ [STORAGE_KEYS.BLACKLIST]: updated });
  return updated;
}

export async function resetBlacklist(storage) {
  await storage.set({ [STORAGE_KEYS.BLACKLIST]: [...DEFAULT_BLACKLIST] });
  return [...DEFAULT_BLACKLIST];
}
