console.log('[SlopGuard] content script loaded');

const MIN_CONTENT_LENGTH = 200;
const INITIAL_DELAY_MS    = 1500;
const NAVIGATION_DELAY_MS = 2000; // slightly longer — SPA content needs time to render

const STRIP_TAGS = new Set([
  'script', 'style', 'noscript', 'template',
  'svg', 'video', 'audio', 'canvas', 'iframe',
]);

const CONTENT_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'li', 'td', 'th', 'figcaption', 'blockquote', 'label', 'caption',
]);

let scored         = false;
let currentUrl     = window.location.href;
let navigationTimer = null;

function extractContent() {
  const seen  = new Set();
  const parts = [];

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        return STRIP_TAGS.has(node.tagName.toLowerCase())
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let node;
  while ((node = walker.nextNode())) {
    if (!CONTENT_TAGS.has(node.tagName.toLowerCase())) continue;
    if ([...node.children].some(c => CONTENT_TAGS.has(c.tagName.toLowerCase()))) continue;
    const text = node.textContent.trim().replace(/\s+/g, ' ');
    if (text.length < 15 || seen.has(text)) continue;
    seen.add(text);
    parts.push(text);
  }

  return parts.join('\n');
}

async function requestScore() {
  if (scored) return;
  scored = true;

  const text = extractContent();
  if (text.length < MIN_CONTENT_LENGTH) return;

  try {
    await chrome.runtime.sendMessage({
      type:    'SCORE_CONTENT',
      content: text,
      title:   document.title,
      url:     window.location.href,
    });
  } catch {
    // Extension context invalidated (e.g. extension updated mid-session).
  }
}

// ── SPA navigation detection ──────────────────────────────────────────────────
// SPAs change the URL via pushState/replaceState without a page reload.
// We intercept those calls and popstate (back/forward), then debounce a
// rescore to give the new page time to render its content.

function scheduleRescore() {
  if (navigationTimer) clearTimeout(navigationTimer);
  navigationTimer = setTimeout(() => {
    navigationTimer = null;
    scored = false;
    requestScore();
  }, NAVIGATION_DELAY_MS);
}

function onUrlChange() {
  const newUrl = window.location.href;
  if (newUrl === currentUrl) return;
  currentUrl = newUrl;

  // Tell the background immediately so it can reset the icon to gray
  // and close out the previous session — don't wait for scoring.
  chrome.runtime.sendMessage({ type: 'NAV_CHANGED', url: newUrl }).catch(() => {});

  scheduleRescore();
}

// Intercept History API directly — works for SPAs that call history.pushState.
const _pushState    = history.pushState.bind(history);
const _replaceState = history.replaceState.bind(history);

history.pushState = function (...args) {
  _pushState(...args);
  onUrlChange();
};

history.replaceState = function (...args) {
  _replaceState(...args);
  onUrlChange();
};

window.addEventListener('popstate', onUrlChange);

// Polling fallback — catches SPAs (e.g. YouTube) that captured a reference
// to the original pushState before our script ran and bypass the override above.
setInterval(onUrlChange, 500);

// ── Initial load ──────────────────────────────────────────────────────────────
setTimeout(requestScore, INITIAL_DELAY_MS);

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RESCORE') {
    scored = false;
    requestScore();
  }
});
