console.log('[SlopGuard] content script loaded');

const MIN_CONTENT_LENGTH = 200;

// Subtrees with no readable text — reject entirely so their text
// doesn't bleed into parent element textContent.
const STRIP_TAGS = new Set([
  'script', 'style', 'noscript', 'template',
  'svg', 'video', 'audio', 'canvas', 'iframe',
]);

// Leaf-level elements that carry actual human-readable content.
const CONTENT_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'li', 'td', 'th', 'figcaption', 'blockquote', 'label', 'caption',
]);

let scored = false;

function extractContent() {
  const seen = new Set();
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
    // Skip nodes whose direct children are also content tags to avoid
    // collecting both a <ul> parent and its <li> children separately.
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

  console.log('[SlopGuard] starting extraction');
  const t = performance.now();

  const text = extractContent();
  console.log(`[SlopGuard] extraction: ${(performance.now() - t).toFixed(0)}ms, ${text.length} chars`);

  if (text.length < MIN_CONTENT_LENGTH) {
    console.log('[SlopGuard] content too short, skipping');
    return;
  }

  console.log('[SlopGuard] sending to background for scoring');
  try {
    await chrome.runtime.sendMessage({
      type:    'SCORE_CONTENT',
      content: text,
      title:   document.title,
      url:     window.location.href,
    });
    console.log('[SlopGuard] scoring complete');
  } catch (err) {
    console.log(`[SlopGuard] message error: ${err.message}`);
  }
}

setTimeout(requestScore, 1500);

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RESCORE') {
    scored = false;
    requestScore();
  }
});
