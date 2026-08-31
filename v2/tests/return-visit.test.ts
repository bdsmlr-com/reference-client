// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RETURN_VISIT_DAY_7_MS,
  RETURN_VISIT_DAY_30_MS,
  RETURN_VISIT_STORAGE_KEY,
  classifyReturnVisit,
  maybeTrackReturnVisit,
} from '../src/services/return-visit.js';

afterEach(() => {
  localStorage.removeItem(RETURN_VISIT_STORAGE_KEY);
  vi.unstubAllGlobals();
});

describe('classifyReturnVisit', () => {
  const now = 1_700_000_000_000;

  it('does nothing on a first visit or junk stamp', () => {
    expect(classifyReturnVisit(null, now)).toBeNull();
    expect(classifyReturnVisit(Number.NaN, now)).toBeNull();
    expect(classifyReturnVisit(now + 1, now)).toBeNull();
  });

  it('does nothing when the gap is under 7 days', () => {
    expect(classifyReturnVisit(now - (RETURN_VISIT_DAY_7_MS - 1), now)).toBeNull();
  });

  it('fires day_7 from 7 days up to (but not including) 30', () => {
    expect(classifyReturnVisit(now - RETURN_VISIT_DAY_7_MS, now)).toBe('return_visit_day_7');
    expect(classifyReturnVisit(now - (RETURN_VISIT_DAY_30_MS - 1), now)).toBe('return_visit_day_7');
  });

  it('fires day_30 at 30 days and beyond', () => {
    expect(classifyReturnVisit(now - RETURN_VISIT_DAY_30_MS, now)).toBe('return_visit_day_30');
    expect(classifyReturnVisit(now - RETURN_VISIT_DAY_30_MS * 2, now)).toBe('return_visit_day_30');
  });
});

describe('maybeTrackReturnVisit', () => {
  it('stamps a first visit without firing', () => {
    const gtag = vi.fn();
    vi.stubGlobal('gtag', gtag);
    const now = 1_700_000_000_000;

    maybeTrackReturnVisit(now);

    expect(gtag).not.toHaveBeenCalled();
    expect(localStorage.getItem(RETURN_VISIT_STORAGE_KEY)).toBe(String(now));
  });

  it('fires at most one event and always resets the clock', () => {
    const gtag = vi.fn();
    vi.stubGlobal('gtag', gtag);
    const first = 1_700_000_000_000;
    localStorage.setItem(RETURN_VISIT_STORAGE_KEY, String(first));

    const day8 = first + RETURN_VISIT_DAY_7_MS + 86_400_000;
    maybeTrackReturnVisit(day8);
    expect(gtag).toHaveBeenCalledWith('event', 'return_visit_day_7', expect.any(Object));
    expect(localStorage.getItem(RETURN_VISIT_STORAGE_KEY)).toBe(String(day8));

    gtag.mockClear();
    maybeTrackReturnVisit(day8 + 60_000);
    expect(gtag).not.toHaveBeenCalled();
    expect(localStorage.getItem(RETURN_VISIT_STORAGE_KEY)).toBe(String(day8 + 60_000));
  });
});
