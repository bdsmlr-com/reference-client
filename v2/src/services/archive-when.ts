export type ArchiveWhenGranularity = 'year' | 'month' | 'day';

export interface ArchiveWhenParts {
  granularity: ArchiveWhenGranularity;
  year: number;
  month?: number;
  day?: number;
}

export interface ArchiveWhenBounds {
  min?: string;
  max?: string;
}

const ARCHIVE_DEFAULT_START_YEAR = 2007;
const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatParts(parts: ArchiveWhenParts): string {
  if (parts.granularity === 'year') {
    return String(parts.year);
  }
  if (parts.granularity === 'month') {
    return `${parts.year}-${pad2(parts.month || 1)}`;
  }
  return `${parts.year}-${pad2(parts.month || 1)}-${pad2(parts.day || 1)}`;
}

function parseParts(when: string): ArchiveWhenParts | null {
  const normalized = (when || '').trim();
  if (YEAR_RE.test(normalized)) {
    return { granularity: 'year', year: Number.parseInt(normalized, 10) };
  }
  if (MONTH_RE.test(normalized)) {
    const [year, month] = normalized.split('-').map((value) => Number.parseInt(value, 10));
    return { granularity: 'month', year, month };
  }
  if (DAY_RE.test(normalized)) {
    const [year, month, day] = normalized.split('-').map((value) => Number.parseInt(value, 10));
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== normalized) {
      return null;
    }
    return { granularity: 'day', year, month, day };
  }
  return null;
}

function firstString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function parseBound(value: string): string {
  const parts = parseParts(value);
  return parts ? formatParts(parts) : '';
}

function parseBoundYear(value?: string): number | null {
  const parts = value ? parseParts(value) : null;
  return parts ? parts.year : null;
}

function parseBoundMonth(value?: string, year?: number): number | null {
  const parts = value ? parseParts(value) : null;
  if (!parts || parts.year !== year) {
    return null;
  }
  return parts.month || null;
}

function parseBoundDay(value?: string, year?: number, month?: number): number | null {
  const parts = value ? parseParts(value) : null;
  if (!parts || parts.year !== year || parts.month !== month) {
    return null;
  }
  return parts.day || null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseArchiveWhenParts(when: string): ArchiveWhenParts | null {
  return parseParts(when);
}

export function inferArchiveWhenGranularity(when: string): ArchiveWhenGranularity {
  const parts = parseParts(when);
  return parts?.granularity ?? 'month';
}

export function normalizeArchiveWhenValue(value: string): string {
  const parts = parseParts(value);
  return parts ? formatParts(parts) : '';
}

export function normalizeArchiveWhenInput(granularity: ArchiveWhenGranularity, value: string): string {
  const parts = parseParts(value);
  if (!parts || parts.granularity !== granularity) {
    return '';
  }
  return formatParts(parts);
}

export function formatArchiveWhenLabel(when: string): string {
  const normalized = normalizeArchiveWhenValue(when);
  return normalized || 'All time';
}

export function splitArchiveWhenForControl(when: string): { granularity: ArchiveWhenGranularity; value: string } {
  const parts = parseParts(when);
  return {
    granularity: parts?.granularity ?? inferArchiveWhenGranularity(when),
    value: normalizeArchiveWhenValue(when) || (when || '').trim(),
  };
}

export function resolveArchiveWhenBounds(blog?: unknown): ArchiveWhenBounds {
  const source = (blog || {}) as Record<string, unknown>;
  const min = parseBound(firstString(source, [
    'archiveMinWhen',
    'archiveMinDate',
    'archive_min_when',
    'archive_min_date',
    'minDate',
    'min_date',
  ]));
  const max = parseBound(firstString(source, [
    'archiveMaxWhen',
    'archiveMaxDate',
    'archive_max_when',
    'archive_max_date',
    'maxDate',
    'max_date',
  ]));
  return { min, max };
}

export function getArchiveWhenYears(bounds: ArchiveWhenBounds = {}): number[] {
  const minYear = parseBoundYear(bounds.min) ?? ARCHIVE_DEFAULT_START_YEAR;
  const maxYear = parseBoundYear(bounds.max) ?? new Date().getUTCFullYear();
  const startYear = Math.min(minYear, maxYear);
  const endYear = Math.max(minYear, maxYear);
  const years: number[] = [];
  for (let year = endYear; year >= startYear; year -= 1) {
    years.push(year);
  }
  return years;
}

export function getArchiveWhenMonths(year: number, bounds: ArchiveWhenBounds = {}): number[] {
  let startMonth = 1;
  let endMonth = 12;

  const minMonth = parseBoundMonth(bounds.min, year);
  if (minMonth !== null) {
    startMonth = minMonth;
  }

  const maxMonth = parseBoundMonth(bounds.max, year);
  if (maxMonth !== null) {
    endMonth = maxMonth;
  }

  if (startMonth > endMonth) {
    return [];
  }

  const months: number[] = [];
  for (let month = startMonth; month <= endMonth; month += 1) {
    months.push(month);
  }
  return months;
}

export function getArchiveWhenDays(year: number, month: number, bounds: ArchiveWhenBounds = {}): number[] {
  let startDay = 1;
  let endDay = daysInMonth(year, month);

  const minDay = parseBoundDay(bounds.min, year, month);
  if (minDay !== null) {
    startDay = minDay;
  }

  const maxDay = parseBoundDay(bounds.max, year, month);
  if (maxDay !== null) {
    endDay = maxDay;
  }

  if (startDay > endDay) {
    return [];
  }

  const days: number[] = [];
  for (let day = startDay; day <= endDay; day += 1) {
    days.push(day);
  }
  return days;
}
