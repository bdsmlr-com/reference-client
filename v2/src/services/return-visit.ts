import { trackEvent } from './google-analytics.js';

export const RETURN_VISIT_STORAGE_KEY = 'site_ga_last_visit';

const DAY_MS = 24 * 60 * 60 * 1000;
export const RETURN_VISIT_DAY_7_MS = 7 * DAY_MS;
export const RETURN_VISIT_DAY_30_MS = 30 * DAY_MS;

export type ReturnVisitEvent = 'return_visit_day_7' | 'return_visit_day_30';

export function classifyReturnVisit(
  lastVisitMs: number | null,
  nowMs: number,
): ReturnVisitEvent | null {
  if (lastVisitMs == null || !Number.isFinite(lastVisitMs) || lastVisitMs > nowMs) {
    return null;
  }
  const elapsed = nowMs - lastVisitMs;
  if (elapsed >= RETURN_VISIT_DAY_30_MS) return 'return_visit_day_30';
  if (elapsed >= RETURN_VISIT_DAY_7_MS) return 'return_visit_day_7';
  return null;
}

function readLastVisitMs(): number | null {
  try {
    const raw = localStorage.getItem(RETURN_VISIT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLastVisitMs(nowMs: number): void {
  try {
    localStorage.setItem(RETURN_VISIT_STORAGE_KEY, String(nowMs));
  } catch {
    // ignore
  }
}

/** Once per document load. Always refreshes the last-visit stamp. */
export function maybeTrackReturnVisit(nowMs = Date.now()): void {
  const event = classifyReturnVisit(readLastVisitMs(), nowMs);
  if (event) {
    trackEvent(event);
  }
  writeLastVisitMs(nowMs);
}
