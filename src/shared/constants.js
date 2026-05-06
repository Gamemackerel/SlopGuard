export const RUBRIC_WEIGHTS = {
  substance_density: -1.5,
  originality: -1.0,
  source_quality: -0.8,
  manipulation_tactics: 1.5,
  ai_generation_likelihood: 1.0,
  engagement_bait_score: 1.5,
  commercial_extraction_score: 1.0,
};

export const RUBRIC_DIMENSIONS = [
  { key: 'substance_density',        label: 'Substance',       positive: true  },
  { key: 'originality',              label: 'Originality',     positive: true  },
  { key: 'source_quality',           label: 'Source Quality',  positive: true  },
  { key: 'manipulation_tactics',     label: 'Manipulation',    positive: false },
  { key: 'ai_generation_likelihood', label: 'AI-Generated',    positive: false },
  { key: 'engagement_bait_score',    label: 'Engagement Bait', positive: false },
  { key: 'commercial_extraction_score', label: 'Commercial',   positive: false },
];

export const SLOP_THRESHOLDS = {
  LOW: 3.5,
  HIGH: 6.5,
};

export const DEFAULT_BLACKLIST = [
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'calendar.google.com',
  'web.whatsapp.com',
  'web.telegram.org',
  'discord.com',
  'slack.com',
  'linear.app',
  'notion.so',
  'docs.google.com',
  'sheets.google.com',
  'drive.google.com',
  'figma.com',
  'maps.google.com',
  'maps.apple.com',
  'paypal.com',
  'stripe.com',
  'venmo.com',
];

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const INGESTION_WINDOW_DAYS = 7;

export const MAX_VISIT_DURATION_SECONDS = 1800;

export const STORAGE_KEYS = {
  API_KEY:       'apiKey',
  BLACKLIST:     'blacklist',
  INGESTION_LOG: 'ingestionLog',
  SCORE_CACHE:   'scoreCache',
};

export const API_MODEL = 'claude-haiku-4-5-20251001';

export const CONTENT_MAX_CHARS = 8000;

export const SCORING_PROMPT = `You are a content quality evaluator. Analyze the following web page and score it on seven dimensions using integers 0–10:

- substance_density: How much substantive, original information is present? (10 = very dense with facts/analysis, 0 = empty filler)
- originality: Is the content original vs. rehashed/aggregated? (10 = highly original, 0 = pure aggregation)
- source_quality: How credible and authoritative? (10 = expert/primary source, 0 = unknown/unreliable)
- manipulation_tactics: Does it use fear, outrage, or urgency to hold attention? (10 = heavy manipulation, 0 = none)
- ai_generation_likelihood: Does this read like AI-generated filler? (10 = almost certainly, 0 = clearly human)
- engagement_bait_score: Is this optimized for clicks over substance? (10 = pure clickbait, 0 = not at all)
- commercial_extraction_score: Is this designed to keep you browsing to extract commercial value? (10 = pure extraction, 0 = none)

Return ONLY a valid JSON object with these exact seven keys and integer values 0–10. No explanation, no markdown fences.`;
