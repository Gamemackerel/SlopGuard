export const RUBRIC_WEIGHTS = {
  substance_density: -1.5,
  originality: -1.0,
  source_quality: -0.8,
  manipulation_tactics: 1.5,
  ai_generation_likelihood: 1.0,
  engagement_bait_score: 1.5,
  commercial_extraction_score: 1.0,
  attention_fragmentation: 1.2,
};

export const RUBRIC_DIMENSIONS = [
  { key: 'substance_density',        label: 'Substance',       positive: true  },
  { key: 'originality',              label: 'Originality',     positive: true  },
  { key: 'source_quality',           label: 'Source Quality',  positive: true  },
  { key: 'manipulation_tactics',        label: 'Exploitation',   positive: false },
  { key: 'ai_generation_likelihood',    label: 'AI-Generated',   positive: false },
  { key: 'engagement_bait_score',       label: 'Clickbait',      positive: false },
  { key: 'commercial_extraction_score', label: 'Commerce Trap',  positive: false },
  { key: 'attention_fragmentation',     label: 'Fragmentation',  positive: false },
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

export const SCORING_PROMPT = `You are a content quality evaluator. Analyze the following web page and score it on eight dimensions using integers 0–10:

- substance_density: How much substantive information is present? (10 = dense with facts/analysis that enriches understanding, 0 = empty filler or pure reaction)
- originality: Does this offer original insight or analysis beyond surface-level facts or reactions? A brief reaction to a news event or tweet scores 1–2 even if it technically broke the story. (10 = genuinely novel insight/analysis, 0 = reaction or aggregation with no added insight)
- source_quality: Combines brand trustworthiness with content expertise. A well-known legitimate brand (Amazon, Reddit, CNN) earns a baseline of 3–5 simply for being a real, established source rather than spam or misinformation. To score higher, the content itself must reflect genuine expertise: domain experts writing about their field, primary research, credentialed professionals, or rigorous editorial standards earn 5–7. Peer-reviewed research, authoritative institutions, or direct primary sources earn 8–10. Product listings, commercial homepages, and aggregated feeds from even well-known brands stay at 2–4. Unknown or unreliable sources score 0–1. (10 = primary source or genuine expert content, 0 = unknown or unreliable)
- manipulation_tactics: Does the content engineer emotional states to override judgment and sustain engagement past the point where substance would justify it? The full spectrum includes: fear and threat amplification; manufactured urgency and FOMO; outrage and tribal rage-bait; erotic or sexual arousal used as a hook regardless of content relevance; sadness and pathos harvested for shares; envy and aspiration manipulation; validation-seeking triggers ("only smart people notice this"); disgust and shock bait; nostalgia exploitation; and parasocial content engineered to simulate intimacy or companionship. CRITICAL NUANCE: genuine curiosity, wonder, and awe that arise naturally from substantive content do NOT score high here. A genuinely fascinating article about physics, a moving personal essay with real depth, or content that earns its emotional response through actual substance should score low. Only score high when emotion is manufactured as a substitute for substance, or deployed to keep engagement running after the content has stopped delivering real value. (10 = heavy emotional exploitation, 0 = none or emotion is earned by genuine substance)
- ai_generation_likelihood: Does this read like AI-generated filler? (10 = almost certainly, 0 = clearly human)
- engagement_bait_score: Does the page use gross clickbait in its headlines or content titles — structural tricks designed to compel clicks regardless of whether the content delivers? Score high for curiosity-gap titles ("You won't believe…"), listicle bait ("10 things that…"), withholding the point in the headline, and other egregious title tricks. Score low for honest, descriptive titles that accurately represent the content. (10 = pure clickbait headline structure, 0 = honest titles)
- commercial_extraction_score: How much of this page's visible content is commercial — ads, product listings, sponsored content, shopping recommendations, buy-now prompts? Score based on what is actually present on the page, not the platform's business model. No visible commercial content scores 0–1. A page with a few ads scores 2–3. Significant inline ads or sponsored content scores 4–6. Pages dominated by product feeds, shopping recommendations, or commerce surfaces (Amazon homepage, Shein browse, TikTok Shop) score 7–10. If the user has an ad blocker and no commercial content is visible, score low. (10 = page is overwhelmingly commercial product content, 0 = no commercial content visible)
- attention_fragmentation: Does the page structure fragment attention across many competing items rather than supporting engagement with one coherent piece? Score high for feeds, front pages, headline lists, and infinite-scroll surfaces where every item independently bids for attention. Score low for a single article, essay, video, or other unified piece of content the reader can finish. (10 = pure feed/list with no coherent single item, 0 = single focused piece)

Return ONLY a valid JSON object with these exact eight keys and integer values 0–10. No explanation, no markdown fences.`;
