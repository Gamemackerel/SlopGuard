# Slop Guard — Design Document

*A browser companion for defending your attention against engagement-optimized content.*

---

## Premise

The modern web is increasingly filled with content optimized for engagement rather than substance — AI-generated SEO articles, rage-bait, clickbait listicles, low-effort aggregator videos, infinite-scroll shopping. Existing tools (ad blockers, site blockers, focus apps) operate at the level of *domain* or *category*. They can't tell a thoughtful YouTube lecture apart from a reaction-farm video on the same channel.

Slop Guard uses an LLM to evaluate content *semantically*, scoring it on a "slop index" and giving the user lightweight, non-coercive tools to defend their own attention. It is a companion, not a jailer.

## Core philosophy

- **A mirror, never a cop.** Slop Guard reflects what you're doing back at you. It does not block, redirect, or moralize. It surfaces honest signal and lets you decide.
- **Erring toward silence.** When in doubt, the extension shuts up. Better to under-trigger and miss a moment of drift than to over-trigger and become another thing demanding attention. If a user ever describes Slop Guard as "annoying," the design has failed.
- **No gamification.** No streaks, rewards, leaderboards, or notifications. A tiny icon, a panel you open when you want it, an ingestion score that exists for your own reflection.
- **Browser-only, deliberately.** Phones are too locked-down to do this well, and trying to fix phone consumption is the wrong fight. Slop Guard recommends moving content consumption *to* the browser, where the user has real control, and treating the phone as a utility (calls, maps, messages, payments). Pairs naturally with a Light Phone or a deliberately deconfigured smartphone.
- **The user's algorithm.** Weights, thresholds, and rubric items are tunable. The point is to give the user the levers that platforms have taken from them.

---

## Version 1 — Foundation

The minimum viable version. Three features, no conversational components.

### 1.1 The Slop Indicator

A tiny icon in the browser toolbar. Its appearance reflects the slop score of the current page on a simple scale — for example, a small dot that shifts from green (substantive) through yellow to red (heavy slop). One glance, no interruption.

Clicking the icon expands a small panel showing:
- The overall slop score for this page
- The rubric breakdown (substance density, originality, source quality, manipulation tactics, AI-generation likelihood, engagement-bait score, commercial-extraction score)
- A one-line explanation of why the page scored as it did
- Toggles to override the score, whitelist the page, or whitelist the domain

The icon is ambient information, like a barometer. Nothing pops up. Nothing demands attention.

### 1.2 The Personal Ingestion Score

A running score reflecting the quality of what the user has consumed over time. Visible only when the user opens the panel. Never pushed, never notified about.

Components:
- **Active time on substantive content** — weighted positively, with diminishing returns past a daily ceiling so the score doesn't reward marathon doomscrolling-of-essays
- **Active time on slop** — weighted negatively
- **Engagement signal** — scrolling, text selection, tab focus — to distinguish reading from idling on a tab in the background
- **Diversity bonus** — small bump for breadth of substantive sources

The score is for personal reflection. Not a leaderboard. Not a streak. Not a thing to optimize.

### 1.3 The Utility Blacklist

Some sites are tools, not content, and don't make sense to score. The user maintains a blacklist of domains the extension ignores entirely — no scoring, no time tracking, no ingestion-score impact. Defaults include common utilities:

- Messaging (WhatsApp Web, Messages, Slack, Discord, Signal)
- Maps and navigation (Google Maps, Apple Maps)
- Email (Gmail, Outlook)
- Calendar, banking, payments
- Cloud productivity (Docs, Sheets, Notion, Linear, Figma)
- Search engines (the search results page itself; downstream pages are still scored)

The user can add to the blacklist from the panel ("treat this site as a utility"). The blacklist is editable, with a sensible default set on install.

### Treatment of shopping

Shopping is treated as slop by default, with nuance:

- **High-slop:** Infinite-scroll commerce surfaces optimized for browsing, not buying — Amazon homepage, eBay browse, Facebook Marketplace feeds, TikTok Shop, Temu, Shein, Etsy browse, Pinterest shopping. These are slot machines with merchandise.
- **Medium-slop:** General product listing pages and search results. You're shopping with intent, but the page is still optimized to keep you browsing.
- **Low-slop:** Specific product pages reached with intent (you searched for a specific item, you're reading the spec sheet, you're comparing reviews). The rubric considers whether the user arrived via a direct search or via a feed.
- **Not slop:** Substantive product reviews, repair guides, technical comparisons, manufacturer documentation.

The commercial-extraction rubric item is what does this work. Pages designed primarily to keep you browsing for things to buy score high on it. Pages that help you make a specific purchase decision score low.

Users who do legitimate sourcing work (buyers, resellers, hobbyists) can whitelist the relevant sites or add them to the utility blacklist.

### Technical approach (v1)

- **Page extraction:** Mozilla Readability.js for main-content extraction.
- **Scoring:** Hosted cheaper model (Haiku-tier or equivalent) for full-page rubric evaluation. Roughly $0.001 per scored page.
- **Caching:** URL-hashed shared cache so popular pages are scored once across all users; per-domain reputation accumulates as a fast-path heuristic.
- **Privacy:** Only extracted main-content text is sent for scoring — not the full DOM, not browsing history. Ingestion log stored locally, with optional encrypted sync.

---

## Version 2 — Feed Filtering

Once the foundation is solid, extend scoring from individual pages to the *links on a page*.

### 2.1 Per-Item Scoring on Aggregator Sites

On sites whose primary function is ranking and presenting links to other content — Reddit, YouTube, Hacker News, Twitter/X, news homepages, Substack feeds — Slop Guard scores individual feed items using surface signals: title, thumbnail, author/channel, preview text, engagement metrics, learned per-source reputation.

Surface scoring is fast and runs locally on a small model. It catches obvious slop (clickbait titles, rage-face thumbnails, known farms) but not sophisticated bait. For ambiguous cases, the system can deep-fetch and score the linked content in the background.

### 2.2 Aggressive Default Filtering

Items above the slop threshold are visually de-emphasized:

- **Default behavior:** items above the threshold are *hidden*, collapsed into a "(N items hidden)" placeholder the user can expand. The default threshold is **aggressive** — most clickbait, reaction farms, AI-generated content farms, and rage-bait should be hidden by default. The product's value comes from being noticeable, not subtle.
- **Per-site configuration:** each site has its own threshold. Reddit may filter aggressively; Hacker News may filter lightly. The user can dial each independently.
- **Always one click away:** hidden items are never blocked. The placeholder always lets the user expand and see what was filtered. This preserves trust.

The default posture: when in doubt, hide it. Users who feel the filter is too aggressive can dial it down — but the out-of-the-box experience should make the difference visible immediately.

### Technical approach (v2)

- **Surface scoring:** Local small model (Gemma 3, Phi, or quantized Llama via WebGPU) running in the extension. No network round-trip per item.
- **Per-source reputation:** As the user browses, the extension builds up a database of how channels, authors, and domains tend to score. Subsequent items from known sources skip live scoring.
- **Site-specific adapters:** Each supported feed site (Reddit, YouTube, HN, etc.) gets a small adapter that knows how to identify list items in the DOM and where to insert the placeholder UI.

---

## Version 3 — Conversational and Comment-Level

The conversational layer, plus extending scoring deeper into comment threads.

### 3.1 The Mirror (rare, opt-in, therapy-mode)

A small conversational panel that occasionally surfaces — *very* occasionally — when the extension's signals suggest the user is having a hard time. Not just spending time on slop, but the kind of pattern that looks like distress: long stretches of doomscrolling late at night, repeated returns to the same high-slop site within a short window, a sudden drop in substantive engagement after a week of healthy reading.

It opens in something like therapy mode. Not productivity mode, not goal-policing. The opening is gentle and direct:

> "You've been at this for a while. Want to talk about what's going on?"

If the user engages, the Mirror is a thoughtful listener. It does not have an agenda. It does not redirect to substantive content. It does not suggest the user "get back to work." It asks what's happening and reflects what it hears.

If the user dismisses it, it disappears and does not reappear that day.

Strict rules:
- Never triggered more than once per day
- Never triggered during a session the user has marked as paused or off
- Always dismissible with one click
- Never makes content recommendations
- Never references productivity, goals, or what the user "should" be doing
- Conversation history scoped to the session and not retained unless the user explicitly opts in

The Mirror is the riskiest feature in the product. It has to be exceptionally well-tuned, or it shouldn't ship. Better not to have it than to have a version that feels invasive, performative, or fake.

### 3.2 Comment-Level Scoring

Extending Slop Guard to comments. On Reddit, YouTube, and similar sites, individual comments are scored and low-quality ones (rage-bait, low-effort jokes, AI-generated, brigading) are collapsed using the same placeholder UI as feed items.

Reddit gets first-class treatment because of the structural quality of its comment threads — the gap between the best and worst comments on a popular thread is enormous, and a good filter is genuinely valuable.

This requires per-comment scoring at scale, which means heavy use of local models, aggressive caching, and probably scoring only the top N visible comments rather than every comment in a thread.

---

## Recommended companion practice

Slop Guard does not work on phones, and trying to make it work there is the wrong project. Onboarding makes a direct recommendation:

> Slop Guard works in your browser. To get the full benefit, treat your phone as a *utility* — calls, messages, maps, payments, camera — and consume content on a desktop or laptop where Slop Guard is active and where you have meaningful control over the page. A Light Phone, a dumbphone, or a smartphone with social and feed apps removed all work well.

This is a real recommendation, not a marketing pitch. The browser is the last piece of the consumer internet where the user can still install software that modifies what they see. Slop Guard leans into that.

---

## Out of scope (for the foreseeable future)

- Native mobile apps. Recommendation, not implementation.
- Filtering inside platform-native apps. Browser only.
- Social features, leaderboards, sharing of ingestion logs.
- Automatic content blocking. Slop Guard never blocks; users can always click through.
- Political content scoring beyond the manipulation/engagement-bait rubric. Slop is a structural quality, not a viewpoint.

## Open design questions

- **Shopping rubric tuning.** The line between "researching a purchase" and "browsing for the dopamine of buying" is fuzzy. The commercial-extraction rubric will need real-world calibration.
- **Per-source reputation drift.** A YouTube channel that was substantive a year ago may have pivoted to slop. The reputation model needs to age out old data.
- **AI-generated content detection.** Increasingly hard to detect, and an arms race. The rubric should weigh structural slop signals (engagement bait, no original information, generic phrasing) more heavily than authorship.
- **Treat-day mechanic.** A frictionless per-session pause ("off for the next hour") that does not require justification. How visible should it be in the UI?
- **The Mirror's trigger calibration.** This is the hardest single design question in the product. Wrong triggers make it feel invasive or fake. Worth extensive private testing before any public release.