/**
 * Error Telemetry Service
 *
 * Provides error logging and tracking for visibility into failure patterns.
 * Implements ERR-005 from the backlog.
 *
 * Features:
 * - Logs API errors with context (endpoint, error code, timestamp)
 * - Stores recent errors in localStorage for debugging
 * - Provides error statistics and patterns
 * - Lightweight with configurable retention
 */

import { ApiErrorCode, isApiError } from './api-error.js';

// Storage key
const TELEMETRY_KEY = 'bdsmlr_error_telemetry';

// Configuration
const MAX_STORED_ERRORS = 100; // Maximum errors to retain
const ERROR_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Telemetry entry for a logged error
 */
export interface TelemetryEntry {
  id: string;
  timestamp: number;
  code: ApiErrorCode | string;
  message: string;
  endpoint?: string;
  statusCode?: number;
  isRetryable: boolean;
  userAgent: string;
  url: string;
  // Additional context
  context?: Record<string, unknown>;
}

/**
 * Error statistics by code
 */
export interface ErrorStats {
  totalErrors: number;
  errorsByCode: Record<string, number>;
  errorsByEndpoint: Record<string, number>;
  recentErrors: TelemetryEntry[];
  oldestError?: number;
  newestError?: number;
}

/**
 * Get stored telemetry entries
 */
function getTelemetryStore(): TelemetryEntry[] {
  try {
    const stored = localStorage.getItem(TELEMETRY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save telemetry entries to storage
 */
function setTelemetryStore(entries: TelemetryEntry[]): void {
  try {
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(entries));
  } catch (e) {
    // Storage might be full - silently fail for telemetry
    console.warn('Failed to save error telemetry:', e);
  }
}

/**
 * Generate a unique ID for an error entry
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Log an error to telemetry.
 *
 * @param error - The error to log (ApiError or generic Error)
 * @param context - Additional context to include
 */
export function logError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const entry = createTelemetryEntry(error, context);

  // Console log for immediate visibility during development
  console.error(
    `[Telemetry] ${entry.code}: ${entry.message}`,
    entry.endpoint ? `(${entry.endpoint})` : '',
    context || ''
  );

  // Store in localStorage
  const entries = getTelemetryStore();

  // Add new entry
  entries.push(entry);

  // Prune old entries
  const now = Date.now();
  const pruned = entries
    .filter((e) => now - e.timestamp < ERROR_RETENTION_MS)
    .slice(-MAX_STORED_ERRORS);

  setTelemetryStore(pruned);
}

/**
 * Create a telemetry entry from an error
 */
function createTelemetryEntry(
  error: unknown,
  context?: Record<string, unknown>
): TelemetryEntry {
  const timestamp = Date.now();
  const id = generateId();

  if (isApiError(error)) {
    return {
      id,
      timestamp,
      code: error.code,
      message: error.message,
      endpoint: error.endpoint,
      statusCode: error.statusCode,
      isRetryable: error.isRetryable,
      userAgent: navigator.userAgent,
      url: window.location.href,
      context,
    };
  }

  if (error instanceof Error) {
    return {
      id,
      timestamp,
      code: 'UNKNOWN',
      message: error.message,
      isRetryable: false,
      userAgent: navigator.userAgent,
      url: window.location.href,
      context: {
        ...context,
        errorName: error.name,
        stack: error.stack?.substring(0, 500), // Truncate stack trace
      },
    };
  }

  return {
    id,
    timestamp,
    code: 'UNKNOWN',
    message: String(error),
    isRetryable: false,
    userAgent: navigator.userAgent,
    url: window.location.href,
    context,
  };
}

/**
 * Get error statistics for analysis
 */
export function getErrorStats(): ErrorStats {
  const entries = getTelemetryStore();

  const errorsByCode: Record<string, number> = {};
  const errorsByEndpoint: Record<string, number> = {};

  for (const entry of entries) {
    // Count by code
    errorsByCode[entry.code] = (errorsByCode[entry.code] || 0) + 1;

    // Count by endpoint
    if (entry.endpoint) {
      errorsByEndpoint[entry.endpoint] =
        (errorsByEndpoint[entry.endpoint] || 0) + 1;
    }
  }

  // Get timestamps for range
  const timestamps = entries.map((e) => e.timestamp);

  return {
    totalErrors: entries.length,
    errorsByCode,
    errorsByEndpoint,
    recentErrors: entries.slice(-10).reverse(), // Last 10, newest first
    oldestError: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
    newestError: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
  };
}

/**
 * Get recent errors (for debugging UI)
 *
 * @param limit - Maximum number of errors to return
 */
export function getRecentErrors(limit = 20): TelemetryEntry[] {
  const entries = getTelemetryStore();
  return entries.slice(-limit).reverse(); // Newest first
}

/**
 * Get errors by code (for pattern analysis)
 *
 * @param code - The error code to filter by
 */
export function getErrorsByCode(code: ApiErrorCode | string): TelemetryEntry[] {
  const entries = getTelemetryStore();
  return entries.filter((e) => e.code === code).reverse();
}

/**
 * Get errors by endpoint (for API health analysis)
 *
 * @param endpoint - The endpoint to filter by (partial match)
 */
export function getErrorsByEndpoint(endpoint: string): TelemetryEntry[] {
  const entries = getTelemetryStore();
  return entries
    .filter((e) => e.endpoint?.includes(endpoint))
    .reverse();
}

/**
 * Clear all stored telemetry
 */
export function clearTelemetry(): void {
  localStorage.removeItem(TELEMETRY_KEY);
}

/**
 * Export telemetry data for debugging/reporting
 */
export function exportTelemetry(): {
  exportedAt: string;
  stats: ErrorStats;
  entries: TelemetryEntry[];
} {
  return {
    exportedAt: new Date().toISOString(),
    stats: getErrorStats(),
    entries: getTelemetryStore(),
  };
}

/**
 * Check if there are recent errors of a specific type.
 * Useful for detecting recurring issues.
 *
 * @param code - Error code to check
 * @param withinMs - Time window in milliseconds (default 5 minutes)
 * @param minCount - Minimum count to trigger (default 3)
 */
export function hasRecentErrorPattern(
  code: ApiErrorCode | string,
  withinMs = 5 * 60 * 1000,
  minCount = 3
): boolean {
  const entries = getTelemetryStore();
  const now = Date.now();
  const cutoff = now - withinMs;

  const recentCount = entries.filter(
    (e) => e.code === code && e.timestamp >= cutoff
  ).length;

  return recentCount >= minCount;
}

/**
 * Get a summary of error patterns for display
 */
export function getErrorPatternSummary(): {
  hasNetworkIssues: boolean;
  hasServerIssues: boolean;
  hasTimeoutIssues: boolean;
  hasAuthIssues: boolean;
  mostCommonError?: string;
  affectedEndpoints: string[];
} {
  const stats = getErrorStats();

  // Find most common error code
  let mostCommonError: string | undefined;
  let maxCount = 0;
  for (const [code, count] of Object.entries(stats.errorsByCode)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonError = code;
    }
  }

  return {
    hasNetworkIssues: hasRecentErrorPattern(ApiErrorCode.NETWORK),
    hasServerIssues: hasRecentErrorPattern(ApiErrorCode.SERVER_ERROR),
    hasTimeoutIssues: hasRecentErrorPattern(ApiErrorCode.TIMEOUT),
    hasAuthIssues:
      hasRecentErrorPattern(ApiErrorCode.AUTH_REQUIRED) ||
      hasRecentErrorPattern(ApiErrorCode.AUTH_EXPIRED),
    mostCommonError,
    affectedEndpoints: Object.keys(stats.errorsByEndpoint),
  };
}
