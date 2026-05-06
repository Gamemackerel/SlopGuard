import {
  recordVisit,
  loadLog,
  computeIngestionScore,
  getIngestionSummary,
} from '../src/background/ingestion.js';
import { STORAGE_KEYS, INGESTION_WINDOW_DAYS, MAX_VISIT_DURATION_SECONDS } from '../src/shared/constants.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function entry(overrides = {}) {
  return {
    url:             'https://example.com/article',
    domain:          'example.com',
    slopIndex:       3.0,
    durationSeconds: 300,
    timestamp:       Date.now(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// recordVisit
// ─────────────────────────────────────────────────────────────
describe('recordVisit', () => {
  test('appends to an empty log', async () => {
    const storage = new MockStorage();
    await recordVisit(entry(), storage);
    expect(storage._get(STORAGE_KEYS.INGESTION_LOG)).toHaveLength(1);
  });

  test('appends to an existing log', async () => {
    const existing = [entry({ url: 'https://first.com' })];
    const storage  = new MockStorage({ [STORAGE_KEYS.INGESTION_LOG]: existing });
    await recordVisit(entry({ url: 'https://second.com' }), storage);
    expect(storage._get(STORAGE_KEYS.INGESTION_LOG)).toHaveLength(2);
  });

  test('new entry gets a timestamp near now', async () => {
    const storage = new MockStorage();
    const before  = Date.now();
    await recordVisit(entry(), storage);
    const after   = Date.now();
    const ts = storage._get(STORAGE_KEYS.INGESTION_LOG)[0].timestamp;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  test('prunes entries older than the window', async () => {
    const old = entry({ url: 'https://old.com', timestamp: Date.now() - (INGESTION_WINDOW_DAYS + 1) * MS_PER_DAY });
    const storage = new MockStorage({ [STORAGE_KEYS.INGESTION_LOG]: [old] });
    await recordVisit(entry(), storage);
    const log = storage._get(STORAGE_KEYS.INGESTION_LOG);
    expect(log.some((e) => e.url === 'https://old.com')).toBe(false);
    expect(log).toHaveLength(1);
  });

  test('keeps entries within the window', async () => {
    const recent = entry({ url: 'https://recent.com', timestamp: Date.now() - 2 * MS_PER_DAY });
    const storage = new MockStorage({ [STORAGE_KEYS.INGESTION_LOG]: [recent] });
    await recordVisit(entry(), storage);
    expect(storage._get(STORAGE_KEYS.INGESTION_LOG).some((e) => e.url === 'https://recent.com')).toBe(true);
  });

  test('derives domain from URL when not provided', async () => {
    const storage = new MockStorage();
    await recordVisit({ url: 'https://sub.example.com/path', slopIndex: 4, durationSeconds: 60 }, storage);
    expect(storage._get(STORAGE_KEYS.INGESTION_LOG)[0].domain).toBe('sub.example.com');
  });

  test('uses provided domain when given', async () => {
    const storage = new MockStorage();
    await recordVisit(entry({ domain: 'custom.domain' }), storage);
    expect(storage._get(STORAGE_KEYS.INGESTION_LOG)[0].domain).toBe('custom.domain');
  });

  test('defaults durationSeconds to 0 when omitted', async () => {
    const storage = new MockStorage();
    await recordVisit({ url: 'https://example.com', slopIndex: 5 }, storage);
    expect(storage._get(STORAGE_KEYS.INGESTION_LOG)[0].durationSeconds).toBe(0);
  });

  test('stores all provided fields', async () => {
    const storage = new MockStorage();
    const e = entry({ slopIndex: 7.5, durationSeconds: 600 });
    await recordVisit(e, storage);
    const stored = storage._get(STORAGE_KEYS.INGESTION_LOG)[0];
    expect(stored.slopIndex).toBe(7.5);
    expect(stored.durationSeconds).toBe(600);
    expect(stored.url).toBe(e.url);
  });
});

// ─────────────────────────────────────────────────────────────
// loadLog
// ─────────────────────────────────────────────────────────────
describe('loadLog', () => {
  test('returns empty array when storage has no log', async () => {
    const storage = new MockStorage();
    expect(await loadLog(storage)).toEqual([]);
  });

  test('filters out entries older than the rolling window', async () => {
    const old   = entry({ url: 'https://old.com',   timestamp: Date.now() - (INGESTION_WINDOW_DAYS + 1) * MS_PER_DAY });
    const fresh = entry({ url: 'https://fresh.com', timestamp: Date.now() - MS_PER_DAY });
    const storage = new MockStorage({ [STORAGE_KEYS.INGESTION_LOG]: [old, fresh] });
    const log = await loadLog(storage);
    expect(log).toHaveLength(1);
    expect(log[0].url).toBe('https://fresh.com');
  });

  test('includes entries just inside the boundary', async () => {
    const borderline = entry({ timestamp: Date.now() - INGESTION_WINDOW_DAYS * MS_PER_DAY + 5000 });
    const storage = new MockStorage({ [STORAGE_KEYS.INGESTION_LOG]: [borderline] });
    expect(await loadLog(storage)).toHaveLength(1);
  });

  test('excludes entries at exactly the boundary (expired)', async () => {
    const at = entry({ timestamp: Date.now() - INGESTION_WINDOW_DAYS * MS_PER_DAY - 1 });
    const storage = new MockStorage({ [STORAGE_KEYS.INGESTION_LOG]: [at] });
    expect(await loadLog(storage)).toHaveLength(0);
  });

  test('does not mutate the stored array', async () => {
    const entries = [entry(), entry({ url: 'https://b.com' })];
    const storage = new MockStorage({ [STORAGE_KEYS.INGESTION_LOG]: entries });
    const log = await loadLog(storage);
    log.push({ fake: true });
    expect(storage._get(STORAGE_KEYS.INGESTION_LOG)).toHaveLength(2);
  });

  test('returns all entries when none are expired', async () => {
    const three = [entry(), entry({ url: 'https://b.com' }), entry({ url: 'https://c.com' })];
    const storage = new MockStorage({ [STORAGE_KEYS.INGESTION_LOG]: three });
    expect(await loadLog(storage)).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────
// computeIngestionScore
// ─────────────────────────────────────────────────────────────
describe('computeIngestionScore', () => {
  test('returns null for null input', () => {
    expect(computeIngestionScore(null)).toBeNull();
  });

  test('returns null for empty array', () => {
    expect(computeIngestionScore([])).toBeNull();
  });

  test('returns null for 1 entry', () => {
    expect(computeIngestionScore([entry()])).toBeNull();
  });

  test('returns null for 2 entries', () => {
    expect(computeIngestionScore([entry(), entry()])).toBeNull();
  });

  test('returns a number for exactly 3 entries', () => {
    const log = [entry(), entry(), entry()];
    expect(typeof computeIngestionScore(log)).toBe('number');
  });

  test('all slopIndex=0 → returns 10', () => {
    const log = Array(5).fill(null).map(() => entry({ slopIndex: 0, durationSeconds: 600 }));
    expect(computeIngestionScore(log)).toBeCloseTo(10, 0);
  });

  test('all slopIndex=10 → returns 0', () => {
    const log = Array(5).fill(null).map(() => entry({ slopIndex: 10, durationSeconds: 600 }));
    expect(computeIngestionScore(log)).toBeCloseTo(0, 0);
  });

  test('all slopIndex=5 → returns approximately 5', () => {
    const log = Array(5).fill(null).map(() => entry({ slopIndex: 5, durationSeconds: 600 }));
    expect(computeIngestionScore(log)).toBeCloseTo(5, 1);
  });

  test('result is always in [0, 10]', () => {
    const log = [
      entry({ slopIndex: 2,  durationSeconds: 300 }),
      entry({ slopIndex: 8,  durationSeconds: 600 }),
      entry({ slopIndex: 5,  durationSeconds: 120 }),
      entry({ slopIndex: 0,  durationSeconds: 900 }),
      entry({ slopIndex: 10, durationSeconds: 60  }),
    ];
    const score = computeIngestionScore(log);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(10);
  });

  test('duration-weighted: longer slop visit drags score down more', () => {
    const withLongSlop = [
      entry({ slopIndex: 1, durationSeconds: 600 }),
      entry({ slopIndex: 9, durationSeconds: 1200 }), // long slop
      entry({ slopIndex: 1, durationSeconds: 600 }),
    ];
    const withShortSlop = [
      entry({ slopIndex: 1, durationSeconds: 600 }),
      entry({ slopIndex: 9, durationSeconds: 60 }),  // short slop
      entry({ slopIndex: 1, durationSeconds: 600 }),
    ];
    expect(computeIngestionScore(withLongSlop)).toBeLessThan(
      computeIngestionScore(withShortSlop),
    );
  });

  test('caps durationSeconds at MAX_VISIT_DURATION_SECONDS', () => {
    const capped  = Array(3).fill(null).map(() => entry({ slopIndex: 2, durationSeconds: 99999 }));
    const uncapped = Array(3).fill(null).map(() => entry({ slopIndex: 2, durationSeconds: MAX_VISIT_DURATION_SECONDS }));
    expect(computeIngestionScore(capped)).toBeCloseTo(computeIngestionScore(uncapped), 5);
  });

  test('zero-duration entries are skipped (weight 0)', () => {
    const log = [
      entry({ slopIndex: 10, durationSeconds: 0 }),
      entry({ slopIndex: 10, durationSeconds: 0 }),
      entry({ slopIndex: 2,  durationSeconds: 600 }),
    ];
    // Zero-duration entries have no weight; effective score is based on slopIndex=2
    expect(computeIngestionScore(log)).toBeGreaterThan(6);
  });

  test('returns null when all entries have zero duration', () => {
    const log = Array(5).fill(null).map(() => entry({ durationSeconds: 0 }));
    expect(computeIngestionScore(log)).toBeNull();
  });

  test('result has at most one decimal place', () => {
    const log = Array(5).fill(null).map((_, i) => entry({ slopIndex: i * 2, durationSeconds: 300 }));
    const score = computeIngestionScore(log);
    const decimals = (score.toString().split('.')[1] || '').length;
    expect(decimals).toBeLessThanOrEqual(1);
  });

  test('mostly good content scores above 6', () => {
    const log = [
      entry({ slopIndex: 1.0, durationSeconds: 900 }),
      entry({ slopIndex: 2.0, durationSeconds: 600 }),
      entry({ slopIndex: 1.5, durationSeconds: 1200 }),
      entry({ slopIndex: 3.0, durationSeconds: 400 }),
      entry({ slopIndex: 2.0, durationSeconds: 800 }),
    ];
    expect(computeIngestionScore(log)).toBeGreaterThan(6);
  });

  test('mostly slop content scores below 4', () => {
    const log = [
      entry({ slopIndex: 8.0, durationSeconds: 900  }),
      entry({ slopIndex: 9.0, durationSeconds: 600  }),
      entry({ slopIndex: 7.0, durationSeconds: 1200 }),
      entry({ slopIndex: 8.5, durationSeconds: 400  }),
    ];
    expect(computeIngestionScore(log)).toBeLessThan(4);
  });

  test('same quality ratio produces same score regardless of duration magnitude', () => {
    const short = Array(3).fill(null).map(() => entry({ slopIndex: 3, durationSeconds: 30   }));
    const long  = Array(3).fill(null).map(() => entry({ slopIndex: 3, durationSeconds: 1800 }));
    expect(computeIngestionScore(short)).toBeCloseTo(computeIngestionScore(long), 1);
  });
});

// ─────────────────────────────────────────────────────────────
// getIngestionSummary
// ─────────────────────────────────────────────────────────────
describe('getIngestionSummary', () => {
  test('returns score=null and entryCount=0 for empty storage', async () => {
    const storage = new MockStorage();
    const summary = await getIngestionSummary(storage);
    expect(summary.score).toBeNull();
    expect(summary.entryCount).toBe(0);
  });

  test('windowDays equals INGESTION_WINDOW_DAYS constant', async () => {
    const storage = new MockStorage();
    const summary = await getIngestionSummary(storage);
    expect(summary.windowDays).toBe(INGESTION_WINDOW_DAYS);
  });

  test('entryCount reflects only entries within the window', async () => {
    const fresh = entry({ timestamp: Date.now() - MS_PER_DAY });
    const stale = entry({ url: 'https://old.com', timestamp: Date.now() - 10 * MS_PER_DAY });
    const storage = new MockStorage({ [STORAGE_KEYS.INGESTION_LOG]: [fresh, stale] });
    const summary = await getIngestionSummary(storage);
    expect(summary.entryCount).toBe(1);
  });

  test('returns a numeric score when there are enough entries', async () => {
    const entries = Array(5).fill(null).map((_, i) => ({
      url: `https://example.com/${i}`,
      domain: 'example.com',
      slopIndex: 3,
      durationSeconds: 300,
      timestamp: Date.now() - i * 60_000,
    }));
    const storage = new MockStorage({ [STORAGE_KEYS.INGESTION_LOG]: entries });
    const summary = await getIngestionSummary(storage);
    expect(typeof summary.score).toBe('number');
  });

  test('score is null when fewer than 3 recent entries', async () => {
    const entries = [
      entry({ timestamp: Date.now() - 1000 }),
      entry({ url: 'https://b.com', timestamp: Date.now() - 2000 }),
    ];
    const storage = new MockStorage({ [STORAGE_KEYS.INGESTION_LOG]: entries });
    const summary = await getIngestionSummary(storage);
    expect(summary.score).toBeNull();
    expect(summary.entryCount).toBe(2);
  });
});
