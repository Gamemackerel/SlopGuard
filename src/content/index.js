import { Readability } from '@mozilla/readability';

console.log('[SlopGuard] content script loaded');

const MIN_CONTENT_LENGTH = 200;
let scored = false;

async function requestScore() {
  if (scored) return;
  scored = true;

  let article;
  try {
    const docClone = document.cloneNode(true);
    const reader = new Readability(docClone);
    article = reader.parse();
  } catch {
    return;
  }

  if (!article || article.textContent.length < MIN_CONTENT_LENGTH) return;

  try {
    await chrome.runtime.sendMessage({
      type:    'SCORE_CONTENT',
      content: article.textContent,
      title:   article.title || document.title,
      url:     window.location.href,
    });
  } catch {
    // Extension context may be invalidated (e.g. extension updated mid-session).
  }
}

setTimeout(requestScore, 1500);

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RESCORE') {
    scored = false;
    requestScore();
  }
});
