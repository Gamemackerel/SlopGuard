import {
  getCachedScore,
  setCachedScore,
  clearCachedScore,
  urlToKey,
} from '../src/background/cache.js';
import { CACHE_TTL_MS, STORAGE_KEYS } from '../src/shared/constants.js';

// ─────────────────────────────────────────────────────────────
// urlToKey
// ─────────────────────────────────────────────────────────────
describe('urlToKey', () => {
  test('returns a string', () => {
    expect(typeof urlToKey('https://example.com')).toBe('string');
  });

  test('same URL always produces the same key', () => {
    const url = 'https://example.com/article?id=123';
    expect(urlToKey(url)).toBe(urlToKey(url));
  });

  test('different URLs produce different keys', () => {
    expect(urlToKey('https://a.com')).not.toBe(urlToKey('https://b.com'));
  });

  test('path changes the key', () => {
    expect(urlToKey('https://example.com')).not.toBe(urlToKey('https://example.com/page'));
  });

  test('query string changes the key', () => {
    expect(urlToKey('https://example.com/page')).not.toBe(
      urlToKey('https://example.com/page?q=1'),
    );
  });

  test('key starts with the SCORE_CACHE prefix', () => {
    expect(urlToKey('https://example.com')).toMatch(
      new RegExp(`^${STORAGE_KEYS.SCORE_CACHE}_`),
    );
  });

  test('key contains only alphanumeric characters and underscores', () => {
    const key = urlToKey('https://example.com/some/deep/path?with=query&and=more#hash');
    expect(key).toMatch(/^[a-zA-Z0-9_]+$/);
  });

  test('long URL produces same-length key as short URL (hash is fixed-length)', () => {
    const short = urlToKey('https://a.com');
    const long  = urlToKey('https://very-long-domain-name.example.com/with/many/path/segments?and=lots&of=query&params=true');
    expect(short.length).toBe(long.length);
  });

  test('HTTP and HTTPS versions of same path produce different keys', () => {
    expect(urlToKey('http://example.com')).not.toBe(urlToKey('https://example.com'));
  });

  test('trailing slash and no trailing slash produce different keys', () => {
    expect(urlToKey('https://example.com')).not.toBe(urlToKey('https://example.com/'));
  });
});

// ─────────────────────────────────────────────────────────────
// getCachedScore
// ─────────────────────────────────────────────────────────────
describe('getCachedScore', () => {
  test('returns null when no entry exists', async () => {
    const storage = new MockStorage();
    expect(await getCachedScore('https://example.com', storage)).toBeNull();
  });

  test('returns data for a fresh entry', async () => {
    const storage = new MockStorage();
    const data = { slopIndex: 4.2, label: 'medium' };
    await setCachedScore('https://example.com', data, storage);
    expect(await getCachedScore('https://example.com', storage)).toEqual(data);
  });

  test('returns null for an expired entry', async () => {
    const url = 'https://expired.com';
    const key = urlToKey(url);
    const storage = new MockStorage({
      [key]: { data: { slopIndex: 5 }, timestamp: Date.now() - CACHE_TTL_MS - 1000 },
    });
    expect(await getCachedScore(url, storage)).toBeNull();
  });

  test('removes an expired entry from storage', async () => {
    const url = 'https://expired.com';
    const key = urlToKey(url);
    const storage = new MockStorage({
      [key]: { data: { slopIndex: 5 }, timestamp: Date.now() - CACHE_TTL_MS - 1 },
    });
    await getCachedScore(url, storage);
    expect(storage._get(key)).toBeUndefined();
  });

  test('returns null for entry exactly 1 ms past the TTL', async () => {
    const url = 'https://example.com';
    const key = urlToKey(url);
    const storage = new MockStorage({
      [key]: { data: { slopIndex: 3 }, timestamp: Date.now() - CACHE_TTL_MS - 1 },
    });
    expect(await getCachedScore(url, storage)).toBeNull();
  });

  test('returns data for entry 1 minute before expiry', async () => {
    const url = 'https://example.com';
    const key = urlToKey(url);
    const storage = new MockStorage({
      [key]: { data: { slopIndex: 3 }, timestamp: Date.now() - CACHE_TTL_MS + 60_000 },
    });
    expect(await getCachedScore(url, storage)).toEqual({ slopIndex: 3 });
  });

  test('two different URLs retrieve independent entries', async () => {
    const storage = new MockStorage();
    await setCachedScore('https://a.com', { slopIndex: 2 }, storage);
    await setCachedScore('https://b.com', { slopIndex: 8 }, storage);
    expect(await getCachedScore('https://a.com', storage)).toEqual({ slopIndex: 2 });
    expect(await getCachedScore('https://b.com', storage)).toEqual({ slopIndex: 8 });
  });

  test('returns full score object with all fields', async () => {
    const storage = new MockStorage();
    const full = { slopIndex: 7, label: 'high', dimensions: { substance_density: 2 }, explanation: 'bad' };
    await setCachedScore('https://example.com', full, storage);
    expect(await getCachedScore('https://example.com', storage)).toEqual(full);
  });
});

// ─────────────────────────────────────────────────────────────
// setCachedScore
// ─────────────────────────────────────────────────────────────
describe('setCachedScore', () => {
  test('stores the data object', async () => {
    const storage = new MockStorage();
    const data = { slopIndex: 5, label: 'medium' };
    await setCachedScore('https://example.com', data, storage);
    const key   = urlToKey('https://example.com');
    expect(storage._get(key).data).toEqual(data);
  });

  test('stores a timestamp close to now', async () => {
    const storage = new MockStorage();
    const before = Date.now();
    await setCachedScore('https://example.com', { slopIndex: 5 }, storage);
    const after = Date.now();
    const key   = urlToKey('https://example.com');
    const ts    = storage._get(key).timestamp;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  test('overwrites an existing cache entry', async () => {
    const storage = new MockStorage();
    await setCachedScore('https://example.com', { slopIndex: 5 }, storage);
    await setCachedScore('https://example.com', { slopIndex: 9 }, storage);
    expect(await getCachedScore('https://example.com', storage)).toEqual({ slopIndex: 9 });
  });

  test('does not affect entries for other URLs', async () => {
    const storage = new MockStorage();
    await setCachedScore('https://a.com', { slopIndex: 3 }, storage);
    await setCachedScore('https://b.com', { slopIndex: 7 }, storage);
    expect(await getCachedScore('https://a.com', storage)).toEqual({ slopIndex: 3 });
  });
});

// ─────────────────────────────────────────────────────────────
// clearCachedScore
// ─────────────────────────────────────────────────────────────
describe('clearCachedScore', () => {
  test('removes a cached entry so subsequent get returns null', async () => {
    const storage = new MockStorage();
    await setCachedScore('https://example.com', { slopIndex: 5 }, storage);
    await clearCachedScore('https://example.com', storage);
    expect(await getCachedScore('https://example.com', storage)).toBeNull();
  });

  test('does not throw when no entry exists', async () => {
    const storage = new MockStorage();
    await expect(clearCachedScore('https://nonexistent.com', storage)).resolves.not.toThrow();
  });

  test('does not affect other cached entries', async () => {
    const storage = new MockStorage();
    await setCachedScore('https://keep.com',   { slopIndex: 2 }, storage);
    await setCachedScore('https://remove.com', { slopIndex: 8 }, storage);
    await clearCachedScore('https://remove.com', storage);
    expect(await getCachedScore('https://keep.com', storage)).toEqual({ slopIndex: 2 });
  });
});
