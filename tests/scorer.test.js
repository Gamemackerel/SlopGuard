import {
  computeSlopIndex,
  getSlopLabel,
  buildExplanation,
  scoreContent,
} from '../src/background/scorer.js';
import { RUBRIC_WEIGHTS, STORAGE_KEYS } from '../src/shared/constants.js';

// Build a full dimensions object, with defaults of 5 for any unspecified key.
function dims(overrides = {}) {
  return {
    substance_density:              5,
    originality:                    5,
    source_quality:                 5,
    manipulation_tactics:           5,
    ai_generation_likelihood:       5,
    engagement_bait_score:          5,
    commercial_extraction_score:    5,
    attention_fragmentation:        5,
    ...overrides,
  };
}

// Build a mock fetch that returns a valid Claude API shape.
function makeFetch(dimensions, status = 200) {
  return jest.fn().mockResolvedValue({
    ok:   status >= 200 && status < 300,
    status,
    json: async () => ({
      content: [{ type: 'text', text: JSON.stringify(dimensions) }],
    }),
    text: async () => JSON.stringify({ content: [{ text: JSON.stringify(dimensions) }] }),
  });
}

function makeFetchError(status, body = '') {
  return jest.fn().mockResolvedValue({
    ok:   false,
    status,
    json: async () => { throw new Error('not json'); },
    text: async () => body,
  });
}

const TITLE   = 'Test Article';
const URL_STR = 'https://example.com/article';
const CONTENT = 'This is a thoughtful article about a specific topic with real substance.';

// ─────────────────────────────────────────────────────────────
// computeSlopIndex
// ─────────────────────────────────────────────────────────────
describe('computeSlopIndex', () => {
  test('returns 0 when all dimensions are maximally good', () => {
    expect(computeSlopIndex(dims({
      substance_density: 10, originality: 10, source_quality: 10,
      manipulation_tactics: 0, ai_generation_likelihood: 0,
      engagement_bait_score: 0, commercial_extraction_score: 0,
      attention_fragmentation: 0,
    }))).toBeCloseTo(0, 1);
  });

  test('returns 10 when all dimensions are maximally bad', () => {
    expect(computeSlopIndex(dims({
      substance_density: 0, originality: 0, source_quality: 0,
      manipulation_tactics: 10, ai_generation_likelihood: 10,
      engagement_bait_score: 10, commercial_extraction_score: 10,
      attention_fragmentation: 10,
    }))).toBeCloseTo(10, 1);
  });

  test('returns approximately 5 when all dimensions are 5', () => {
    const result = computeSlopIndex(dims());
    expect(result).toBeGreaterThan(4);
    expect(result).toBeLessThan(6);
  });

  test('result is always between 0 and 10 for all-extreme inputs', () => {
    const combos = [
      dims({ substance_density: 10, manipulation_tactics: 10 }),
      dims({ substance_density: 0 }),
      dims({ engagement_bait_score: 10 }),
      dims({ source_quality: 0, ai_generation_likelihood: 10 }),
    ];
    for (const d of combos) {
      const r = computeSlopIndex(d);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(10);
    }
  });

  test('increasing substance_density lowers slop index', () => {
    expect(computeSlopIndex(dims({ substance_density: 8 }))).toBeLessThan(
      computeSlopIndex(dims({ substance_density: 2 })),
    );
  });

  test('increasing manipulation_tactics raises slop index', () => {
    expect(computeSlopIndex(dims({ manipulation_tactics: 9 }))).toBeGreaterThan(
      computeSlopIndex(dims({ manipulation_tactics: 1 })),
    );
  });

  test('increasing engagement_bait_score raises slop index', () => {
    expect(computeSlopIndex(dims({ engagement_bait_score: 9 }))).toBeGreaterThan(
      computeSlopIndex(dims({ engagement_bait_score: 1 })),
    );
  });

  test('increasing originality lowers slop index', () => {
    expect(computeSlopIndex(dims({ originality: 9 }))).toBeLessThan(
      computeSlopIndex(dims({ originality: 1 })),
    );
  });

  test('increasing source_quality lowers slop index', () => {
    expect(computeSlopIndex(dims({ source_quality: 9 }))).toBeLessThan(
      computeSlopIndex(dims({ source_quality: 1 })),
    );
  });

  test('increasing commercial_extraction_score raises slop index', () => {
    expect(computeSlopIndex(dims({ commercial_extraction_score: 9 }))).toBeGreaterThan(
      computeSlopIndex(dims({ commercial_extraction_score: 1 })),
    );
  });

  test('increasing ai_generation_likelihood raises slop index', () => {
    expect(computeSlopIndex(dims({ ai_generation_likelihood: 9 }))).toBeGreaterThan(
      computeSlopIndex(dims({ ai_generation_likelihood: 1 })),
    );
  });

  test('missing dimensions default to 5 (neutral)', () => {
    const withMissing = computeSlopIndex({ substance_density: 5 });
    const allFives    = computeSlopIndex(dims());
    expect(withMissing).toBeCloseTo(allFives, 5);
  });

  test('result has at most one decimal place', () => {
    const result   = computeSlopIndex(dims({ substance_density: 7, manipulation_tactics: 3 }));
    const decimals = (result.toString().split('.')[1] || '').length;
    expect(decimals).toBeLessThanOrEqual(1);
  });

  test('substance_density has more impact than originality (larger absolute weight)', () => {
    const base     = computeSlopIndex(dims());
    const lowSubst = computeSlopIndex(dims({ substance_density: 0 }));
    const lowOrig  = computeSlopIndex(dims({ originality: 0 }));
    // substance_density weight -1.5 > originality weight -1.0 in magnitude
    expect(lowSubst - base).toBeGreaterThan(lowOrig - base);
  });

  test('manipulation_tactics has more impact than ai_generation_likelihood', () => {
    const base    = computeSlopIndex(dims());
    const highMan = computeSlopIndex(dims({ manipulation_tactics: 10 }));
    const highAI  = computeSlopIndex(dims({ ai_generation_likelihood: 10 }));
    expect(highMan - base).toBeGreaterThan(highAI - base);
  });

  test('engagement_bait and manipulation have equal weight impact', () => {
    const base    = computeSlopIndex(dims());
    const engBait = computeSlopIndex(dims({ engagement_bait_score: 10 }));
    const manip   = computeSlopIndex(dims({ manipulation_tactics: 10 }));
    expect(Math.abs(engBait - manip)).toBeLessThan(0.5); // same weight
  });

  // ── originality reframe ──
  test('originality still lowers slop index when high', () => {
    expect(computeSlopIndex(dims({ originality: 9 }))).toBeLessThan(
      computeSlopIndex(dims({ originality: 1 })),
    );
  });

  // ── political snark profile ──
  test('political snark profile (short reaction, high outrage) scores high slop', () => {
    // Models a short gotcha article: near-zero substance and insight,
    // high manipulation and outrage optimization.
    const snarkProfile = dims({
      substance_density:              1,
      originality:                    1,
      source_quality:                 5,
      manipulation_tactics:           8,
      ai_generation_likelihood:       1,
      engagement_bait_score:          10,
      commercial_extraction_score:    3,
    });
    expect(computeSlopIndex(snarkProfile)).toBeGreaterThan(6.5);
    expect(getSlopLabel(computeSlopIndex(snarkProfile))).toBe('high');
  });

  test('substantive political analysis does not score high despite political topic', () => {
    // A 3000-word analysis piece with genuine insight should score low
    // even though it covers politics.
    const analysisProfile = dims({
      substance_density:            8,
      originality:                  7,
      source_quality:               8,
      manipulation_tactics:         2,
      ai_generation_likelihood:     1,
      engagement_bait_score:        2,
      commercial_extraction_score:  1,
    });
    expect(computeSlopIndex(analysisProfile)).toBeLessThan(3.5);
    expect(getSlopLabel(computeSlopIndex(analysisProfile))).toBe('low');
  });

  // ── attention_fragmentation ──
  test('increasing attention_fragmentation raises slop index', () => {
    expect(computeSlopIndex(dims({ attention_fragmentation: 9 }))).toBeGreaterThan(
      computeSlopIndex(dims({ attention_fragmentation: 1 })),
    );
  });

  test('attention_fragmentation at 10 raises slop index above neutral', () => {
    expect(computeSlopIndex(dims({ attention_fragmentation: 10 }))).toBeGreaterThan(
      computeSlopIndex(dims()),
    );
  });

  test('attention_fragmentation at 0 lowers slop index below neutral', () => {
    expect(computeSlopIndex(dims({ attention_fragmentation: 0 }))).toBeLessThan(
      computeSlopIndex(dims()),
    );
  });

  test('well-curated feed scores above neutral (yellow) even with decent source quality', () => {
    // A quality newspaper homepage: fragmented format but genuinely good sources.
    // Should register as medium — visible signal without mislabeling it as pure slop.
    const qualityFeed = dims({
      substance_density:              5,
      originality:                    4,
      source_quality:                 7,
      manipulation_tactics:           4,
      ai_generation_likelihood:       1,
      engagement_bait_score:          6,
      commercial_extraction_score:    3,
      attention_fragmentation:        9,
    });
    const score = computeSlopIndex(qualityFeed);
    expect(score).toBeGreaterThan(3.5); // above low threshold → at least yellow
    expect(getSlopLabel(score)).toBe('medium');
  });

  test('low-quality feed (clickbait headlines, no substance) scores high slop', () => {
    // A Reddit-style front page or tabloid feed: fragmented AND low quality.
    const lowQualityFeed = dims({
      substance_density:              2,
      originality:                    2,
      source_quality:                 3,
      manipulation_tactics:           7,
      ai_generation_likelihood:       3,
      engagement_bait_score:          8,
      commercial_extraction_score:    5,
      attention_fragmentation:        9,
    });
    expect(computeSlopIndex(lowQualityFeed)).toBeGreaterThan(6.5);
  });

  test('single article page scores low on attention_fragmentation', () => {
    const articlePage = dims({
      substance_density:              7,
      originality:                    6,
      source_quality:                 7,
      manipulation_tactics:           2,
      ai_generation_likelihood:       1,
      engagement_bait_score:          2,
      commercial_extraction_score:    1,
      attention_fragmentation:        1,
    });
    expect(computeSlopIndex(articlePage)).toBeLessThan(3.5);
  });

  test('same content quality: feed version scores higher than article version', () => {
    const base = { substance_density: 5, originality: 5, source_quality: 6,
      manipulation_tactics: 3, ai_generation_likelihood: 1,
      engagement_bait_score: 4, commercial_extraction_score: 2 };
    const feed    = dims({ ...base, attention_fragmentation: 9 });
    const article = dims({ ...base, attention_fragmentation: 1 });
    expect(computeSlopIndex(feed)).toBeGreaterThan(computeSlopIndex(article));
  });

  test('attention_fragmentation has less weight than manipulation_tactics', () => {
    const base     = computeSlopIndex(dims());
    const highFrag = computeSlopIndex(dims({ attention_fragmentation: 10 }));
    const highManip = computeSlopIndex(dims({ manipulation_tactics: 10 }));
    expect(highManip - base).toBeGreaterThan(highFrag - base);
  });

  test('same originality: high engagement bait scores worse than neutral', () => {
    const reactionPiece = dims({ originality: 3, engagement_bait_score: 9, substance_density: 2 });
    const straightNews  = dims({ originality: 3, engagement_bait_score: 2, substance_density: 6 });
    expect(computeSlopIndex(reactionPiece)).toBeGreaterThan(computeSlopIndex(straightNews));
  });
});

// ─────────────────────────────────────────────────────────────
// getSlopLabel
// ─────────────────────────────────────────────────────────────
describe('getSlopLabel', () => {
  test('0 → "low"',     () => expect(getSlopLabel(0)).toBe('low'));
  test('1.5 → "low"',   () => expect(getSlopLabel(1.5)).toBe('low'));
  test('3.4 → "low"',   () => expect(getSlopLabel(3.4)).toBe('low'));
  test('3.5 → "medium"', () => expect(getSlopLabel(3.5)).toBe('medium'));
  test('5.0 → "medium"', () => expect(getSlopLabel(5.0)).toBe('medium'));
  test('6.5 → "medium"', () => expect(getSlopLabel(6.5)).toBe('medium'));
  test('6.6 → "high"',  () => expect(getSlopLabel(6.6)).toBe('high'));
  test('8.0 → "high"',  () => expect(getSlopLabel(8.0)).toBe('high'));
  test('10  → "high"',  () => expect(getSlopLabel(10)).toBe('high'));
  test('6.50 is medium, 6.51 is high', () => {
    expect(getSlopLabel(6.50)).toBe('medium');
    expect(getSlopLabel(6.51)).toBe('high');
  });
});

// ─────────────────────────────────────────────────────────────
// buildExplanation
// ─────────────────────────────────────────────────────────────
describe('buildExplanation', () => {
  test('returns a non-empty string for low slop', () => {
    const s = buildExplanation(dims({ substance_density: 9, manipulation_tactics: 1 }), 1.0);
    expect(s.length).toBeGreaterThan(5);
  });

  test('returns a non-empty string for medium slop', () => {
    expect(buildExplanation(dims(), 5.0).length).toBeGreaterThan(5);
  });

  test('returns a non-empty string for high slop', () => {
    const s = buildExplanation(dims({ engagement_bait_score: 9, substance_density: 1 }), 8.5);
    expect(s.length).toBeGreaterThan(5);
  });

  test('low slop + high substance_density → mentions substance/information/analysis', () => {
    const s = buildExplanation(dims({ substance_density: 9 }), 1.0);
    expect(s.toLowerCase()).toMatch(/substance|information|analysis/);
  });

  test('low slop + high originality → mentions original', () => {
    const s = buildExplanation(dims({ originality: 9, substance_density: 4 }), 1.5);
    expect(s.toLowerCase()).toContain('original');
  });

  test('low slop + high source_quality → mentions credible/authoritative/source', () => {
    const s = buildExplanation(dims({ source_quality: 9, substance_density: 4 }), 2.0);
    expect(s.toLowerCase()).toMatch(/credible|authoritative|source/);
  });

  test('high slop + high engagement_bait → mentions clickbait/headline/title/clicks', () => {
    const s = buildExplanation(dims({ engagement_bait_score: 9, substance_density: 1 }), 8.5);
    expect(s.toLowerCase()).toMatch(/click|headline|title/);
  });

  test('high slop + high manipulation → mentions fear/outrage/tribal/judgment/emotion', () => {
    const s = buildExplanation(dims({ manipulation_tactics: 9, substance_density: 1 }), 8.0);
    expect(s.toLowerCase()).toMatch(/fear|outrage|tribal|judgment|emotion|exploit/);
  });

  test('high slop + high commercial_extraction → mentions commercial/browsing/gain', () => {
    const s = buildExplanation(dims({ commercial_extraction_score: 9, substance_density: 1 }), 8.0);
    expect(s.toLowerCase()).toMatch(/commercial|brows|gain/);
  });

  test('high slop + high ai_generation → mentions AI/generated/filler', () => {
    const s = buildExplanation(dims({ ai_generation_likelihood: 9, substance_density: 1 }), 7.5);
    expect(s.toLowerCase()).toMatch(/ai|generat|filler/);
  });

  test('medium slop returns a generic mixed-quality message', () => {
    const s = buildExplanation(dims(), 5.0);
    expect(s.toLowerCase()).toMatch(/mixed|quality|substance/);
  });

  test('high slop + high attention_fragmentation → mentions feed/scanning/headlines', () => {
    const s = buildExplanation(dims({ attention_fragmentation: 9, substance_density: 3 }), 7.5);
    expect(s.toLowerCase()).toMatch(/feed|list|scan|headline/);
  });

  test('attention_fragmentation takes top precedence in explanation when highest signal', () => {
    const s = buildExplanation(
      dims({ attention_fragmentation: 9, engagement_bait_score: 8, substance_density: 2 }),
      8.0,
    );
    expect(s.toLowerCase()).toMatch(/feed|list|scan|headline/);
  });

  test('low attention_fragmentation falls through to engagement bait explanation', () => {
    const s = buildExplanation(
      dims({ attention_fragmentation: 2, engagement_bait_score: 8, substance_density: 1 }),
      7.5,
    );
    expect(s.toLowerCase()).toMatch(/click|headline|title/);
  });

  test('high engagement_bait with high manipulation: attention_fragmentation checked first', () => {
    const s = buildExplanation(
      dims({ attention_fragmentation: 2, engagement_bait_score: 9, manipulation_tactics: 7, substance_density: 1 }),
      8.5,
    );
    // engagement_bait checked before manipulation in precedence order
    expect(s.toLowerCase()).toMatch(/click|headline|title/);
  });
});

// ─────────────────────────────────────────────────────────────
// scoreContent
// ─────────────────────────────────────────────────────────────
describe('scoreContent', () => {
  const goodDims = dims({ substance_density: 7, manipulation_tactics: 2 });

  test('returns slopIndex, label, dimensions, explanation, scoredAt on success', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    const result  = await scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn: makeFetch(goodDims) });
    expect(typeof result.slopIndex).toBe('number');
    expect(['low', 'medium', 'high']).toContain(result.label);
    expect(result.dimensions).toEqual(goodDims);
    expect(typeof result.explanation).toBe('string');
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(typeof result.scoredAt).toBe('number');
  });

  test('throws when no API key is stored', async () => {
    const storage = new MockStorage();
    await expect(scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn: makeFetch(goodDims) }))
      .rejects.toThrow(/api key/i);
  });

  test('throws on network/fetch error', async () => {
    const storage  = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    const fetchFn  = jest.fn().mockRejectedValue(new Error('Failed to fetch'));
    await expect(scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn }))
      .rejects.toThrow(/network error/i);
  });

  test('throws on HTTP 500 response', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    await expect(scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn: makeFetchError(500, 'Internal Error') }))
      .rejects.toThrow('500');
  });

  test('throws on HTTP 401 unauthorized', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-bad' });
    await expect(scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn: makeFetchError(401, 'Unauthorized') }))
      .rejects.toThrow('401');
  });

  test('throws on HTTP 429 rate limit', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    await expect(scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn: makeFetchError(429) }))
      .rejects.toThrow('429');
  });

  test('throws when API returns empty content array', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ content: [] }),
      text: async () => '{}',
    });
    await expect(scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn }))
      .rejects.toThrow(/empty/i);
  });

  test('throws when API returns non-JSON text', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'This is not JSON at all.' }] }),
      text: async () => '{}',
    });
    await expect(scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn }))
      .rejects.toThrow(/parse/i);
  });

  test('throws when rubric is missing a required dimension', async () => {
    const incomplete = { substance_density: 5, originality: 5 }; // 5 keys missing
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    await expect(scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn: makeFetch(incomplete) }))
      .rejects.toThrow();
  });

  test('throws when rubric value exceeds 10', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    await expect(scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn: makeFetch(dims({ substance_density: 15 })) }))
      .rejects.toThrow();
  });

  test('throws when rubric value is below 0', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    await expect(scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn: makeFetch(dims({ manipulation_tactics: -1 })) }))
      .rejects.toThrow();
  });

  test('throws when rubric value is a string', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    await expect(scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn: makeFetch(dims({ substance_density: 'high' })) }))
      .rejects.toThrow();
  });

  test('throws when rubric value is null', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    await expect(scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn: makeFetch(dims({ originality: null })) }))
      .rejects.toThrow();
  });

  test('truncates long content and adds marker', async () => {
    const storage  = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    const fetchFn  = makeFetch(goodDims);
    await scoreContent({ title: TITLE, url: URL_STR, textContent: 'X'.repeat(10_000), storage, fetchFn });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain('[content truncated]');
  });

  test('does not add truncation marker for short content', async () => {
    const storage  = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    const fetchFn  = makeFetch(goodDims);
    await scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.messages[0].content).not.toContain('[content truncated]');
  });

  test('strips markdown fences from API response before JSON parse', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    const fenced  = '```json\n' + JSON.stringify(goodDims) + '\n```';
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ content: [{ type: 'text', text: fenced }] }),
      text: async () => '{}',
    });
    const result = await scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn });
    expect(result.slopIndex).toBeDefined();
  });

  test('trims whitespace from API key before use', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: '  sk-ant-test  ' });
    const fetchFn = makeFetch(goodDims);
    await scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn });
    expect(fetchFn.mock.calls[0][1].headers['x-api-key']).toBe('sk-ant-test');
  });

  test('sends correct anthropic-version header', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    const fetchFn = makeFetch(goodDims);
    await scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn });
    expect(fetchFn.mock.calls[0][1].headers['anthropic-version']).toBe('2023-06-01');
  });

  test('posts to the correct Anthropic API endpoint', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    const fetchFn = makeFetch(goodDims);
    await scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn });
    expect(fetchFn.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
  });

  test('includes title and URL in the prompt body', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    const fetchFn = makeFetch(goodDims);
    await scoreContent({ title: 'My Unique Title', url: 'https://unique.example.com', textContent: CONTENT, storage, fetchFn });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    const msg  = body.messages[0].content;
    expect(msg).toContain('My Unique Title');
    expect(msg).toContain('https://unique.example.com');
  });

  test('scoredAt is within the test execution time window', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    const before  = Date.now();
    const result  = await scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn: makeFetch(goodDims) });
    expect(result.scoredAt).toBeGreaterThanOrEqual(before);
    expect(result.scoredAt).toBeLessThanOrEqual(Date.now());
  });

  test('all-good dimensions → slopIndex near 0 and label "low"', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    const allGood = dims({ substance_density: 10, originality: 10, source_quality: 10,
      manipulation_tactics: 0, ai_generation_likelihood: 0, engagement_bait_score: 0,
      commercial_extraction_score: 0, attention_fragmentation: 0 });
    const result  = await scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn: makeFetch(allGood) });
    expect(result.slopIndex).toBeCloseTo(0, 1);
    expect(result.label).toBe('low');
  });

  test('all-bad dimensions → slopIndex near 10 and label "high"', async () => {
    const storage = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    const allBad = dims({ substance_density: 0, originality: 0, source_quality: 0,
      manipulation_tactics: 10, ai_generation_likelihood: 10, engagement_bait_score: 10,
      commercial_extraction_score: 10, attention_fragmentation: 10 });
    const result  = await scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn: makeFetch(allBad) });
    expect(result.slopIndex).toBeCloseTo(10, 1);
    expect(result.label).toBe('high');
  });

  test('slopIndex has at most one decimal place', async () => {
    const storage  = new MockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-ant-test' });
    const result   = await scoreContent({ title: TITLE, url: URL_STR, textContent: CONTENT, storage, fetchFn: makeFetch(goodDims) });
    const decimals = (result.slopIndex.toString().split('.')[1] || '').length;
    expect(decimals).toBeLessThanOrEqual(1);
  });
});
