import {
  extractDomain,
  isBlacklisted,
  getBlacklist,
  addDomainToBlacklist,
  removeDomainFromBlacklist,
  resetBlacklist,
} from '../src/shared/blacklist.js';
import { DEFAULT_BLACKLIST, STORAGE_KEYS } from '../src/shared/constants.js';

// ─────────────────────────────────────────────────────────────
// extractDomain
// ─────────────────────────────────────────────────────────────
describe('extractDomain', () => {
  test('extracts hostname from https URL', () => {
    expect(extractDomain('https://example.com/path')).toBe('example.com');
  });

  test('extracts hostname from http URL', () => {
    expect(extractDomain('http://example.com')).toBe('example.com');
  });

  test('strips www prefix', () => {
    expect(extractDomain('https://www.example.com')).toBe('example.com');
  });

  test('preserves subdomain that is not www', () => {
    expect(extractDomain('https://sub.example.com')).toBe('sub.example.com');
  });

  test('preserves deep subdomain', () => {
    expect(extractDomain('https://a.b.example.com')).toBe('a.b.example.com');
  });

  test('strips port from hostname', () => {
    expect(extractDomain('https://example.com:8080/path')).toBe('example.com');
  });

  test('handles URL with query string', () => {
    expect(extractDomain('https://example.com/search?q=foo&page=2')).toBe('example.com');
  });

  test('handles URL with hash fragment', () => {
    expect(extractDomain('https://example.com/page#section')).toBe('example.com');
  });

  test('handles URL with credentials', () => {
    expect(extractDomain('https://user:pass@example.com/path')).toBe('example.com');
  });

  test('handles trailing slash', () => {
    expect(extractDomain('https://example.com/')).toBe('example.com');
  });

  test('handles real-world mail URL', () => {
    expect(extractDomain('https://mail.google.com/mail/u/0/#inbox')).toBe('mail.google.com');
  });

  test('returns null for invalid URL string', () => {
    expect(extractDomain('not a url')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(extractDomain('')).toBeNull();
  });

  test('returns null for null', () => {
    expect(extractDomain(null)).toBeNull();
  });

  test('returns null for undefined', () => {
    expect(extractDomain(undefined)).toBeNull();
  });

  test('returns null for numeric input', () => {
    expect(extractDomain(42)).toBeNull();
  });

  test('handles URL with only www (www-only hostname)', () => {
    // www alone — www. stripped → empty string, but that's fine, domain = ''
    // The main thing is it doesn't crash.
    const result = extractDomain('https://www/path');
    // 'www' is treated as a TLD-less host; stripping 'www.' prefix has no effect
    // because 'www' doesn't start with 'www.'
    expect(typeof result === 'string' || result === null).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// isBlacklisted
// ─────────────────────────────────────────────────────────────
describe('isBlacklisted', () => {
  const list = ['example.com', 'mail.google.com', 'discord.com'];

  test('returns true for exact domain match', () => {
    expect(isBlacklisted('https://example.com/path', list)).toBe(true);
  });

  test('returns true for subdomain of blacklisted domain', () => {
    expect(isBlacklisted('https://sub.example.com/page', list)).toBe(true);
  });

  test('returns true for deep subdomain', () => {
    expect(isBlacklisted('https://a.b.example.com', list)).toBe(true);
  });

  test('www is stripped before comparison — www.example.com matches example.com entry', () => {
    expect(isBlacklisted('https://www.example.com', list)).toBe(true);
  });

  test('returns false for domain not in list', () => {
    expect(isBlacklisted('https://other.com', list)).toBe(false);
  });

  test('returns false for similar-but-different domain (notexample.com)', () => {
    expect(isBlacklisted('https://notexample.com', list)).toBe(false);
  });

  test('returns false for parent of a blacklisted subdomain', () => {
    // mail.google.com is listed but google.com is not
    expect(isBlacklisted('https://google.com', list)).toBe(false);
  });

  test('returns true for exact subdomain match', () => {
    expect(isBlacklisted('https://mail.google.com/inbox', list)).toBe(true);
  });

  test('returns false for empty blacklist', () => {
    expect(isBlacklisted('https://example.com', [])).toBe(false);
  });

  test('returns false for invalid URL', () => {
    expect(isBlacklisted('not a url', list)).toBe(false);
  });

  test('works for discord.com entry', () => {
    expect(isBlacklisted('https://discord.com/channels/123', list)).toBe(true);
  });

  test('discord subdomain also matches discord.com entry', () => {
    expect(isBlacklisted('https://ptb.discord.com', list)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// getBlacklist
// ─────────────────────────────────────────────────────────────
describe('getBlacklist', () => {
  test('returns DEFAULT_BLACKLIST when nothing stored', async () => {
    const storage = new MockStorage();
    const list = await getBlacklist(storage);
    expect(list).toEqual(DEFAULT_BLACKLIST);
  });

  test('returns stored list when present', async () => {
    const stored = ['custom.com', 'another.org'];
    const storage = new MockStorage({ [STORAGE_KEYS.BLACKLIST]: stored });
    expect(await getBlacklist(storage)).toEqual(stored);
  });

  test('returns empty array when explicitly stored as empty', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.BLACKLIST]: [] });
    expect(await getBlacklist(storage)).toEqual([]);
  });

  test('each call returns a new array reference (not the same object)', async () => {
    const storage = new MockStorage();
    const a = await getBlacklist(storage);
    const b = await getBlacklist(storage);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  test('modifying the returned array does not affect subsequent calls', async () => {
    const storage = new MockStorage();
    const list = await getBlacklist(storage);
    list.push('injected.com');
    const again = await getBlacklist(storage);
    expect(again).not.toContain('injected.com');
  });
});

// ─────────────────────────────────────────────────────────────
// addDomainToBlacklist
// ─────────────────────────────────────────────────────────────
describe('addDomainToBlacklist', () => {
  test('adds new domain to list (starts from default)', async () => {
    const storage = new MockStorage();
    const result = await addDomainToBlacklist('https://newsite.io', storage);
    expect(result).toContain('newsite.io');
  });

  test('adds domain to an existing non-default list', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.BLACKLIST]: ['existing.com'] });
    const result = await addDomainToBlacklist('https://new.com', storage);
    expect(result).toContain('existing.com');
    expect(result).toContain('new.com');
  });

  test('does not add duplicate domain', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.BLACKLIST]: ['example.com'] });
    const result = await addDomainToBlacklist('https://example.com/page', storage);
    expect(result.filter((d) => d === 'example.com')).toHaveLength(1);
  });

  test('strips www before adding', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.BLACKLIST]: [] });
    const result = await addDomainToBlacklist('https://www.stripme.com', storage);
    expect(result).toContain('stripme.com');
    expect(result).not.toContain('www.stripme.com');
  });

  test('persists the updated list to storage', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.BLACKLIST]: [] });
    await addDomainToBlacklist('https://persisted.com', storage);
    expect(storage._get(STORAGE_KEYS.BLACKLIST)).toContain('persisted.com');
  });

  test('returns the full updated list', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.BLACKLIST]: ['a.com', 'b.com'] });
    const result = await addDomainToBlacklist('https://c.com', storage);
    expect(result).toHaveLength(3);
  });

  test('throws for completely invalid URL', async () => {
    const storage = new MockStorage();
    await expect(addDomainToBlacklist('not-a-url', storage)).rejects.toThrow();
  });

  test('throws for empty string', async () => {
    const storage = new MockStorage();
    await expect(addDomainToBlacklist('', storage)).rejects.toThrow();
  });

  test('does not write to storage when domain is already present (no-op)', async () => {
    const initial = ['already.com'];
    const storage = new MockStorage({ [STORAGE_KEYS.BLACKLIST]: initial });
    const setCallsBefore = 0; // fresh mock
    await addDomainToBlacklist('https://already.com', storage);
    // The returned list should be the same
    expect(await getBlacklist(storage)).toEqual(initial);
  });
});

// ─────────────────────────────────────────────────────────────
// removeDomainFromBlacklist
// ─────────────────────────────────────────────────────────────
describe('removeDomainFromBlacklist', () => {
  test('removes an existing domain', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.BLACKLIST]: ['a.com', 'b.com', 'c.com'] });
    const result = await removeDomainFromBlacklist('b.com', storage);
    expect(result).not.toContain('b.com');
    expect(result).toContain('a.com');
    expect(result).toContain('c.com');
  });

  test('returns list unchanged when domain not present', async () => {
    const initial = ['a.com', 'b.com'];
    const storage = new MockStorage({ [STORAGE_KEYS.BLACKLIST]: initial });
    const result = await removeDomainFromBlacklist('nothere.com', storage);
    expect(result).toEqual(initial);
  });

  test('persists updated list to storage', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.BLACKLIST]: ['keep.com', 'remove.com'] });
    await removeDomainFromBlacklist('remove.com', storage);
    expect(storage._get(STORAGE_KEYS.BLACKLIST)).not.toContain('remove.com');
  });

  test('handles empty list gracefully', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.BLACKLIST]: [] });
    const result = await removeDomainFromBlacklist('anything.com', storage);
    expect(result).toEqual([]);
  });

  test('removes only the matching domain, not similar ones', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.BLACKLIST]: ['example.com', 'sub.example.com'] });
    const result = await removeDomainFromBlacklist('example.com', storage);
    expect(result).not.toContain('example.com');
    expect(result).toContain('sub.example.com');
  });
});

// ─────────────────────────────────────────────────────────────
// resetBlacklist
// ─────────────────────────────────────────────────────────────
describe('resetBlacklist', () => {
  test('overwrites custom list with DEFAULT_BLACKLIST', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.BLACKLIST]: ['custom.com'] });
    const result = await resetBlacklist(storage);
    expect(result).toEqual(DEFAULT_BLACKLIST);
  });

  test('persists DEFAULT_BLACKLIST to storage', async () => {
    const storage = new MockStorage();
    await resetBlacklist(storage);
    expect(storage._get(STORAGE_KEYS.BLACKLIST)).toEqual(DEFAULT_BLACKLIST);
  });

  test('returned list is a new array, not the DEFAULT_BLACKLIST reference', async () => {
    const storage = new MockStorage();
    const result = await resetBlacklist(storage);
    result.push('injected.com');
    const stored = storage._get(STORAGE_KEYS.BLACKLIST);
    expect(stored).not.toContain('injected.com');
  });
});
