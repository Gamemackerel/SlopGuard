import { getCachedScore, setCachedScore } from './cache.js';
import { scoreContent } from './scorer.js';
import { recordVisit, getIngestionSummary } from './ingestion.js';
import {
  isBlacklisted,
  getBlacklist,
  addDomainToBlacklist,
  extractDomain,
} from '../shared/blacklist.js';
import { SLOP_THRESHOLDS } from '../shared/constants.js';
import { localStore } from '../shared/storage.js';

// tabId → { url, startTime, slopIndex }
// Lost on service worker restart — acceptable; cache fills the gap.
const sessions = new Map();

// Prevent duplicate in-flight scoring requests for the same URL.
const inFlight = new Map();

function iconPath(slopIndex) {
  if (slopIndex === null || slopIndex === undefined) return { 32: 'icons/gray.png' };
  if (slopIndex < SLOP_THRESHOLDS.LOW)               return { 32: 'icons/green.png' };
  if (slopIndex <= SLOP_THRESHOLDS.HIGH)             return { 32: 'icons/yellow.png' };
  return { 32: 'icons/red.png' };
}

async function setTabIcon(tabId, slopIndex) {
  try {
    await chrome.action.setIcon({ tabId, path: iconPath(slopIndex) });
  } catch {
    // Tab closed or navigated away — silently ignore.
  }
}

async function endSession(tabId) {
  const session = sessions.get(tabId);
  if (!session) return;
  sessions.delete(tabId);

  const { url, startTime, slopIndex } = session;
  if (!url || slopIndex === null || slopIndex === undefined) return;

  const durationSeconds = Math.round((Date.now() - startTime) / 1000);
  if (durationSeconds < 5) return;

  await recordVisit({ url, slopIndex, durationSeconds }, localStore);
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || !tab.url.startsWith('http')) return;

  await endSession(tabId);
  sessions.set(tabId, { url: tab.url, startTime: Date.now(), slopIndex: null });

  const blacklist = await getBlacklist(localStore);
  if (isBlacklisted(tab.url, blacklist)) {
    await setTabIcon(tabId, null);
    return;
  }

  const cached = await getCachedScore(tab.url, localStore);
  if (cached) {
    sessions.get(tabId).slopIndex = cached.slopIndex;
    await setTabIcon(tabId, cached.slopIndex);
  }
  // If not cached, icon stays gray until the content script sends SCORE_CONTENT.
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await endSession(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'SCORE_CONTENT':
      handleScoreContent(message, sender)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
      return true;

    case 'GET_POPUP_DATA':
      handleGetPopupData()
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
      return true;

    case 'ADD_TO_BLACKLIST':
      addDomainToBlacklist(message.url, localStore)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ error: err.message }));
      return true;

    default:
      return false;
  }
});

async function handleScoreContent({ content, title, url }, sender) {
  const tabId = sender.tab?.id;

  const cached = await getCachedScore(url, localStore);
  if (cached) {
    if (tabId) {
      const session = sessions.get(tabId);
      if (session) session.slopIndex = cached.slopIndex;
      await setTabIcon(tabId, cached.slopIndex);
    }
    return cached;
  }

  if (inFlight.has(url)) return inFlight.get(url);

  const promise = scoreContent({
    title,
    url,
    textContent: content,
    storage: localStore,
  })
    .then(async (result) => {
      await setCachedScore(url, result, localStore);
      if (tabId) {
        const session = sessions.get(tabId);
        if (session) session.slopIndex = result.slopIndex;
        await setTabIcon(tabId, result.slopIndex);
      }
      return result;
    })
    .finally(() => inFlight.delete(url));

  inFlight.set(url, promise);
  return promise;
}

async function handleGetPopupData() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs.length || !tabs[0].url?.startsWith('http')) {
    return { state: 'no-tab' };
  }

  const { url } = tabs[0];
  const blacklist = await getBlacklist(localStore);

  if (isBlacklisted(url, blacklist)) {
    return { state: 'utility', domain: extractDomain(url) };
  }

  const [cached, ingestion] = await Promise.all([
    getCachedScore(url, localStore),
    getIngestionSummary(localStore),
  ]);

  if (!cached) {
    return { state: 'unscored', url, ingestion };
  }

  return { state: 'scored', url, score: cached, ingestion };
}
