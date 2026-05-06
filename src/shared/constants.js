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
  { key: 'manipulation_tactics',     label: 'Manipulation',    positive: false },
  { key: 'ai_generation_likelihood', label: 'AI-Generated',    positive: false },
  { key: 'engagement_bait_score',    label: 'Engagement Bait', positive: false },
  { key: 'commercial_extraction_score',     label: 'Commercial',    positive: false },
  { key: 'attention_fragmentation',         label: 'Attention Split',    positive: false },
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
- source_quality: How credible and authoritative? (10 = expert/primary source, 0 = unknown/unreliable)
- manipulation_tactics: Does the content use emotional levers to override the reader's judgment? Score high for fear appeals, manufactured urgency, outrage optimization, tribal validation ("your side wins"), political gotcha framing, and rage-bait — anything that exploits emotion to keep you reading or sharing rather than informing you. (10 = heavy emotional exploitation, 0 = none)
- ai_generation_likelihood: Does this read like AI-generated filler? (10 = almost certainly, 0 = clearly human)
- engagement_bait_score: Does the page use gross clickbait in its headlines or content titles — structural tricks designed to compel clicks regardless of whether the content delivers? Score high for curiosity-gap titles ("You won't believe…"), listicle bait ("10 things that…"), withholding the point in the headline, and other egregious title tricks. Score low for honest, descriptive titles that accurately represent the content. (10 = pure clickbait headline structure, 0 = honest titles)
- commercial_extraction_score: Is this page primarily designed to get you to browse and buy products — not just ad-supported, but actively commerce-oriented? Score high for shopping feeds, product listing pages, and infinite-scroll purchase surfaces (Amazon homepage, Facebook Marketplace browse, TikTok Shop, Etsy browse). Score low for content pages on ad-supported platforms where commerce is incidental — a Reddit thread, a news article, or a YouTube video that happens to have ads does not score high here. (10 = pure shopping extraction surface, 0 = not commerce-oriented)
- attention_fragmentation: Does the page structure fragment attention across many competing items rather than supporting engagement with one coherent piece? Score high for feeds, front pages, headline lists, and infinite-scroll surfaces where every item independently bids for attention. Score low for a single article, essay, video, or other unified piece of content the reader can finish. (10 = pure feed/list with no coherent single item, 0 = single focused piece)

Return ONLY a valid JSON object with these exact eight keys and integer values 0–10. No explanation, no markdown fences.`;
