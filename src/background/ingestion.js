import {
  STORAGE_KEYS,
  INGESTION_WINDOW_DAYS,
  MAX_VISIT_DURATION_SECONDS,
} from '../shared/constants.js';
import { extractDomain } from '../shared/blacklist.js';

const WINDOW_MS = INGESTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export async function recordVisit(entry, storage) {
  const log = await loadLog(storage);
  const newEntry = {
    url:             entry.url,
    domain:          entry.domain ?? extractDomain(entry.url) ?? '',
    slopIndex:       entry.slopIndex,
    durationSeconds: entry.durationSeconds ?? 0,
    timestamp:       Date.now(),
  };
  await storage.set({ [STORAGE_KEYS.INGESTION_LOG]: [...log, newEntry] });
}

export async function loadLog(storage) {
  const result = await storage.get(STORAGE_KEYS.INGESTION_LOG);
  const raw = result[STORAGE_KEYS.INGESTION_LOG] ?? [];
  const cutoff = Date.now() - WINDOW_MS;
  return raw.filter((e) => e.timestamp > cutoff);
}

// Returns a score 0–10 (higher = better quality consumption).
// Duration-weighted average: score = 10 - weightedAvgSlopIndex.
// Returns null when there is not enough data to be meaningful.
export function computeIngestionScore(log) {
  if (!log || log.length < 3) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const entry of log) {
    const duration = Math.min(entry.durationSeconds ?? 0, MAX_VISIT_DURATION_SECONDS);
    if (duration === 0) continue;
    totalWeight += duration;
    weightedSum += entry.slopIndex * duration;
  }

  if (totalWeight === 0) return null;

  const avgSlop = weightedSum / totalWeight;
  return Math.round(Math.max(0, Math.min(10, 10 - avgSlop)) * 10) / 10;
}

export async function getIngestionSummary(storage) {
  const log = await loadLog(storage);
  return {
    score:      computeIngestionScore(log),
    entryCount: log.length,
    windowDays: INGESTION_WINDOW_DAYS,
  };
}
