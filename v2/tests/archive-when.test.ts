import { describe, expect, it } from 'vitest';

import {
  formatArchiveWhenLabel,
  getArchiveWhenDays,
  getArchiveWhenMonths,
  getArchiveWhenYears,
  inferArchiveWhenGranularity,
  normalizeArchiveWhenInput,
  resolveArchiveWhenBounds,
  splitArchiveWhenForControl,
} from '../src/services/archive-when.js';

describe('archive when helpers', () => {
  it('infers granularity from stored when values', () => {
    expect(inferArchiveWhenGranularity('2026')).toBe('year');
    expect(inferArchiveWhenGranularity('2026-05')).toBe('month');
    expect(inferArchiveWhenGranularity('2026-05-03')).toBe('day');
    expect(inferArchiveWhenGranularity('bad-value')).toBe('month');
  });

  it('normalizes valid year, month, and day values', () => {
    expect(normalizeArchiveWhenInput('year', '2026')).toBe('2026');
    expect(normalizeArchiveWhenInput('month', '2026-05')).toBe('2026-05');
    expect(normalizeArchiveWhenInput('day', '2026-05-03')).toBe('2026-05-03');
  });

  it('rejects invalid year, month, and day values', () => {
    expect(normalizeArchiveWhenInput('year', '26')).toBe('');
    expect(normalizeArchiveWhenInput('month', '2026-13')).toBe('');
    expect(normalizeArchiveWhenInput('day', '2026-02-30')).toBe('');
  });

  it('splits a persisted when value back into control state', () => {
    expect(splitArchiveWhenForControl('2026')).toEqual({ granularity: 'year', value: '2026' });
    expect(splitArchiveWhenForControl('2026-05')).toEqual({ granularity: 'month', value: '2026-05' });
    expect(splitArchiveWhenForControl('2026-05-03')).toEqual({ granularity: 'day', value: '2026-05-03' });
  });

  it('formats the compact label with all-time fallback', () => {
    expect(formatArchiveWhenLabel('')).toBe('All time');
    expect(formatArchiveWhenLabel('2026')).toBe('2026');
  });

  it('lists years, months, and days within archive bounds', () => {
    const bounds = resolveArchiveWhenBounds({ archiveMinDate: '2024-02-03', archiveMaxDate: '2026-05-05' });
    expect(getArchiveWhenYears(bounds)).toEqual([2026, 2025, 2024]);
    expect(getArchiveWhenMonths(2026, bounds)).toEqual([1, 2, 3, 4, 5]);
    expect(getArchiveWhenMonths(2024, bounds)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(getArchiveWhenDays(2024, 2, bounds)).toEqual(Array.from({ length: 27 }, (_, i) => i + 3));
    expect(getArchiveWhenDays(2026, 5, bounds).at(-1)).toBe(5);
  });
});
