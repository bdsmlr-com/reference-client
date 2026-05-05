export type ArchiveWhenGranularity = 'year' | 'month' | 'day';

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function inferArchiveWhenGranularity(when: string): ArchiveWhenGranularity {
  const normalized = (when || '').trim();
  if (YEAR_RE.test(normalized)) return 'year';
  if (MONTH_RE.test(normalized)) return 'month';
  if (DAY_RE.test(normalized)) return 'day';
  return 'month';
}

export function normalizeArchiveWhenInput(granularity: ArchiveWhenGranularity, value: string): string {
  const normalized = (value || '').trim();
  if (!normalized) return '';
  if (granularity === 'year') {
    return YEAR_RE.test(normalized) ? normalized : '';
  }
  if (granularity === 'month') {
    return MONTH_RE.test(normalized) ? normalized : '';
  }
  if (!DAY_RE.test(normalized)) {
    return '';
  }
  const parsed = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== normalized ? '' : normalized;
}

export function splitArchiveWhenForControl(when: string): { granularity: ArchiveWhenGranularity; value: string } {
  const normalized = (when || '').trim();
  const granularity = inferArchiveWhenGranularity(normalized);
  return {
    granularity,
    value: normalizeArchiveWhenInput(granularity, normalized) || normalized,
  };
}
