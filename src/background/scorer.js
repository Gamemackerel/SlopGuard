import {
  RUBRIC_WEIGHTS,
  SCORING_PROMPT,
  API_MODEL,
  STORAGE_KEYS,
  CONTENT_MAX_CHARS,
} from '../shared/constants.js';

const POSITIVE_MAX = Object.values(RUBRIC_WEIGHTS)
  .filter((w) => w > 0)
  .reduce((a, b) => a + b, 0) * 10;

const NEGATIVE_MAX = Math.abs(
  Object.values(RUBRIC_WEIGHTS)
    .filter((w) => w < 0)
    .reduce((a, b) => a + b, 0),
) * 10;

const RAW_MIN = -NEGATIVE_MAX;
const RAW_RANGE = POSITIVE_MAX + NEGATIVE_MAX;

export function computeSlopIndex(dimensions) {
  let raw = 0;
  for (const [dim, weight] of Object.entries(RUBRIC_WEIGHTS)) {
    raw += (dimensions[dim] ?? 5) * weight;
  }
  const normalized = (raw - RAW_MIN) / RAW_RANGE * 10;
  return Math.round(Math.max(0, Math.min(10, normalized)) * 10) / 10;
}

export function getSlopLabel(slopIndex) {
  if (slopIndex < 3.5) return 'low';
  if (slopIndex <= 6.5) return 'medium';
  return 'high';
}

export function buildExplanation(dimensions, slopIndex) {
  const label = getSlopLabel(slopIndex);

  if (label === 'low') {
    if (dimensions.substance_density >= 7) return 'Dense with information and original analysis.';
    if (dimensions.originality >= 7)       return 'Original perspective with genuine insight.';
    if (dimensions.source_quality >= 7)    return 'Credible, authoritative source.';
    return 'Generally substantive content.';
  }

  if (label === 'high') {
    if (dimensions.attention_fragmentation >= 7) return 'Feed or list page — designed for scanning headlines, not reading.';
    if (dimensions.engagement_bait_score >= 7)   return 'Optimized for emotional engagement — clicks, outrage, or tribal validation — over substance.';
    if (dimensions.manipulation_tactics >= 7)    return 'Uses emotional manipulation and manufactured urgency.';
    if (dimensions.commercial_extraction_score >= 7)    return 'Designed to keep you browsing for commercial gain.';
    if (dimensions.ai_generation_likelihood >= 7)       return 'Likely AI-generated filler content.';
    return 'Low information density with high engagement optimization.';
  }

  return 'Mixed quality — some substance alongside optimization.';
}

function validateDimensions(obj) {
  for (const key of Object.keys(RUBRIC_WEIGHTS)) {
    const val = obj[key];
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || val > 10) {
      throw new Error(`Invalid rubric value for "${key}": ${JSON.stringify(val)}`);
    }
  }
}

function stripFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function truncateContent(text) {
  if (text.length <= CONTENT_MAX_CHARS) return text;
  return text.slice(0, CONTENT_MAX_CHARS) + '\n[content truncated]';
}

export async function scoreContent({
  title,
  url,
  textContent,
  storage,
  fetchFn = globalThis.fetch,
}) {
  const keyResult = await storage.get(STORAGE_KEYS.API_KEY);
  const rawKey = keyResult[STORAGE_KEYS.API_KEY];
  if (!rawKey) throw new Error('No API key configured. Open extension settings.');
  const apiKey = rawKey.trim();

  const body = [
    SCORING_PROMPT,
    `\nTitle: ${title}`,
    `URL: ${url}`,
    `\nContent:\n${truncateContent(textContent || '')}`,
  ].join('\n');

  let response;
  try {
    response = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: API_MODEL,
        max_tokens: 256,
        messages: [{ role: 'user', content: body }],
      }),
    });
  } catch (err) {
    throw new Error(`Network error calling Claude API: ${err.message}`);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const blocks = data.content;
  if (!blocks || blocks.length === 0) throw new Error('Empty response from Claude API');

  const rawText = stripFences(blocks[0].text.trim());

  let dimensions;
  try {
    dimensions = JSON.parse(rawText);
  } catch {
    throw new Error(`Failed to parse rubric JSON from API response: ${rawText.slice(0, 120)}`);
  }

  validateDimensions(dimensions);

  const slopIndex = computeSlopIndex(dimensions);
  return {
    slopIndex,
    label:       getSlopLabel(slopIndex),
    dimensions,
    explanation: buildExplanation(dimensions, slopIndex),
    scoredAt:    Date.now(),
  };
}
