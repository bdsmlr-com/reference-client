/**
 * Unified date formatting service for consistent date display across the app.
 *
 * Modes:
 * - `date`: YYYY-MM-DD format
 * - `datetime`: YYYY-MM-DD HH:mm format
 * - `friendly`: Relative time (e.g., "2 hours ago", "3 months ago")
 *
 * The `friendly` and `date` modes show full `datetime` on tooltip hover.
 */

import { format, formatDistanceToNow, differenceInDays } from 'date-fns';

export type DateFormatMode = 'date' | 'datetime' | 'friendly';

/**
 * Format a Unix timestamp to a date string.
 *
 * @param unix - Unix timestamp in seconds
 * @param mode - Format mode: 'date', 'datetime', or 'friendly'
 * @returns Formatted date string
 */
export function formatDate(unix: number | undefined, mode: DateFormatMode = 'date'): string {
  if (!unix) return '';

  const date = new Date(unix * 1000);

  switch (mode) {
    case 'date':
      return format(date, 'yyyy-MM-dd');

    case 'datetime':
      return format(date, 'yyyy-MM-dd HH:mm');

    case 'friendly':
      return formatFriendly(date);

    default:
      return format(date, 'yyyy-MM-dd');
  }
}

/**
 * Get the full datetime string for tooltip display.
 *
 * @param unix - Unix timestamp in seconds
 * @returns Full datetime string for tooltip
 */
export function getTooltipDate(unix: number | undefined): string {
  if (!unix) return '';
  const date = new Date(unix * 1000);
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Format a date as a friendly relative time string.
 * Uses different granularity based on how recent the date is:
 * - Within 1 day: "X hours ago", "X minutes ago"
 * - Within 30 days: "X days ago"
 * - Within 1 year: "X months ago"
 * - Older: "about X years ago"
 *
 * @param date - Date object to format
 * @returns Friendly relative time string
 */
function formatFriendly(date: Date): string {
  const now = new Date();
  const daysDiff = differenceInDays(now, date);

  if (daysDiff < 1) {
    // Within last day - show hours/minutes
    return formatDistanceToNow(date, { addSuffix: true });
  } else if (daysDiff < 30) {
    // Within last month - show days
    return formatDistanceToNow(date, { addSuffix: true });
  } else if (daysDiff < 365) {
    // Within last year - show months
    return formatDistanceToNow(date, { addSuffix: true });
  } else {
    // Older - show years with "about"
    return formatDistanceToNow(date, { addSuffix: true });
  }
}

/**
 * Format a Unix timestamp with both display text and tooltip.
 * Returns an object suitable for creating an HTML element with title attribute.
 *
 * @param unix - Unix timestamp in seconds
 * @param mode - Format mode: 'date', 'datetime', or 'friendly'
 * @returns Object with `text` (displayed) and `tooltip` (title attribute)
 */
export function formatDateWithTooltip(
  unix: number | undefined,
  mode: DateFormatMode = 'friendly'
): { text: string; tooltip: string } {
  if (!unix) return { text: '', tooltip: '' };

  return {
    text: formatDate(unix, mode),
    tooltip: getTooltipDate(unix),
  };
}

/**
 * Format a date for compact display in cards.
 * Shows short month format (e.g., "Jan 13, 2024").
 *
 * @param unix - Unix timestamp in seconds
 * @returns Short formatted date
 */
export function formatDateShort(unix: number | undefined): string {
  if (!unix) return '';
  const date = new Date(unix * 1000);
  return format(date, 'MMM d, yyyy');
}
