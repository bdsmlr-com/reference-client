import { describe, expect, it } from 'vitest';

import {
  inferArchiveWhenGranularity,
  normalizeArchiveWhenInput,
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
});
