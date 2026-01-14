import {
  getValidToken,
  setToken,
  clearToken,
  tokenNeedsRefresh,
  getCachedBlogId,
  setCachedBlogId,
  getCachedBlogName,
  setCachedBlogName,
  generateSearchCacheKey,
  getCachedSearchResult,
  setCachedSearchResult,
  generateResponseCacheKey,
  getCachedResponse,
  setCachedResponse,
  generateFollowGraphCacheKey,
  getCachedFollowGraph,
  setCachedFollowGraph,
  invalidateFollowGraphCache,
  clearFollowGraphCache,
  getFollowGraphCacheStats,
  generateRecentActivityCacheKey,
  getCachedRecentActivity,
  setCachedRecentActivity,
  invalidateRecentActivityCache,
  clearRecentActivityCache,
  getRecentActivityCacheStats,
  generateBlogSearchCacheKey,
  getCachedBlogSearch,
  setCachedBlogSearch,
  // SWR cache functions (CACHE-004)
  generateSWRCacheKey,
  getSWRCachedData,
  setSWRCachedData,
  markSWRRevalidating,
  clearSWRRevalidating,
  // HTTP ETag/Last-Modified cache functions (CACHE-005)
  generateHttpCacheKey,
  getHttpCachedResponse,
  setHttpCachedResponse,
  refreshHttpCacheTimestamp,
} from './storage.js';
import {
  getCachedPosts,
  setCachedPosts,
  isCacheExhausted,
} from './post-cache.js';
import {
  ApiError,
  ApiErrorCode,
  apiErrorFromStatus,
} from './api-error.js';
import { isOffline } from './connection.js';
import { logError } from './error-telemetry.js';
import type {
  SearchPostsByTagRequest,
  SearchPostsByTagResponse,
  ListBlogPostsRequest,
  ListBlogPostsResponse,
  ListBlogActivityRequest,
  ListBlogActivityResponse,
  ResolveIdentifierRequest,
  ResolveIdentifierResponse,
  ListPostLikesResponse,
  ListPostCommentsResponse,
  ListPostReblogsResponse,
  LoginResponse,
  SearchBlogsRequest,
  SearchBlogsResponse,
  FollowGraphDirection,
  BlogFollowGraphRequest,
  BlogFollowGraphResponse,
  ListBlogsRecentActivityRequest,
  ListBlogsRecentActivityResponse,
  GetBlogRequest,
  GetBlogResponse,
} from '../types/api.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const AUTH_EMAIL = import.meta.env.VITE_AUTH_EMAIL || '';
const AUTH_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD || '';

// Default timeout for endpoints not in the timeout map
const DEFAULT_REQUEST_TIMEOUT = 15000;

// Adaptive timeout configuration (RES-005)
const ADAPTIVE_TIMEOUT_SAMPLE_SIZE = 20;
const ADAPTIVE_TIMEOUT_HEADROOM_MULTIPLIER = 1.75;
const ADAPTIVE_TIMEOUT_FLOOR_RATIO = 0.75; // Never drop below 75% of configured timeout
const ADAPTIVE_TIMEOUT_CEILING_RATIO = 4; // Cap growth to 4x configured timeout
const ADAPTIVE_TIMEOUT_MIN_MS = 5000;
const ADAPTIVE_TIMEOUT_MAX_MS = 60000;
const TIMEOUT_SAMPLE_BOOST = 1.1; // Push timeouts slightly above the configured value

/**
 * Per-endpoint timeout configuration (RES-004).
 *
 * Different endpoints have different expected response times based on:
 * - Result set size: Large lists (follow graph, posts) need more time
 * - Server processing: Complex queries (search, merge) need more time
 * - Data freshness: Real-time data vs cached data
 *
 * Timeouts are in milliseconds.
 */
const ENDPOINT_TIMEOUTS: Record<string, number> = {
  // Fast endpoints (5s) - simple lookups, single record
  '/v2/resolve-identifier': 5000,
  '/v2/get-blog': 5000,
  '/v2/sign-url': 5000,

  // Medium endpoints (15s) - standard list queries
  '/v2/list-blog-posts': 15000,
  '/v2/list-post-likes': 15000,
  '/v2/list-post-comments': 15000,
  '/v2/list-post-reblogs': 15000,
  '/v2/list-blog-followers': 15000,
  '/v2/list-blog-following': 15000,

  // Slow endpoints (30s) - complex queries with large result sets
  '/v2/search-posts-by-tag': 30000,
  '/v2/search-blogs': 30000,
  '/v2/blog-follow-graph': 30000,

  // Extra slow endpoints (45s) - server-side merge operations
  '/v2/list-blogs-recent-activity': 45000,
};

type EndpointTimingStats = {
  samples: number[];
};

const endpointTimingStats = new Map<string, EndpointTimingStats>();

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function recordEndpointTiming(endpoint: string, durationMs: number): void {
  const stats = endpointTimingStats.get(endpoint) ?? { samples: [] };
  stats.samples.push(durationMs);
  if (stats.samples.length > ADAPTIVE_TIMEOUT_SAMPLE_SIZE) {
    stats.samples.shift();
  }
  endpointTimingStats.set(endpoint, stats);
}

function getAdaptiveTimeout(endpoint: string, configuredTimeout: number): number {
  const stats = endpointTimingStats.get(endpoint);
  if (!stats?.samples.length) {
    return configuredTimeout;
  }

  const samples = stats.samples;
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const sorted = [...samples].sort((a, b) => a - b);
  const percentileIndex = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
  const p95 = sorted[percentileIndex];
  const headroomTarget = Math.max(average, p95) * ADAPTIVE_TIMEOUT_HEADROOM_MULTIPLIER;

  const floor = Math.max(ADAPTIVE_TIMEOUT_MIN_MS, configuredTimeout * ADAPTIVE_TIMEOUT_FLOOR_RATIO);
  const ceiling = Math.min(ADAPTIVE_TIMEOUT_MAX_MS, configuredTimeout * ADAPTIVE_TIMEOUT_CEILING_RATIO);

  return Math.min(Math.max(headroomTarget, floor), ceiling);
}

/**
 * Get timeout for a specific endpoint.
 * Falls back to DEFAULT_REQUEST_TIMEOUT if endpoint not in map.
 */
function getEndpointTimeout(endpoint: string): number {
  const configuredTimeout = ENDPOINT_TIMEOUTS[endpoint] ?? DEFAULT_REQUEST_TIMEOUT;
  return getAdaptiveTimeout(endpoint, configuredTimeout);
}

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 10000;
const BACKOFF_MULTIPLIER = 2;

// Rate limit specific configuration (RES-003)
const RATE_LIMIT_MAX_RETRIES = 3;
const RATE_LIMIT_DEFAULT_BACKOFF_MS = 5000; // Default if no Retry-After header
const RATE_LIMIT_MAX_BACKOFF_MS = 60000; // Max 60 seconds

/**
 * Calculate exponential backoff delay with jitter.
 * @param attempt - The current retry attempt (0-indexed)
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempt: number): number {
  const baseDelay = INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt);
  const cappedDelay = Math.min(baseDelay, MAX_BACKOFF_MS);
  // Add jitter (±25%) to prevent thundering herd
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(cappedDelay + jitter);
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse Retry-After header value (RES-003).
 * Supports both numeric (seconds) and HTTP-date formats.
 * @param retryAfter - The Retry-After header value
 * @returns Delay in milliseconds, or null if invalid/not parseable
 */
function parseRetryAfterHeader(retryAfter: string | null): number | null {
  if (!retryAfter) {
    return null;
  }

  // Try parsing as seconds (most common)
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  // Try parsing as HTTP-date
  const date = Date.parse(retryAfter);
  if (!isNaN(date)) {
    const delay = date - Date.now();
    return delay > 0 ? delay : 0;
  }

  return null;
}

/**
 * Calculate rate limit backoff delay with jitter (RES-003).
 * Respects Retry-After header if present, otherwise uses exponential backoff.
 * @param attempt - The current retry attempt (0-indexed)
 * @param retryAfterMs - Parsed Retry-After header value in ms, or null
 * @returns Delay in milliseconds
 */
function calculateRateLimitDelay(attempt: number, retryAfterMs: number | null): number {
  let baseDelay: number;

  if (retryAfterMs !== null) {
    // Respect the server's Retry-After, capped at max
    baseDelay = Math.min(retryAfterMs, RATE_LIMIT_MAX_BACKOFF_MS);
  } else {
    // Exponential backoff if no Retry-After header
    baseDelay = RATE_LIMIT_DEFAULT_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt);
    baseDelay = Math.min(baseDelay, RATE_LIMIT_MAX_BACKOFF_MS);
  }

  // Add jitter (±25%) to prevent thundering herd
  const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(baseDelay + jitter);
}

let currentToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

async function login(): Promise<string> {
  const resp = await fetch(`${API_BASE}/v2/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD }),
  });

  const data: LoginResponse = await resp.json();

  if (data.error || !data.access_token) {
    throw new Error(data.error || 'Login failed');
  }

  setToken(data.access_token, data.expires_in || 3600);
  currentToken = data.access_token;
  return data.access_token;
}

/**
 * Refresh token if needed (proactive refresh before expiry)
 */
async function refreshTokenIfNeeded(): Promise<void> {
  if (!tokenNeedsRefresh()) {
    return;
  }

  // Dedupe concurrent refresh requests
  if (refreshPromise) {
    await refreshPromise;
    return;
  }

  try {
    refreshPromise = login();
    await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function getToken(): Promise<string> {
  // Check if we need proactive refresh
  await refreshTokenIfNeeded();

  if (currentToken) {
    return currentToken;
  }

  const stored = getValidToken();
  if (stored) {
    currentToken = stored;
    return stored;
  }

  return login();
}

async function apiRequest<T>(
  endpoint: string,
  body: unknown,
  retryOnAuth = true,
  retryAttempt = 0
): Promise<T> {
  // Normalize follow graph direction payloads to numeric enum (0/1/2) to satisfy backend validation
  if (
    typeof body === 'object' &&
    body !== null &&
    'direction' in (body as Record<string, unknown>) &&
    (endpoint.includes('blog-follow-graph') || endpoint.includes('list-blog-follows'))
  ) {
    const normalizedDirection = normalizeFollowDirection(
      (body as { direction?: FollowGraphDirection }).direction
    );
    (body as { direction?: number }).direction = normalizedDirection;
  }

  // Check offline state before making request
  if (isOffline()) {
    throw new ApiError(
      ApiErrorCode.OFFLINE,
      'You appear to be offline. Please check your connection.',
      { endpoint }
    );
  }

  const token = await getToken();
  const requestStartedAt = now();

  const controller = new AbortController();
  const endpointTimeout = getEndpointTimeout(endpoint);
  const timeout = setTimeout(() => controller.abort(), endpointTimeout);

  let statusCode: number | undefined;
  let recordedTiming = false;

  // HTTP conditional request support (CACHE-005)
  // Check if we have cached response with ETag/Last-Modified headers
  const httpCacheKey = generateHttpCacheKey(endpoint, body);
  const httpCached = getHttpCachedResponse<T>(httpCacheKey);

  // Build request headers, including conditional headers if we have cached data
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'ngrok-skip-browser-warning': 'true',
  };

  if (httpCached) {
    if (httpCached.etag) {
      headers['If-None-Match'] = httpCached.etag;
    }
    if (httpCached.lastModified) {
      headers['If-Modified-Since'] = httpCached.lastModified;
    }
  }

  try {
    const resp = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const durationMs = now() - requestStartedAt;
    recordEndpointTiming(endpoint, durationMs);
    recordedTiming = true;
    clearTimeout(timeout);
    statusCode = resp.status;

    // Handle 304 Not Modified - return cached data (CACHE-005)
    if (resp.status === 304 && httpCached) {
      console.log(`HTTP 304 Not Modified for ${endpoint} - using cached response`);
      refreshHttpCacheTimestamp(httpCacheKey);
      return httpCached.data;
    }

    if (!resp.ok) {
      // Handle auth errors (401) - refresh token and retry once
      if (resp.status === 401 && retryOnAuth) {
        clearToken();
        currentToken = null;
        await login();
        return apiRequest<T>(endpoint, body, false, 0);
      }

      // Handle rate limit errors (429) with longer backoff (RES-003)
      if (resp.status === 429 && retryAttempt < RATE_LIMIT_MAX_RETRIES) {
        const retryAfterHeader = resp.headers.get('Retry-After');
        const retryAfterMs = parseRetryAfterHeader(retryAfterHeader);
        const delay = calculateRateLimitDelay(retryAttempt, retryAfterMs);
        console.log(
          `Rate limited (HTTP 429), retrying in ${delay}ms (attempt ${retryAttempt + 1}/${RATE_LIMIT_MAX_RETRIES})` +
            (retryAfterHeader ? ` [Retry-After: ${retryAfterHeader}]` : '')
        );
        await sleep(delay);
        return apiRequest<T>(endpoint, body, retryOnAuth, retryAttempt + 1);
      }

      // Create typed ApiError for non-OK responses
      const apiError = apiErrorFromStatus(resp.status, `HTTP ${resp.status}`, endpoint);

      // Handle transient errors (5xx) - retry with exponential backoff
      // Skip rate limit errors here since they're handled above
      if (apiError.isRetryable && apiError.code !== ApiErrorCode.RATE_LIMITED && retryAttempt < MAX_RETRIES) {
        const delay = calculateBackoffDelay(retryAttempt);
        console.log(
          `Transient error (HTTP ${statusCode}), retrying in ${delay}ms (attempt ${retryAttempt + 1}/${MAX_RETRIES})`
        );
        await sleep(delay);
        return apiRequest<T>(endpoint, body, retryOnAuth, retryAttempt + 1);
      }

      // Log error after all retries exhausted
      logError(apiError, { retryAttempt, maxRetries: MAX_RETRIES });
      throw apiError;
    }

    const data = await resp.json();

    if (data.error) {
      if (data.error.includes('token') && retryOnAuth) {
        clearToken();
        currentToken = null;
        await login();
        return apiRequest<T>(endpoint, body, false, 0);
      }
      // Throw typed API error for API-level errors
      const serverError = new ApiError(ApiErrorCode.SERVER_ERROR, data.error, { endpoint });
      logError(serverError, { responseError: data.error });
      throw serverError;
    }

    // Cache response with ETag/Last-Modified headers for conditional requests (CACHE-005)
    const etag = resp.headers.get('ETag');
    const lastModified = resp.headers.get('Last-Modified');
    if (etag || lastModified) {
      setHttpCachedResponse(httpCacheKey, data, etag, lastModified, endpoint);
    }

    return data as T;
  } catch (e) {
    clearTimeout(timeout);
    const elapsedMs = now() - requestStartedAt;

    // If already an ApiError, just re-throw or retry
    if (e instanceof ApiError) {
      if (!recordedTiming) {
        recordEndpointTiming(endpoint, elapsedMs);
        recordedTiming = true;
      }
      if (e.isRetryable && retryAttempt < MAX_RETRIES) {
        const delay = calculateBackoffDelay(retryAttempt);
        console.log(
          `${e.code} error, retrying in ${delay}ms (attempt ${retryAttempt + 1}/${MAX_RETRIES})`
        );
        await sleep(delay);
        return apiRequest<T>(endpoint, body, retryOnAuth, retryAttempt + 1);
      }
      // Log error after all retries exhausted
      logError(e, { retryAttempt, maxRetries: MAX_RETRIES });
      throw e;
    }

    const error = e as Error;

    // Convert AbortError to typed timeout ApiError
    if (error.name === 'AbortError') {
      if (!recordedTiming) {
        recordEndpointTiming(endpoint, Math.max(endpointTimeout * TIMEOUT_SAMPLE_BOOST, elapsedMs));
        recordedTiming = true;
      }
      const timeoutError = new ApiError(ApiErrorCode.TIMEOUT, 'Request timeout', {
        endpoint,
        cause: error,
      });
      // Retry timeout errors with exponential backoff
      if (timeoutError.isRetryable && retryAttempt < MAX_RETRIES) {
        const delay = calculateBackoffDelay(retryAttempt);
        console.log(
          `Request timeout, retrying in ${delay}ms (attempt ${retryAttempt + 1}/${MAX_RETRIES})`
        );
        await sleep(delay);
        return apiRequest<T>(endpoint, body, retryOnAuth, retryAttempt + 1);
      }
      // Log error after all retries exhausted
      logError(timeoutError, { retryAttempt, maxRetries: MAX_RETRIES });
      throw timeoutError;
    }

    // Convert network errors to typed ApiError
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      if (!recordedTiming) {
        recordEndpointTiming(endpoint, elapsedMs);
        recordedTiming = true;
      }
      const networkError = new ApiError(ApiErrorCode.NETWORK, 'Network error', {
        endpoint,
        cause: error,
      });
      if (networkError.isRetryable && retryAttempt < MAX_RETRIES) {
        const delay = calculateBackoffDelay(retryAttempt);
        console.log(
          `Network error, retrying in ${delay}ms (attempt ${retryAttempt + 1}/${MAX_RETRIES})`
        );
        await sleep(delay);
        return apiRequest<T>(endpoint, body, retryOnAuth, retryAttempt + 1);
      }
      // Log error after all retries exhausted
      logError(networkError, { retryAttempt, maxRetries: MAX_RETRIES });
      throw networkError;
    }

    // For any other errors, wrap in UNKNOWN ApiError
    const unknownError = new ApiError(ApiErrorCode.UNKNOWN, error.message || 'Unknown error', {
      endpoint,
      cause: error,
    });
    logError(unknownError, { errorType: 'unknown', originalName: error.name });
    throw unknownError;
  }
}

/**
 * Response metadata indicating if data came from stale cache
 */
export interface StaleDataResult<T> {
  data: T;
  isStale: boolean;
  cachedAt?: number;
}

/**
 * Make an API request with stale data fallback (CONN-002).
 *
 * This wrapper:
 * 1. Caches successful responses
 * 2. On error, attempts to return stale cached data instead of throwing
 * 3. Only falls back to stale data for transient errors (network, timeout, server errors)
 * 4. Re-throws the original error if no stale data is available
 *
 * @param endpoint - API endpoint path
 * @param body - Request body
 * @param enableStaleFallback - Whether to enable stale fallback (default: true)
 * @returns Response data with staleness indicator
 */
async function apiRequestWithStaleFallback<T>(
  endpoint: string,
  body: unknown,
  enableStaleFallback = true
): Promise<StaleDataResult<T>> {
  const cacheKey = generateResponseCacheKey(endpoint, body);

  try {
    // Attempt the API request
    const data = await apiRequest<T>(endpoint, body);

    // Cache successful response
    setCachedResponse(cacheKey, data, endpoint);

    return { data, isStale: false };
  } catch (error) {
    // Only fall back to stale data for transient errors
    if (!enableStaleFallback) {
      throw error;
    }

    const isTransientError =
      error instanceof ApiError &&
      (error.isRetryable || error.code === ApiErrorCode.OFFLINE);

    if (isTransientError) {
      // Check for stale cached data
      const staleData = getCachedResponse<T>(cacheKey);
      if (staleData) {
        console.log(
          `Serving stale data for ${endpoint} (cached ${Math.round((Date.now() - staleData.cachedAt) / 1000)}s ago)`
        );
        return {
          data: staleData.data,
          isStale: true,
          cachedAt: staleData.cachedAt,
        };
      }
    }

    // No stale data available, re-throw original error
    throw error;
  }
}

// ============================================
// Stale-While-Revalidate API Functions (CACHE-004)
// ============================================
// These functions implement the SWR pattern:
// 1. Return cached data immediately (even if stale)
// 2. Trigger background revalidation if data is stale
// 3. Next request gets fresh data

/**
 * Result from SWR API request.
 * - data: The response data (may be from cache or fresh)
 * - fromCache: True if data was served from cache
 * - isFresh: True if cache data is within fresh TTL
 * - isStale: True if cache data is beyond fresh TTL
 * - revalidating: True if background revalidation was triggered
 */
export interface SWRResult<T> {
  data: T;
  fromCache: boolean;
  isFresh: boolean;
  isStale: boolean;
  revalidating: boolean;
}

// Track in-flight revalidations to prevent duplicate background fetches
const inFlightRevalidations = new Map<string, Promise<unknown>>();

/**
 * Make an API request using stale-while-revalidate strategy (CACHE-004).
 *
 * This wrapper:
 * 1. Returns cached data immediately if available (even if stale)
 * 2. If data is stale, triggers a background revalidation
 * 3. If no cache, waits for fresh data from API
 * 4. On API error with no cache, throws the error
 *
 * @param endpoint - API endpoint path
 * @param body - Request body
 * @param options - SWR options
 * @returns Response data with cache/freshness metadata
 */
async function apiRequestWithSWR<T>(
  endpoint: string,
  body: unknown,
  options?: {
    freshTTL?: number;  // How long data is considered fresh (default: 30s)
    staleTTL?: number;  // How long stale data can be served (default: 5min)
    maxAge?: number;    // Max age before data must be refetched (default: 1hr)
  }
): Promise<SWRResult<T>> {
  const cacheKey = generateSWRCacheKey(endpoint, body);

  // Check cache first
  const cached = getSWRCachedData<T>(cacheKey, options);

  if (cached) {
    // We have cached data - return it immediately
    const result: SWRResult<T> = {
      data: cached.data,
      fromCache: true,
      isFresh: cached.isFresh,
      isStale: cached.isStale,
      revalidating: false,
    };

    // If data needs revalidation, trigger background fetch
    if (cached.needsRevalidation && !inFlightRevalidations.has(cacheKey)) {
      result.revalidating = true;
      const promiseId = `${Date.now()}-${Math.random()}`;
      markSWRRevalidating(cacheKey, promiseId);

      // Background revalidation (fire and forget)
      const revalidationPromise = apiRequest<T>(endpoint, body)
        .then((freshData) => {
          setSWRCachedData(cacheKey, freshData, endpoint);
          console.log(`SWR revalidation complete for ${endpoint}`);
        })
        .catch((error) => {
          console.warn(`SWR revalidation failed for ${endpoint}:`, error);
          // Keep serving stale data - it's better than nothing
        })
        .finally(() => {
          clearSWRRevalidating(cacheKey, promiseId);
          inFlightRevalidations.delete(cacheKey);
        });

      inFlightRevalidations.set(cacheKey, revalidationPromise);
    }

    return result;
  }

  // No cached data - must fetch fresh
  const freshData = await apiRequest<T>(endpoint, body);

  // Cache the fresh response
  setSWRCachedData(cacheKey, freshData, endpoint);

  return {
    data: freshData,
    fromCache: false,
    isFresh: true,
    isStale: false,
    revalidating: false,
  };
}

/**
 * List blog posts with stale-while-revalidate caching (CACHE-004).
 *
 * Returns cached data immediately, revalidates in background if stale.
 * Ideal for pages where showing slightly stale data is acceptable
 * and responsiveness is prioritized over freshness.
 */
async function listBlogPostsSWR(
  req: ListBlogPostsRequest,
  options?: {
    freshTTL?: number;
    staleTTL?: number;
    maxAge?: number;
  }
): Promise<SWRResult<ListBlogPostsResponse>> {
  return apiRequestWithSWR<ListBlogPostsResponse>(
    '/v2/list-blog-posts',
    req,
    options
  );
}

/**
 * Search posts by tag with stale-while-revalidate caching (CACHE-004).
 *
 * Returns cached data immediately, revalidates in background if stale.
 */
async function searchPostsByTagSWR(
  req: SearchPostsByTagRequest,
  options?: {
    freshTTL?: number;
    staleTTL?: number;
    maxAge?: number;
  }
): Promise<SWRResult<SearchPostsByTagResponse>> {
  return apiRequestWithSWR<SearchPostsByTagResponse>(
    '/v2/search-posts-by-tag',
    req,
    options
  );
}

/**
 * Search blogs with stale-while-revalidate caching (CACHE-004).
 *
 * Returns cached data immediately, revalidates in background if stale.
 */
async function searchBlogsSWR(
  req: SearchBlogsRequest,
  options?: {
    freshTTL?: number;
    staleTTL?: number;
    maxAge?: number;
  }
): Promise<SWRResult<SearchBlogsResponse>> {
  return apiRequestWithSWR<SearchBlogsResponse>(
    '/v2/search-blogs',
    req,
    options
  );
}

/**
 * Get blog follow graph with stale-while-revalidate caching (CACHE-004).
 *
 * Returns cached data immediately, revalidates in background if stale.
 */
async function blogFollowGraphSWR(
  req: BlogFollowGraphRequest,
  options?: {
    freshTTL?: number;
    staleTTL?: number;
    maxAge?: number;
  }
): Promise<SWRResult<BlogFollowGraphResponse>> {
  const payload: BlogFollowGraphRequest = {
    ...req,
    direction: normalizeFollowDirection(req.direction),
  };
  return apiRequestWithSWR<BlogFollowGraphResponse>(
    '/v2/blog-follow-graph',
    payload,
    options
  );
}

/**
 * List blogs recent activity with stale-while-revalidate caching (CACHE-004).
 *
 * Returns cached data immediately, revalidates in background if stale.
 */
async function listBlogsRecentActivitySWR(
  req: ListBlogsRecentActivityRequest,
  options?: {
    freshTTL?: number;
    staleTTL?: number;
    maxAge?: number;
  }
): Promise<SWRResult<ListBlogsRecentActivityResponse>> {
  return apiRequestWithSWR<ListBlogsRecentActivityResponse>(
    '/v2/list-blogs-recent-activity',
    req,
    options
  );
}

/**
 * Get blog details with stale-while-revalidate caching (CACHE-004).
 *
 * Returns cached data immediately, revalidates in background if stale.
 */
async function getBlogSWR(
  req: GetBlogRequest,
  options?: {
    freshTTL?: number;
    staleTTL?: number;
    maxAge?: number;
  }
): Promise<SWRResult<GetBlogResponse>> {
  return apiRequestWithSWR<GetBlogResponse>(
    '/v2/get-blog',
    req,
    options
  );
}

// Re-export SWR cache utilities for manual cache management
export {
  invalidateSWRCache,
  clearSWRCache,
  getSWRCacheStats,
} from './storage.js';

async function searchPostsByTag(
  req: SearchPostsByTagRequest
): Promise<SearchPostsByTagResponse> {
  return apiRequest<SearchPostsByTagResponse>(
    '/v2/search-posts-by-tag',
    req
  );
}

/**
 * Cached version of searchPostsByTag.
 *
 * Returns cached search results if available and not expired.
 * Cache key is generated from the request parameters for exact match.
 *
 * @param req - The search request parameters
 * @param options - Cache options
 * @param options.skipCache - If true, bypass cache and fetch fresh data
 * @returns Response with search results and cache metadata
 */
async function searchPostsByTagCached(
  req: SearchPostsByTagRequest,
  options: { skipCache?: boolean } = {}
): Promise<SearchPostsByTagResponse & { fromCache: boolean }> {
  const { skipCache = false } = options;

  // Generate cache key from request parameters
  const cacheKey = `search:${generateSearchCacheKey(req as unknown as Record<string, unknown>)}`;

  // Check cache first (unless skipping or paginating)
  const hasPageToken = !!req.page?.page_token;
  if (!skipCache && !hasPageToken) {
    const cached = getCachedSearchResult<SearchPostsByTagResponse>(cacheKey);
    if (cached) {
      console.log(`Search cache hit for: ${req.tag_name}`);
      return { ...cached, fromCache: true };
    }
  }

  // Cache miss or pagination - fetch from API
  const response = await searchPostsByTag(req);

  // Cache the result (only for first page)
  if (!hasPageToken) {
    setCachedSearchResult(cacheKey, response);
    console.log(`Search cached: ${req.tag_name}`);
  }

  return { ...response, fromCache: false };
}

async function listBlogPosts(
  req: ListBlogPostsRequest
): Promise<ListBlogPostsResponse> {
  return apiRequest<ListBlogPostsResponse>(
    '/v2/list-blog-posts',
    req
  );
}

/**
 * Cached version of listBlogPosts.
 *
 * Returns cached posts if available and not expired.
 * Automatically handles pagination by tracking page tokens.
 *
 * @param req - The request parameters
 * @param options - Cache options
 * @param options.skipCache - If true, bypass cache and fetch fresh data
 * @param options.ttl - Cache TTL in milliseconds (default 5 minutes)
 * @returns Response with posts, page info, and cache metadata
 */
async function listBlogPostsCached(
  req: ListBlogPostsRequest,
  options: { skipCache?: boolean; ttl?: number } = {}
): Promise<ListBlogPostsResponse & { fromCache: boolean }> {
  const { skipCache = false, ttl } = options;

  // Check if requesting a specific page via token
  const hasPageToken = !!req.page?.page_token;

  // If not skipping cache and no specific page requested, check cache
  if (!skipCache && !hasPageToken) {
    const cachedEntry = getCachedPosts(req, ttl);
    if (cachedEntry) {
      return {
        posts: cachedEntry.posts,
        page: {
          nextPageToken: cachedEntry.nextPageToken,
        },
        fromCache: true,
      };
    }
  }

  // Check if cache is exhausted (no more pages)
  if (!skipCache && hasPageToken && isCacheExhausted(req)) {
    return {
      posts: [],
      page: {},
      fromCache: true,
    };
  }

  // Cache miss or skip cache - fetch from API
  const response = await listBlogPosts(req);

  // Cache the result
  // If we had a page token, we're appending to existing cache
  setCachedPosts(req, response, hasPageToken);

  return {
    ...response,
    fromCache: false,
  };
}

// Re-export cache utilities for manual cache management
export {
  invalidateBlogPostCache,
  clearPostCache,
  getPostCacheStats,
} from './post-cache.js';

async function listBlogFollowers(
  req: ListBlogActivityRequest
): Promise<ListBlogActivityResponse> {
  return apiRequest<ListBlogActivityResponse>(
    '/v2/list-blog-followers',
    req
  );
}

async function listBlogFollowing(
  req: ListBlogActivityRequest
): Promise<ListBlogActivityResponse> {
  return apiRequest<ListBlogActivityResponse>(
    '/v2/list-blog-following',
    req
  );
}

async function resolveIdentifier(
  req: ResolveIdentifierRequest
): Promise<ResolveIdentifierResponse> {
  return apiRequest<ResolveIdentifierResponse>(
    '/v2/resolve-identifier',
    req
  );
}

async function listPostLikes(
  postId: number
): Promise<ListPostLikesResponse> {
  return apiRequest<ListPostLikesResponse>(
    '/v2/list-post-likes',
    { post_id: postId }
  );
}

async function listPostComments(
  postId: number
): Promise<ListPostCommentsResponse> {
  return apiRequest<ListPostCommentsResponse>(
    '/v2/list-post-comments',
    { post_id: postId }
  );
}

async function listPostReblogs(
  postId: number
): Promise<ListPostReblogsResponse> {
  return apiRequest<ListPostReblogsResponse>(
    '/v2/list-post-reblogs',
    { post_id: postId }
  );
}

async function signUrl(url: string): Promise<string> {
  const data = await apiRequest<{ url?: string }>(
    '/v2/sign-url',
    { url }
  );
  return data.url || url;
}

async function checkImageExists(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, { method: 'HEAD', mode: 'cors' });
    return resp.ok;
  } catch {
    // CORS might block HEAD, assume exists
    return true;
  }
}

// New API functions for blogs search and server-side merge

async function searchBlogs(
  req: SearchBlogsRequest
): Promise<SearchBlogsResponse> {
  return apiRequest<SearchBlogsResponse>(
    '/v2/search-blogs',
    req
  );
}

/**
 * Cached version of searchBlogs (CACHE-008).
 *
 * Returns cached blog search results if available and not expired.
 * Cache TTL is 10 minutes since blog metadata changes infrequently.
 *
 * @param req - The blog search request parameters
 * @param options - Cache options
 * @param options.skipCache - If true, bypass cache and fetch fresh data
 * @returns Response with search results and cache metadata
 */
async function searchBlogsCached(
  req: SearchBlogsRequest,
  options: { skipCache?: boolean } = {}
): Promise<SearchBlogsResponse & { fromCache: boolean }> {
  const { skipCache = false } = options;

  // Extract page_token from nested page object
  const pageToken = req.page?.page_token;

  // Generate cache key from request parameters
  // Use defaults for sort_field (2=FOLLOWERS_COUNT) and order (1=DESC) if not specified
  const cacheKey = generateBlogSearchCacheKey(
    req.query,
    req.sort_field ?? 2,
    req.order ?? 1,
    pageToken
  );

  // Check cache first (unless skipping)
  if (!skipCache) {
    const cached = getCachedBlogSearch<SearchBlogsResponse>(cacheKey);
    if (cached) {
      console.log(`Blog search cache hit for: ${req.query}`);
      return { ...cached, fromCache: true };
    }
  }

  // Cache miss - fetch from API
  const response = await searchBlogs(req);

  // Cache the response (only first page results to avoid stale pagination)
  // Pagination results are transient and shouldn't be cached long-term
  if (!pageToken) {
    setCachedBlogSearch(cacheKey, response, req.query);
    console.log(`Blog search cached for: ${req.query}`);
  }

  return { ...response, fromCache: false };
}

// Map friendly direction strings to API enum values expected by backend (0,1,2)
const FOLLOW_DIRECTION_MAP: Record<'followers' | 'following' | 'both', 0 | 1 | 2> = {
  followers: 0,
  following: 1,
  both: 2,
};

function normalizeFollowDirection(direction?: FollowGraphDirection): 0 | 1 | 2 {
  if (typeof direction === 'number') {
    if (direction === 0 || direction === 1 || direction === 2) return direction;
  } else if (typeof direction === 'string') {
    const mapped = FOLLOW_DIRECTION_MAP[direction];
    if (mapped !== undefined) return mapped;
  }
  // Default to followers to avoid undefined payloads
  return 0;
}

function getFollowDirectionLabel(direction?: FollowGraphDirection): 'followers' | 'following' {
  const normalized = normalizeFollowDirection(direction);
  // Note: direction 2 ('both') is treated as 'followers' for cache key purposes
  // since we cache followers and following separately anyway
  if (normalized === 1) return 'following';
  return 'followers';
}

async function blogFollowGraph(
  req: BlogFollowGraphRequest
): Promise<BlogFollowGraphResponse> {
  const normalizedDirection = normalizeFollowDirection(req.direction);
  return apiRequest<BlogFollowGraphResponse>(
    '/v2/blog-follow-graph',
    {
      ...req,
      direction: normalizedDirection,
    }
  );
}

/**
 * Cached version of blogFollowGraph (CACHE-006, CACHE-009).
 *
 * Returns cached follow graph results if available and not expired.
 * Cache TTL is 2 hours since follow relationships change infrequently (CACHE-009).
 *
 * @param req - The follow graph request parameters
 * @param options - Cache options
 * @param options.skipCache - If true, bypass cache and fetch fresh data
 * @returns Response with follow data and cache metadata
 */
async function blogFollowGraphCached(
  req: BlogFollowGraphRequest,
  options: { skipCache?: boolean } = {}
): Promise<BlogFollowGraphResponse & { fromCache: boolean }> {
  const { skipCache = false } = options;

  // Determine direction for cache key (default to 'followers' if not specified)
  const directionLabel = getFollowDirectionLabel(req.direction);
  const normalizedDirection = normalizeFollowDirection(req.direction);

  // Generate cache key
  const cacheKey = generateFollowGraphCacheKey(
    req.blog_id,
    directionLabel,
    req.page_token
  );

  // Check cache first (unless skipping)
  if (!skipCache) {
    const cached = getCachedFollowGraph<BlogFollowGraphResponse>(cacheKey);
    if (cached) {
      console.log(`Follow graph cache hit for blog ${req.blog_id} (${directionLabel})`);
      return { ...cached, fromCache: true };
    }
  }

  // Cache miss - fetch from API
  const response = await blogFollowGraph({
    ...req,
    direction: normalizedDirection,
  });

  // FOL-008: Don't cache empty responses when counts suggest data should exist
  // An empty followers/following array when the count is > 0 indicates a transient failure
  // (timeout, server error) rather than genuinely having no followers/following.
  // Caching this would show "not following anyone" until cache expires.
  const followers = response.followers || [];
  const following = response.following || [];
  const followersCount = response.followersCount ?? 0;
  const followingCount = response.followingCount ?? 0;
  const isFirstPage = !req.page_token;

  // Check for data mismatch: empty arrays but non-zero counts
  const isFollowersDataMismatch = followers.length === 0 && followersCount > 0;
  const isFollowingDataMismatch = following.length === 0 && followingCount > 0;
  const isLikelyTransientFailure = isFirstPage && (isFollowersDataMismatch || isFollowingDataMismatch);

  if (isLikelyTransientFailure) {
    console.warn(
      `Skipping cache for empty follow graph response (blog ${req.blog_id}, ${directionLabel}) - ` +
      `followers: ${followers.length}/${followersCount}, following: ${following.length}/${followingCount} - ` +
      `likely transient failure (FOL-008)`
    );
  } else {
    // Cache the result
    setCachedFollowGraph(cacheKey, response, req.blog_id, directionLabel);
    console.log(`Follow graph cached for blog ${req.blog_id} (${directionLabel})`);
  }

  return { ...response, fromCache: false };
}

// Re-export follow graph cache utilities for manual cache management
export {
  invalidateFollowGraphCache,
  clearFollowGraphCache,
  getFollowGraphCacheStats,
} from './storage.js';

async function listBlogsRecentActivity(
  req: ListBlogsRecentActivityRequest
): Promise<ListBlogsRecentActivityResponse> {
  return apiRequest<ListBlogsRecentActivityResponse>(
    '/v2/list-blogs-recent-activity',
    req
  );
}

/**
 * Cached version of listBlogsRecentActivity (CACHE-007).
 *
 * Returns cached recent activity results if available and not expired.
 * Cache TTL is 5 minutes since activity data changes frequently.
 * Cache key is generated from blog IDs and globalMerge flag for exact match.
 *
 * @param req - The recent activity request parameters
 * @param options - Cache options
 * @param options.skipCache - If true, bypass cache and fetch fresh data
 * @returns Response with posts and cache metadata
 */
async function listBlogsRecentActivityCached(
  req: ListBlogsRecentActivityRequest,
  options: { skipCache?: boolean } = {}
): Promise<ListBlogsRecentActivityResponse & { fromCache: boolean }> {
  const { skipCache = false } = options;

  // Extract blog IDs from request
  const blogIds = req.blog_ids || [];
  const globalMerge = req.global_merge ?? false;
  const hasPageToken = !!req.page?.page_token;

  // Generate cache key
  const cacheKey = generateRecentActivityCacheKey(blogIds, globalMerge, req.page?.page_token);

  // Check cache first (unless skipping or paginating beyond first page)
  // We still check cache for pagination since each page is cached separately
  if (!skipCache) {
    const cached = getCachedRecentActivity<ListBlogsRecentActivityResponse>(cacheKey);
    if (cached) {
      console.log(
        `Recent activity cache hit for ${blogIds.length} blogs (${globalMerge ? 'merged' : 'separate'})${hasPageToken ? ' [paginated]' : ''}`
      );
      return { ...cached, fromCache: true };
    }
  }

  // Cache miss - fetch from API
  const response = await listBlogsRecentActivity(req);

  // FOL-007: Don't cache empty responses for first page when querying many blogs
  // An empty response when querying 10+ blogs is likely a transient failure (timeout, server error)
  // rather than genuinely having no posts. Caching this would show a blank feed until cache expires.
  const posts = response.posts || [];
  const isFirstPage = !hasPageToken;
  const isLikelyTransientFailure = isFirstPage && blogIds.length >= 10 && posts.length === 0;

  if (isLikelyTransientFailure) {
    console.warn(
      `Skipping cache for empty response from ${blogIds.length} blogs - likely transient failure (FOL-007)`
    );
  } else {
    // Cache the result
    setCachedRecentActivity(cacheKey, response, blogIds, globalMerge);
    console.log(
      `Recent activity cached for ${blogIds.length} blogs (${globalMerge ? 'merged' : 'separate'})${hasPageToken ? ' [paginated]' : ''}`
    );
  }

  return { ...response, fromCache: false };
}

// Re-export recent activity cache utilities for manual cache management
export {
  invalidateRecentActivityCache,
  clearRecentActivityCache,
  getRecentActivityCacheStats,
} from './storage.js';

// Re-export HTTP ETag/Last-Modified cache utilities for manual cache management (CACHE-005)
export {
  invalidateHttpCache,
  clearHttpCache,
  getHttpCacheStats,
} from './storage.js';

async function getBlog(
  req: GetBlogRequest
): Promise<GetBlogResponse> {
  return apiRequest<GetBlogResponse>(
    '/v2/get-blog',
    req
  );
}

// Cached version of resolveIdentifier
async function resolveIdentifierCached(
  blogName: string
): Promise<number | null> {
  // Check cache first
  const cached = getCachedBlogId(blogName);
  if (cached !== undefined) {
    return cached;
  }

  // Cache miss - call API
  try {
    const result = await resolveIdentifier({ blog_name: blogName });
    const blogId = result.blogId || null;
    setCachedBlogId(blogName, blogId);
    // Also cache the reverse mapping
    if (blogId && result.blogName) {
      setCachedBlogName(blogId, result.blogName);
    }
    return blogId;
  } catch {
    setCachedBlogId(blogName, null);
    return null;
  }
}

// Resolve blogId to blogName (cached)
async function resolveBlogIdToName(
  blogId: number
): Promise<string | null> {
  // Check cache first
  const cached = getCachedBlogName(blogId);
  if (cached !== undefined) {
    return cached;
  }

  // Cache miss - call API
  try {
    const result = await resolveIdentifier({ blog_id: blogId });
    const blogName = result.blogName || null;
    setCachedBlogName(blogId, blogName);
    // Also cache the forward mapping
    if (blogName && result.blogId) {
      setCachedBlogId(blogName, result.blogId);
    }
    return blogName;
  } catch {
    setCachedBlogName(blogId, null);
    return null;
  }
}

/**
 * Concurrency limit for batch blog ID resolution (BATCH-001).
 *
 * Higher values improve throughput for large lists but increase
 * server load. 20 concurrent requests is a reasonable balance
 * between performance and API server consideration.
 *
 * Note: Each individual request has retry logic with exponential
 * backoff, so transient errors are handled gracefully.
 */
const BATCH_RESOLVE_CONCURRENCY = 20;

// Batch resolve blogIds to blogNames (for efficiency)
async function resolveBlogIdsToNames(
  blogIds: number[]
): Promise<Map<number, string | null>> {
  const results = new Map<number, string | null>();
  const toResolve: number[] = [];

  // Check cache first for all IDs
  for (const blogId of blogIds) {
    const cached = getCachedBlogName(blogId);
    if (cached !== undefined) {
      results.set(blogId, cached);
    } else {
      toResolve.push(blogId);
    }
  }

  // Resolve remaining IDs in parallel (with concurrency limit)
  for (let i = 0; i < toResolve.length; i += BATCH_RESOLVE_CONCURRENCY) {
    const batch = toResolve.slice(i, i + BATCH_RESOLVE_CONCURRENCY);
    const promises = batch.map(async (blogId) => {
      const name = await resolveBlogIdToName(blogId);
      results.set(blogId, name);
    });
    await Promise.all(promises);
  }

  return results;
}

// ============================================
// Stale Data Fallback API Functions (CONN-002)
// ============================================
// These functions wrap API calls with automatic stale data fallback
// when the API is unavailable (offline, timeout, server error).
// Data is cached on success and served stale for up to 1 hour on failure.

/**
 * List blog posts with stale data fallback.
 * If the API fails and cached data exists, returns stale data instead of throwing.
 */
async function listBlogPostsWithFallback(
  req: ListBlogPostsRequest
): Promise<StaleDataResult<ListBlogPostsResponse>> {
  return apiRequestWithStaleFallback<ListBlogPostsResponse>(
    '/v2/list-blog-posts',
    req
  );
}

/**
 * Search posts by tag with stale data fallback.
 * If the API fails and cached data exists, returns stale data instead of throwing.
 */
async function searchPostsByTagWithFallback(
  req: SearchPostsByTagRequest
): Promise<StaleDataResult<SearchPostsByTagResponse>> {
  return apiRequestWithStaleFallback<SearchPostsByTagResponse>(
    '/v2/search-posts-by-tag',
    req
  );
}

/**
 * Search blogs with stale data fallback.
 * If the API fails and cached data exists, returns stale data instead of throwing.
 */
async function searchBlogsWithFallback(
  req: SearchBlogsRequest
): Promise<StaleDataResult<SearchBlogsResponse>> {
  return apiRequestWithStaleFallback<SearchBlogsResponse>(
    '/v2/search-blogs',
    req
  );
}

/**
 * Get blog follow graph with stale data fallback.
 * If the API fails and cached data exists, returns stale data instead of throwing.
 */
async function blogFollowGraphWithFallback(
  req: BlogFollowGraphRequest
): Promise<StaleDataResult<BlogFollowGraphResponse>> {
  const payload: BlogFollowGraphRequest = {
    ...req,
    direction: normalizeFollowDirection(req.direction),
  };
  return apiRequestWithStaleFallback<BlogFollowGraphResponse>(
    '/v2/blog-follow-graph',
    payload
  );
}

/**
 * List blogs recent activity with stale data fallback.
 * If the API fails and cached data exists, returns stale data instead of throwing.
 */
async function listBlogsRecentActivityWithFallback(
  req: ListBlogsRecentActivityRequest
): Promise<StaleDataResult<ListBlogsRecentActivityResponse>> {
  return apiRequestWithStaleFallback<ListBlogsRecentActivityResponse>(
    '/v2/list-blogs-recent-activity',
    req
  );
}

/**
 * Get blog details with stale data fallback.
 * If the API fails and cached data exists, returns stale data instead of throwing.
 */
async function getBlogWithFallback(
  req: GetBlogRequest
): Promise<StaleDataResult<GetBlogResponse>> {
  return apiRequestWithStaleFallback<GetBlogResponse>(
    '/v2/get-blog',
    req
  );
}

// Re-export error types for use in page scripts
export { ApiError, ApiErrorCode, isApiError } from './api-error.js';

// Re-export telemetry functions for debugging
export {
  logError,
  getErrorStats,
  getRecentErrors,
  getErrorsByCode,
  getErrorsByEndpoint,
  clearTelemetry,
  exportTelemetry,
  hasRecentErrorPattern,
  getErrorPatternSummary,
} from './error-telemetry.js';

// ============================================
// Connection Recovery Integration (CONN-003)
// ============================================
// Re-export retry queue functions for page scripts to use when handling
// offline/network errors. This allows pages to queue failed requests for
// automatic retry when connection is restored.

export {
  queueForRetry,
  removeFromQueue,
  clearRetryQueue,
  getRetryQueueSize,
  getRetryQueueSnapshot,
  type QueuedRequest,
  type ConnectionRecoveryDetail,
  isConnectionRecoveryEvent,
} from './connection.js';

// ============================================
// Partial Response Recovery (TOUT-003)
// ============================================
// When a response times out mid-stream, attempt to salvage any partial
// data that was received. This is especially useful for large list responses
// where we can return complete items that were received before the timeout.

/**
 * Result from a request that may have been interrupted mid-stream.
 * If isPartial is true, the data array may be incomplete but contains
 * all complete items received before the interruption.
 */
export interface PartialResponseResult<T> {
  data: T;
  isPartial: boolean;
  /** Number of bytes received before interruption (if partial) */
  bytesReceived?: number;
  /** Reason for partial response (if partial) */
  partialReason?: 'timeout' | 'network' | 'stream_error';
}

/**
 * Parse partial JSON response that contains an array field.
 * Attempts to extract complete items from a truncated JSON stream.
 *
 * For example, if we receive:
 *   {"posts":[{"id":1,"title":"First"},{"id":2,"title":"Sec
 *
 * We can extract the complete first item and return:
 *   {"posts":[{"id":1,"title":"First"}]}
 *
 * @param partialText - Potentially incomplete JSON text
 * @param arrayField - The field name containing the array to extract (e.g., 'posts', 'followers')
 * @returns Partial response object or null if no valid items found
 */
function parsePartialArrayResponse<T extends Record<string, unknown>>(
  partialText: string,
  arrayField: string
): T | null {
  // Find the array field in the JSON
  const arrayStartPattern = new RegExp(`"${arrayField}"\\s*:\\s*\\[`);
  const arrayMatch = partialText.match(arrayStartPattern);

  if (!arrayMatch || arrayMatch.index === undefined) {
    // Array field not found - try to parse as complete JSON first
    try {
      return JSON.parse(partialText) as T;
    } catch {
      return null;
    }
  }

  const arrayStartIndex = arrayMatch.index + arrayMatch[0].length;
  const arrayContent = partialText.slice(arrayStartIndex);

  // Extract complete JSON objects from the array
  const completeItems: unknown[] = [];
  let depth = 0;
  let itemStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < arrayContent.length; i++) {
    const char = arrayContent[i];

    // Handle string escaping
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }

    // Skip characters inside strings
    if (inString) continue;

    // Track object/array nesting
    if (char === '{' || char === '[') {
      if (depth === 0 && char === '{') {
        itemStart = i;
      }
      depth++;
    } else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0 && char === '}' && itemStart !== -1) {
        // Found complete object
        const itemJson = arrayContent.slice(itemStart, i + 1);
        try {
          const item = JSON.parse(itemJson);
          completeItems.push(item);
        } catch {
          // Invalid JSON, skip this item
        }
        itemStart = -1;
      }
      if (depth < 0) {
        // End of array
        break;
      }
    }
  }

  if (completeItems.length === 0) {
    return null;
  }

  // Try to extract any other complete fields from the JSON
  // Look for fields before the array
  const beforeArray = partialText.slice(0, arrayMatch.index!);
  const otherFields: Record<string, unknown> = {};

  // Simple extraction of key-value pairs before the array
  // This handles cases like: {"page":{"nextPageToken":"xxx"},"posts":[...]
  const fieldPattern = /"(\w+)"\s*:\s*([^,{[]+|{[^}]*}|\[[^\]]*\])/g;
  let fieldMatch;
  while ((fieldMatch = fieldPattern.exec(beforeArray)) !== null) {
    const [, key, value] = fieldMatch;
    if (key !== arrayField) {
      try {
        otherFields[key] = JSON.parse(value);
      } catch {
        // Skip unparseable values
      }
    }
  }

  // Construct the partial response
  const result = {
    ...otherFields,
    [arrayField]: completeItems,
  } as T;

  return result;
}

/**
 * Read response body as text with timeout handling and partial recovery.
 * If the read times out, returns whatever text was received.
 *
 * @param response - Fetch Response object
 * @param timeoutMs - Timeout in milliseconds
 * @returns Object with text content and whether it's complete
 */
async function readResponseWithPartialRecovery(
  response: Response,
  timeoutMs: number
): Promise<{ text: string; isComplete: boolean; bytesReceived: number }> {
  if (!response.body) {
    // Fallback for environments without ReadableStream
    const text = await response.text();
    return { text, isComplete: true, bytesReceived: text.length };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesReceived = 0;
  let isComplete = false;

  // Create a timeout that will cancel reading
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      resolve();
    }, timeoutMs);
  });

  try {
    // Race between reading and timeout
    while (!timedOut) {
      const readPromise = reader.read();

      const result = await Promise.race([
        readPromise.then((r) => ({ type: 'read' as const, result: r })),
        timeoutPromise.then(() => ({ type: 'timeout' as const })),
      ]);

      if (result.type === 'timeout') {
        // Timeout - cancel the read and return what we have
        try {
          reader.cancel();
        } catch {
          // Ignore cancel errors
        }
        break;
      }

      const { done, value } = result.result;
      if (done) {
        isComplete = true;
        break;
      }

      if (value) {
        bytesReceived += value.length;
        chunks.push(decoder.decode(value, { stream: true }));
      }
    }

    // Flush any remaining bytes in decoder
    chunks.push(decoder.decode());
  } catch (error) {
    // Stream error - return what we have
    console.warn('Stream read error during partial recovery:', error);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  return {
    text: chunks.join(''),
    isComplete,
    bytesReceived,
  };
}

/**
 * API endpoints that support partial response recovery.
 * These endpoints return array data that can be partially extracted.
 */
const PARTIAL_RECOVERY_ENDPOINTS: Record<string, string> = {
  '/v2/list-blog-posts': 'posts',
  '/v2/search-posts-by-tag': 'posts',
  '/v2/blog-follow-graph': 'followers', // Also handles 'following'
  '/v2/list-blogs-recent-activity': 'posts',
  '/v2/search-blogs': 'blogs',
};

/**
 * Make an API request with partial response recovery (TOUT-003).
 *
 * If the response stream times out mid-transfer, this function attempts
 * to extract and return any complete items that were received before
 * the timeout. This is especially useful for large list responses.
 *
 * Note: This function bypasses the standard retry logic since partial
 * data is more valuable than repeated retry attempts that may also timeout.
 *
 * @param endpoint - API endpoint path
 * @param body - Request body
 * @param streamTimeoutMs - Timeout for reading response body (default: 15s beyond initial timeout)
 * @returns Response data with partial recovery metadata
 */
async function apiRequestWithPartialRecovery<T>(
  endpoint: string,
  body: unknown,
  streamTimeoutMs?: number
): Promise<PartialResponseResult<T>> {
  const arrayField = PARTIAL_RECOVERY_ENDPOINTS[endpoint];

  if (!arrayField) {
    // Endpoint doesn't support partial recovery - use standard request
    const data = await apiRequest<T>(endpoint, body);
    return { data, isPartial: false };
  }

  // Check offline state
  if (isOffline()) {
    throw new ApiError(
      ApiErrorCode.OFFLINE,
      'You appear to be offline. Please check your connection.',
      { endpoint }
    );
  }

  const token = await getToken();
  const controller = new AbortController();
  const endpointTimeout = getEndpointTimeout(endpoint);

  // Connection timeout (for initial response headers)
  const connectionTimeout = setTimeout(() => controller.abort(), endpointTimeout);

  try {
    const resp = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(connectionTimeout);

    if (!resp.ok) {
      // For non-OK responses, throw standard error
      const apiError = apiErrorFromStatus(resp.status, `HTTP ${resp.status}`, endpoint);
      throw apiError;
    }

    // Use additional timeout for reading the body
    // Default to 15s beyond the connection timeout
    const bodyTimeout = streamTimeoutMs ?? endpointTimeout + 15000;

    // Read response with partial recovery support
    const { text, isComplete, bytesReceived } = await readResponseWithPartialRecovery(resp, bodyTimeout);

    if (isComplete) {
      // Complete response - parse normally
      try {
        const data = JSON.parse(text) as T;
        if ((data as Record<string, unknown>).error) {
          const errorData = data as { error: string };
          throw new ApiError(ApiErrorCode.SERVER_ERROR, errorData.error, { endpoint });
        }
        return { data, isPartial: false };
      } catch (e) {
        if (e instanceof ApiError) throw e;
        throw new ApiError(ApiErrorCode.PARSE_ERROR, 'Failed to parse response', {
          endpoint,
          cause: e instanceof Error ? e : undefined,
        });
      }
    }

    // Incomplete response - attempt partial recovery
    console.warn(
      `Response stream timeout for ${endpoint} after ${bytesReceived} bytes - attempting partial recovery`
    );

    // Try blog-follow-graph with 'following' field if 'followers' didn't work
    let partialData = parsePartialArrayResponse<Record<string, unknown>>(text, arrayField);
    if (!partialData && endpoint === '/v2/blog-follow-graph') {
      partialData = parsePartialArrayResponse<Record<string, unknown>>(text, 'following');
    }

    if (partialData) {
      const itemCount =
        partialData[arrayField] instanceof Array
          ? (partialData[arrayField] as unknown[]).length
          : 0;
      console.log(`Partial recovery successful: extracted ${itemCount} complete items from ${bytesReceived} bytes`);

      return {
        data: partialData as T,
        isPartial: true,
        bytesReceived,
        partialReason: 'timeout',
      };
    }

    // Couldn't extract any partial data - throw timeout error
    throw new ApiError(
      ApiErrorCode.TIMEOUT,
      `Response stream timeout with no recoverable data (received ${bytesReceived} bytes)`,
      { endpoint }
    );
  } catch (e) {
    clearTimeout(connectionTimeout);

    if (e instanceof ApiError) {
      throw e;
    }

    const error = e as Error;
    if (error.name === 'AbortError') {
      throw new ApiError(ApiErrorCode.TIMEOUT, 'Request timeout', {
        endpoint,
        cause: error,
      });
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new ApiError(ApiErrorCode.NETWORK, 'Network error', {
        endpoint,
        cause: error,
      });
    }

    throw new ApiError(ApiErrorCode.UNKNOWN, error.message || 'Unknown error', {
      endpoint,
      cause: error,
    });
  }
}

/**
 * List blog posts with partial response recovery.
 * If the response times out mid-stream, returns any complete posts received.
 */
async function listBlogPostsWithPartialRecovery(
  req: ListBlogPostsRequest
): Promise<PartialResponseResult<ListBlogPostsResponse>> {
  return apiRequestWithPartialRecovery<ListBlogPostsResponse>(
    '/v2/list-blog-posts',
    req
  );
}

/**
 * Search posts by tag with partial response recovery.
 * If the response times out mid-stream, returns any complete posts received.
 */
async function searchPostsByTagWithPartialRecovery(
  req: SearchPostsByTagRequest
): Promise<PartialResponseResult<SearchPostsByTagResponse>> {
  return apiRequestWithPartialRecovery<SearchPostsByTagResponse>(
    '/v2/search-posts-by-tag',
    req
  );
}

/**
 * Get blog follow graph with partial response recovery.
 * If the response times out mid-stream, returns any complete follower/following entries.
 */
async function blogFollowGraphWithPartialRecovery(
  req: BlogFollowGraphRequest
): Promise<PartialResponseResult<BlogFollowGraphResponse>> {
  const payload: BlogFollowGraphRequest = {
    ...req,
    direction: normalizeFollowDirection(req.direction),
  };
  return apiRequestWithPartialRecovery<BlogFollowGraphResponse>(
    '/v2/blog-follow-graph',
    payload
  );
}

/**
 * List blogs recent activity with partial response recovery.
 * If the response times out mid-stream, returns any complete posts received.
 */
async function listBlogsRecentActivityWithPartialRecovery(
  req: ListBlogsRecentActivityRequest
): Promise<PartialResponseResult<ListBlogsRecentActivityResponse>> {
  return apiRequestWithPartialRecovery<ListBlogsRecentActivityResponse>(
    '/v2/list-blogs-recent-activity',
    req
  );
}

/**
 * Search blogs with partial response recovery.
 * If the response times out mid-stream, returns any complete blog entries received.
 */
async function searchBlogsWithPartialRecovery(
  req: SearchBlogsRequest
): Promise<PartialResponseResult<SearchBlogsResponse>> {
  return apiRequestWithPartialRecovery<SearchBlogsResponse>(
    '/v2/search-blogs',
    req
  );
}

// ============================================
// Unified Caching Strategy Types (TECH-010c)
// ============================================
// These types provide a unified interface for cache strategy configuration.
// Instead of calling different methods (listCached, listSWR, listWithFallback),
// callers can use a single method with options: { cache: 'swr' | 'stale-fallback' | 'none' }

/**
 * Cache strategy options for API requests (TECH-010c).
 *
 * - 'none': No caching, always fetch fresh data from API
 * - 'standard': Standard caching with TTL-based expiry
 * - 'swr': Stale-while-revalidate - return cached data immediately, refresh in background
 * - 'stale-fallback': On API error, fall back to stale cached data if available
 */
export type CacheStrategy = 'none' | 'standard' | 'swr' | 'stale-fallback';

/**
 * Unified cache options for API requests (TECH-010c).
 *
 * This interface consolidates the various caching parameters previously spread
 * across multiple function signatures into a single, consistent options object.
 *
 * @example
 * ```typescript
 * // Standard caching
 * client.posts.list(req, { cache: 'standard', skipCache: false });
 *
 * // SWR with custom TTLs
 * client.posts.list(req, { cache: 'swr', freshTTL: 30000, staleTTL: 300000 });
 *
 * // Stale fallback with partial recovery
 * client.posts.list(req, { cache: 'stale-fallback', partialRecovery: true });
 * ```
 */
export interface CacheOptions {
  /**
   * Cache strategy to use. Defaults to 'none' for backwards compatibility.
   */
  cache?: CacheStrategy;

  /**
   * Skip cache and fetch fresh data even when cache would be valid.
   * Applies to 'standard' and 'swr' strategies.
   */
  skipCache?: boolean;

  /**
   * Enable partial response recovery on timeout.
   * If true, attempts to extract complete items from truncated responses.
   */
  partialRecovery?: boolean;

  /**
   * Cache TTL in milliseconds for 'standard' strategy.
   * Default varies by endpoint (typically 5 minutes).
   */
  ttl?: number;

  /**
   * Duration in milliseconds that cached data is considered fresh for 'swr' strategy.
   * During this period, cached data is returned without background revalidation.
   * Default: 30000 (30 seconds)
   */
  freshTTL?: number;

  /**
   * Duration in milliseconds that stale data can be served for 'swr' strategy.
   * After this period, data must be revalidated before being returned.
   * Default: 300000 (5 minutes)
   */
  staleTTL?: number;

  /**
   * Maximum age in milliseconds for cached data for 'swr' strategy.
   * After this period, cached data is discarded entirely.
   * Default: 3600000 (1 hour)
   */
  maxAge?: number;
}

/**
 * Result type that unifies the various cache response formats (TECH-010c).
 *
 * This type combines metadata from all cache strategies into a single
 * consistent structure that callers can inspect to understand the
 * source and freshness of the returned data.
 */
export interface UnifiedCacheResult<T> {
  /** The response data */
  data: T;

  /** Cache metadata */
  meta: {
    /** Whether data came from cache (vs fresh API response) */
    fromCache: boolean;

    /** For SWR: whether cached data is within fresh TTL */
    isFresh?: boolean;

    /** For SWR: whether cached data is beyond fresh TTL but still usable */
    isStale?: boolean;

    /** For SWR: whether background revalidation was triggered */
    revalidating?: boolean;

    /** For stale-fallback: timestamp when data was cached */
    cachedAt?: number;

    /** For partial recovery: whether response was truncated */
    isPartial?: boolean;

    /** For partial recovery: bytes received before truncation */
    bytesReceived?: number;

    /** For partial recovery: reason for truncation */
    partialReason?: 'timeout' | 'network' | 'stream_error';
  };
}

/**
 * Convert standard cached response to unified format.
 */
function toUnifiedResult<T>(
  response: T & { fromCache?: boolean },
  strategy: CacheStrategy
): UnifiedCacheResult<T> {
  const { fromCache, ...data } = response as T & { fromCache?: boolean };
  return {
    data: data as T,
    meta: {
      fromCache: fromCache ?? false,
      isFresh: strategy === 'standard' ? !fromCache : undefined,
      isStale: false,
    },
  };
}

/**
 * Convert SWR response to unified format.
 */
function swrToUnifiedResult<T>(result: SWRResult<T>): UnifiedCacheResult<T> {
  return {
    data: result.data,
    meta: {
      fromCache: result.fromCache,
      isFresh: result.isFresh,
      isStale: result.isStale,
      revalidating: result.revalidating,
    },
  };
}

/**
 * Convert stale fallback response to unified format.
 */
function staleToUnifiedResult<T>(result: StaleDataResult<T>): UnifiedCacheResult<T> {
  return {
    data: result.data,
    meta: {
      fromCache: result.isStale,
      isFresh: !result.isStale,
      isStale: result.isStale,
      cachedAt: result.cachedAt,
    },
  };
}

/**
 * Convert partial recovery response to unified format.
 */
function partialToUnifiedResult<T>(result: PartialResponseResult<T>): UnifiedCacheResult<T> {
  return {
    data: result.data,
    meta: {
      fromCache: false,
      isPartial: result.isPartial,
      bytesReceived: result.bytesReceived,
      partialReason: result.partialReason,
    },
  };
}

// ============================================
// ApiClient Class (TECH-010)
// ============================================
// This class provides a centralized, object-oriented interface to the BDSMLR API.
// It encapsulates authentication, request handling, and caching in a single instance.
//
// Migration Plan:
// - TECH-010a: Create class skeleton with auth methods ✅ Done
// - TECH-010b: Consolidate endpoint methods into namespaced groups ✅ Done
// - TECH-010c: Unify caching strategy with configurable options ✅ Done
// - TECH-010d: Update page scripts to use ApiClient instance
// - TECH-010e: Update components to use shared client
// - TECH-010f: Remove legacy function exports
// - TECH-010g: Add JSDoc documentation

// ============================================
// Namespaced API Classes (TECH-010b)
// ============================================
// Each namespace provides a focused set of methods for a specific API domain.
// Methods follow consistent naming: get/list/search + Cached/SWR/WithFallback/WithPartialRecovery

/**
 * Posts API namespace.
 *
 * Provides methods for listing posts from a single blog and searching posts by tag.
 * Each method has multiple variants for different caching strategies:
 *
 * - **Basic** (`list`, `search`): No caching, always fetches fresh data
 * - **Cached** (`listCached`, `searchCached`): TTL-based caching (5 min default)
 * - **SWR** (`listSWR`, `searchSWR`): Stale-while-revalidate for instant UI updates
 * - **WithFallback** (`listWithFallback`, `searchWithFallback`): Falls back to stale data on errors
 * - **WithPartialRecovery** (`listWithPartialRecovery`, `searchWithPartialRecovery`): Extracts complete items from truncated responses
 * - **WithOptions** (`listWithOptions`, `searchWithOptions`): Unified interface for all strategies
 *
 * @example
 * ```typescript
 * // Basic usage - list posts from a blog
 * const posts = await client.posts.list({ blog_id: 123 });
 *
 * // With caching - reduces API calls
 * const cached = await client.posts.listCached({ blog_id: 123 });
 * console.log('From cache:', cached.fromCache);
 *
 * // SWR - instant UI, background refresh
 * const swr = await client.posts.listSWR({ blog_id: 123 });
 * if (swr.revalidating) console.log('Refreshing in background...');
 *
 * // Search posts by tag
 * const results = await client.posts.search({ tag: 'photography', limit: 20 });
 * ```
 *
 * @see {@link ListBlogPostsRequest} for list parameters
 * @see {@link SearchPostsByTagRequest} for search parameters
 */
export class PostsApi {
  /**
   * List posts from a specific blog.
   *
   * Fetches posts directly from the API without caching. Use this when you need
   * guaranteed fresh data or are implementing your own caching strategy.
   *
   * @param req - Request parameters
   * @param req.blog_id - The numeric ID of the blog (required)
   * @param req.page_token - Pagination cursor from previous response
   * @param req.limit - Maximum posts to return (default: 20, max: 100)
   * @param req.sort_field - Field to sort by (1=CREATED_AT, 2=LIKES_COUNT, etc.)
   * @param req.order - Sort order (1=ASC, 2=DESC)
   * @param req.types - Filter by post types (2=IMAGE, 3=VIDEO, etc.)
   * @param req.variants - Filter by variant (1=ORIGINAL, 2=REBLOG)
   *
   * @returns Response containing posts array and pagination info
   * @returns posts - Array of Post objects
   * @returns nextPageToken - Cursor for fetching next page (undefined if no more)
   * @returns totalCount - Total number of posts matching the query
   *
   * @throws {ApiError} With code TIMEOUT if request exceeds 15 seconds
   * @throws {ApiError} With code NETWORK if network request fails
   * @throws {ApiError} With code SERVER_ERROR if API returns 5xx status
   * @throws {ApiError} With code AUTH_REQUIRED if token is invalid/expired
   *
   * @example
   * ```typescript
   * // Basic usage
   * const response = await client.posts.list({ blog_id: 12345 });
   * console.log(`Found ${response.posts.length} posts`);
   *
   * // With pagination
   * let pageToken: string | undefined;
   * do {
   *   const page = await client.posts.list({
   *     blog_id: 12345,
   *     page_token: pageToken,
   *     limit: 50
   *   });
   *   processPosts(page.posts);
   *   pageToken = page.nextPageToken;
   * } while (pageToken);
   *
   * // Filtered by type and sorted
   * const images = await client.posts.list({
   *   blog_id: 12345,
   *   types: [2],           // Images only
   *   sort_field: 2,        // By likes
   *   order: 2              // Descending (most liked first)
   * });
   * ```
   */
  async list(req: ListBlogPostsRequest): Promise<ListBlogPostsResponse> {
    return listBlogPosts(req);
  }

  /**
   * List posts with TTL-based caching.
   *
   * Returns cached posts if available and not expired (default: 5 minutes).
   * Reduces API calls for frequently accessed blogs.
   *
   * @param req - Request parameters (see {@link list} for details)
   * @param options - Caching options
   * @param options.skipCache - Force fresh fetch even if cache is valid
   * @param options.ttl - Custom cache TTL in milliseconds (default: 300000)
   *
   * @returns Response with additional `fromCache` indicator
   *
   * @throws {ApiError} Same as {@link list}
   *
   * @example
   * ```typescript
   * // Normal usage - uses cache if available
   * const result = await client.posts.listCached({ blog_id: 123 });
   * if (result.fromCache) {
   *   console.log('Data from cache');
   * }
   *
   * // Force fresh data
   * const fresh = await client.posts.listCached(
   *   { blog_id: 123 },
   *   { skipCache: true }
   * );
   *
   * // Custom TTL (30 seconds)
   * const shortLived = await client.posts.listCached(
   *   { blog_id: 123 },
   *   { ttl: 30000 }
   * );
   * ```
   *
   * @see {@link list} for non-cached version
   * @see {@link listSWR} for stale-while-revalidate pattern
   */
  async listCached(
    req: ListBlogPostsRequest,
    options?: { skipCache?: boolean; ttl?: number }
  ): Promise<ListBlogPostsResponse & { fromCache: boolean }> {
    return listBlogPostsCached(req, options);
  }

  /**
   * List posts with stale-while-revalidate caching strategy.
   *
   * Returns cached data immediately (even if stale) for instant UI updates,
   * while triggering a background revalidation to refresh the cache.
   * Ideal for user-facing pages where perceived performance matters.
   *
   * @param req - Request parameters (see {@link list} for details)
   * @param options - SWR timing options
   * @param options.freshTTL - How long data is considered fresh (default: 30000ms)
   * @param options.staleTTL - How long stale data can be served (default: 300000ms)
   * @param options.maxAge - Maximum age before data is evicted (default: 3600000ms)
   *
   * @returns SWR result with cache state indicators
   * @returns data - The response data
   * @returns fromCache - Whether data came from cache
   * @returns isFresh - Whether cached data is within freshTTL
   * @returns isStale - Whether cached data is beyond freshTTL
   * @returns revalidating - Whether background refresh is in progress
   *
   * @throws {ApiError} Only if no cached data exists AND API request fails
   *
   * @example
   * ```typescript
   * const result = await client.posts.listSWR({ blog_id: 123 });
   *
   * // Show data immediately
   * displayPosts(result.data.posts);
   *
   * // Optionally indicate staleness to user
   * if (result.isStale) {
   *   showRefreshingIndicator();
   * }
   *
   * // Custom TTLs for frequently-changing content
   * const volatile = await client.posts.listSWR(
   *   { blog_id: 123 },
   *   { freshTTL: 10000, staleTTL: 60000 }  // 10s fresh, 1m stale
   * );
   * ```
   *
   * @see {@link listCached} for simpler TTL-based caching
   * @see {@link listWithFallback} for error resilience
   */
  async listSWR(
    req: ListBlogPostsRequest,
    options?: { freshTTL?: number; staleTTL?: number; maxAge?: number }
  ): Promise<SWRResult<ListBlogPostsResponse>> {
    return listBlogPostsSWR(req, options);
  }

  /**
   * List posts with stale data fallback on errors.
   *
   * Attempts to fetch fresh data, but returns cached stale data instead
   * of throwing errors for transient failures (network, timeout, server errors).
   * Essential for offline-tolerant and network-resilient applications.
   *
   * @param req - Request parameters (see {@link list} for details)
   *
   * @returns Result with staleness indicator
   * @returns data - The response data (fresh or stale)
   * @returns isStale - Whether returned data is from stale cache
   * @returns cachedAt - Timestamp when stale data was cached (if isStale)
   *
   * @throws {ApiError} Only if API fails AND no stale cache exists
   *
   * @example
   * ```typescript
   * try {
   *   const result = await client.posts.listWithFallback({ blog_id: 123 });
   *
   *   if (result.isStale) {
   *     showWarning(`Showing cached data from ${formatDate(result.cachedAt)}`);
   *   }
   *
   *   displayPosts(result.data.posts);
   * } catch (e) {
   *   // Only thrown if no cached data available
   *   showOfflineMessage();
   * }
   * ```
   *
   * @see {@link listSWR} for proactive background refresh
   * @see {@link listWithPartialRecovery} for partial data recovery
   */
  async listWithFallback(
    req: ListBlogPostsRequest
  ): Promise<StaleDataResult<ListBlogPostsResponse>> {
    return listBlogPostsWithFallback(req);
  }

  /**
   * List posts with partial response recovery.
   *
   * If a response times out mid-stream (during body transfer), attempts to
   * extract and return any complete posts that were received. Useful for
   * slow connections where partial data is better than no data.
   *
   * @param req - Request parameters (see {@link list} for details)
   *
   * @returns Result with partial recovery metadata
   * @returns data - Response containing complete posts received
   * @returns isPartial - Whether response was incomplete
   * @returns bytesReceived - Number of bytes received before timeout (if partial)
   * @returns partialReason - Cause of partial response ('timeout' | 'network' | 'stream_error')
   *
   * @throws {ApiError} If request fails before any data is received
   *
   * @example
   * ```typescript
   * const result = await client.posts.listWithPartialRecovery({ blog_id: 123 });
   *
   * if (result.isPartial) {
   *   console.warn(`Partial response: ${result.bytesReceived} bytes`);
   *   console.warn(`Reason: ${result.partialReason}`);
   *   showPartialDataWarning();
   * }
   *
   * // Display whatever posts we got
   * displayPosts(result.data.posts);
   * ```
   *
   * @see {@link listWithFallback} for cached fallback
   */
  async listWithPartialRecovery(
    req: ListBlogPostsRequest
  ): Promise<PartialResponseResult<ListBlogPostsResponse>> {
    return listBlogPostsWithPartialRecovery(req);
  }

  /**
   * Search posts by tag.
   *
   * Searches across all posts on the platform for the specified tag(s).
   * Supports boolean syntax for complex queries.
   *
   * @param req - Search parameters
   * @param req.tag - Tag to search for (required). Supports boolean syntax:
   *   - Space for AND: "bdsm bondage" matches posts with both tags
   *   - Dash prefix for NOT: "bdsm -vanilla" excludes vanilla tag
   *   - Quotes for exact phrase: "\"hot tub\"" matches exact phrase
   *   - Parentheses for grouping: "(bdsm bondage) -vanilla"
   * @param req.page_token - Pagination cursor from previous response
   * @param req.limit - Maximum posts to return (default: 20, max: 100)
   * @param req.sort_field - Field to sort by (1=CREATED_AT, 2=LIKES_COUNT, etc.)
   * @param req.order - Sort order (1=ASC, 2=DESC)
   * @param req.types - Filter by post types
   * @param req.variants - Filter by variant (original/reblog)
   *
   * @returns Response containing matching posts and pagination info
   *
   * @throws {ApiError} With code TIMEOUT if request exceeds 30 seconds
   * @throws {ApiError} With code NETWORK if network request fails
   * @throws {ApiError} With code SERVER_ERROR if API returns 5xx status
   *
   * @example
   * ```typescript
   * // Simple tag search
   * const results = await client.posts.search({ tag: 'photography' });
   *
   * // Boolean search - posts with bdsm AND NOT vanilla
   * const filtered = await client.posts.search({ tag: 'bdsm -vanilla' });
   *
   * // Complex boolean with sort
   * const popular = await client.posts.search({
   *   tag: '(photography art) -selfie',
   *   sort_field: 2,  // LIKES_COUNT
   *   order: 2,       // DESC
   *   limit: 50
   * });
   * ```
   */
  async search(req: SearchPostsByTagRequest): Promise<SearchPostsByTagResponse> {
    return searchPostsByTag(req);
  }

  /**
   * Search posts by tag with TTL-based caching.
   *
   * Caches search results for 5 minutes to reduce API load for repeated queries.
   * Cache key is generated from all request parameters for exact matches only.
   *
   * @param req - Search parameters (see {@link search} for details)
   * @param options - Caching options
   * @param options.skipCache - Force fresh search even if cache is valid
   *
   * @returns Response with `fromCache` indicator
   *
   * @throws {ApiError} Same as {@link search}
   *
   * @example
   * ```typescript
   * // Cached search
   * const result = await client.posts.searchCached({ tag: 'art' });
   * console.log('Cached:', result.fromCache);
   *
   * // Force fresh search
   * const fresh = await client.posts.searchCached(
   *   { tag: 'art' },
   *   { skipCache: true }
   * );
   * ```
   *
   * @see {@link search} for non-cached version
   */
  async searchCached(
    req: SearchPostsByTagRequest,
    options?: { skipCache?: boolean }
  ): Promise<SearchPostsByTagResponse & { fromCache: boolean }> {
    return searchPostsByTagCached(req, options);
  }

  /**
   * Search posts by tag with stale-while-revalidate caching.
   *
   * Returns cached results immediately for instant UI, while refreshing
   * in the background if data is stale.
   *
   * @param req - Search parameters (see {@link search} for details)
   * @param options - SWR timing options (see {@link listSWR} for details)
   *
   * @returns SWR result with cache state indicators
   *
   * @throws {ApiError} Only if no cached data AND API request fails
   *
   * @see {@link listSWR} for detailed SWR documentation
   */
  async searchSWR(
    req: SearchPostsByTagRequest,
    options?: { freshTTL?: number; staleTTL?: number; maxAge?: number }
  ): Promise<SWRResult<SearchPostsByTagResponse>> {
    return searchPostsByTagSWR(req, options);
  }

  /**
   * Search posts by tag with stale data fallback on errors.
   *
   * @param req - Search parameters (see {@link search} for details)
   * @returns Result with staleness indicator
   * @throws {ApiError} Only if API fails AND no stale cache exists
   *
   * @see {@link listWithFallback} for detailed fallback documentation
   */
  async searchWithFallback(
    req: SearchPostsByTagRequest
  ): Promise<StaleDataResult<SearchPostsByTagResponse>> {
    return searchPostsByTagWithFallback(req);
  }

  /**
   * Search posts by tag with partial response recovery.
   *
   * @param req - Search parameters (see {@link search} for details)
   * @returns Result with partial recovery metadata
   * @throws {ApiError} If request fails before any data is received
   *
   * @see {@link listWithPartialRecovery} for detailed recovery documentation
   */
  async searchWithPartialRecovery(
    req: SearchPostsByTagRequest
  ): Promise<PartialResponseResult<SearchPostsByTagResponse>> {
    return searchPostsByTagWithPartialRecovery(req);
  }

  // ============================================
  // Unified Methods (TECH-010c)
  // ============================================

  /**
   * List posts with unified caching options (TECH-010c).
   *
   * This method consolidates all caching strategies into a single interface.
   * Use the `cache` option to select the strategy:
   * - 'none': No caching (default)
   * - 'standard': TTL-based caching
   * - 'swr': Stale-while-revalidate
   * - 'stale-fallback': Fall back to stale data on error
   *
   * @param req - The list posts request parameters
   * @param options - Cache options
   * @returns Unified result with data and cache metadata
   *
   * @example
   * ```typescript
   * // Standard caching
   * const result = await client.posts.listWithOptions(req, { cache: 'standard' });
   *
   * // SWR with custom TTLs
   * const result = await client.posts.listWithOptions(req, {
   *   cache: 'swr',
   *   freshTTL: 30000,
   *   staleTTL: 300000
   * });
   *
   * // Partial recovery on timeout
   * const result = await client.posts.listWithOptions(req, { partialRecovery: true });
   * ```
   */
  async listWithOptions(
    req: ListBlogPostsRequest,
    options: CacheOptions = {}
  ): Promise<UnifiedCacheResult<ListBlogPostsResponse>> {
    const { cache = 'none', skipCache, partialRecovery, ttl, freshTTL, staleTTL, maxAge } = options;

    // Handle partial recovery first (can be combined with any strategy)
    if (partialRecovery) {
      const result = await listBlogPostsWithPartialRecovery(req);
      return partialToUnifiedResult(result);
    }

    switch (cache) {
      case 'standard': {
        const result = await listBlogPostsCached(req, { skipCache, ttl });
        return toUnifiedResult(result, 'standard');
      }

      case 'swr': {
        const result = await listBlogPostsSWR(req, { freshTTL, staleTTL, maxAge });
        return swrToUnifiedResult(result);
      }

      case 'stale-fallback': {
        const result = await listBlogPostsWithFallback(req);
        return staleToUnifiedResult(result);
      }

      case 'none':
      default: {
        const data = await listBlogPosts(req);
        return {
          data,
          meta: { fromCache: false },
        };
      }
    }
  }

  /**
   * Search posts with unified caching options (TECH-010c).
   *
   * This method consolidates all caching strategies into a single interface.
   *
   * @param req - The search request parameters
   * @param options - Cache options
   * @returns Unified result with data and cache metadata
   */
  async searchWithOptions(
    req: SearchPostsByTagRequest,
    options: CacheOptions = {}
  ): Promise<UnifiedCacheResult<SearchPostsByTagResponse>> {
    const { cache = 'none', skipCache, partialRecovery, freshTTL, staleTTL, maxAge } = options;

    // Handle partial recovery first
    if (partialRecovery) {
      const result = await searchPostsByTagWithPartialRecovery(req);
      return partialToUnifiedResult(result);
    }

    switch (cache) {
      case 'standard': {
        const result = await searchPostsByTagCached(req, { skipCache });
        return toUnifiedResult(result, 'standard');
      }

      case 'swr': {
        const result = await searchPostsByTagSWR(req, { freshTTL, staleTTL, maxAge });
        return swrToUnifiedResult(result);
      }

      case 'stale-fallback': {
        const result = await searchPostsByTagWithFallback(req);
        return staleToUnifiedResult(result);
      }

      case 'none':
      default: {
        const data = await searchPostsByTag(req);
        return {
          data,
          meta: { fromCache: false },
        };
      }
    }
  }
}

/**
 * Blogs API namespace.
 *
 * Provides methods for searching blogs, retrieving blog details, and resolving
 * blog identifiers (name ↔ ID). Includes legacy follower/following endpoints.
 *
 * @example
 * ```typescript
 * // Search for blogs
 * const results = await client.blogs.search({ query: 'photography' });
 *
 * // Get blog details
 * const blog = await client.blogs.get({ blog_id: 123 });
 *
 * // Resolve blog name to ID
 * const blogId = await client.blogs.resolveId('myblog');
 *
 * // Batch resolve IDs to names (efficient for lists)
 * const names = await client.blogs.resolveNames([123, 456, 789]);
 * ```
 *
 * @see {@link SearchBlogsRequest} for search parameters
 * @see {@link GetBlogRequest} for get parameters
 */
export class BlogsApi {
  /**
   * Search for blogs by name, title, or description.
   *
   * Performs a text search across blog metadata. Results are ranked by relevance.
   *
   * @param req - Search parameters
   * @param req.query - Search query string (required). Searches blog name, title, and description.
   * @param req.page_token - Pagination cursor from previous response
   * @param req.limit - Maximum blogs to return (default: 20, max: 100)
   *
   * @returns Response containing matching blogs and pagination info
   * @returns blogs - Array of Blog objects with metadata
   * @returns nextPageToken - Cursor for next page (undefined if no more results)
   *
   * @throws {ApiError} With code TIMEOUT if request exceeds 30 seconds
   * @throws {ApiError} With code NETWORK if network request fails
   * @throws {ApiError} With code SERVER_ERROR if API returns 5xx status
   *
   * @example
   * ```typescript
   * // Simple search
   * const results = await client.blogs.search({ query: 'nature photography' });
   * console.log(`Found ${results.blogs.length} blogs`);
   *
   * // Paginated search
   * let pageToken: string | undefined;
   * const allBlogs: Blog[] = [];
   * do {
   *   const page = await client.blogs.search({
   *     query: 'art',
   *     page_token: pageToken,
   *     limit: 50
   *   });
   *   allBlogs.push(...page.blogs);
   *   pageToken = page.nextPageToken;
   * } while (pageToken && allBlogs.length < 200);
   * ```
   */
  async search(req: SearchBlogsRequest): Promise<SearchBlogsResponse> {
    return searchBlogs(req);
  }

  /**
   * Search blogs with TTL-based caching.
   *
   * Caches search results for 5 minutes. Useful for repeated searches.
   *
   * @param req - Search parameters (see {@link search} for details)
   * @param options - Caching options
   * @param options.skipCache - Force fresh search even if cache is valid
   *
   * @returns Response with `fromCache` indicator
   *
   * @throws {ApiError} Same as {@link search}
   *
   * @see {@link search} for non-cached version
   */
  async searchCached(
    req: SearchBlogsRequest,
    options?: { skipCache?: boolean }
  ): Promise<SearchBlogsResponse & { fromCache: boolean }> {
    return searchBlogsCached(req, options);
  }

  /**
   * Search blogs with stale-while-revalidate caching.
   *
   * Returns cached results immediately, refreshes in background if stale.
   *
   * @param req - Search parameters (see {@link search} for details)
   * @param options - SWR timing options
   * @param options.freshTTL - How long data is considered fresh (default: 30000ms)
   * @param options.staleTTL - How long stale data can be served (default: 300000ms)
   * @param options.maxAge - Maximum age before data is evicted (default: 3600000ms)
   *
   * @returns SWR result with cache state indicators
   *
   * @throws {ApiError} Only if no cached data AND API request fails
   *
   * @see {@link PostsApi.listSWR} for detailed SWR documentation
   */
  async searchSWR(
    req: SearchBlogsRequest,
    options?: { freshTTL?: number; staleTTL?: number; maxAge?: number }
  ): Promise<SWRResult<SearchBlogsResponse>> {
    return searchBlogsSWR(req, options);
  }

  /**
   * Search blogs with stale data fallback on errors.
   *
   * Returns cached stale data instead of throwing on transient errors.
   *
   * @param req - Search parameters (see {@link search} for details)
   * @returns Result with staleness indicator
   * @throws {ApiError} Only if API fails AND no stale cache exists
   *
   * @see {@link PostsApi.listWithFallback} for detailed fallback documentation
   */
  async searchWithFallback(
    req: SearchBlogsRequest
  ): Promise<StaleDataResult<SearchBlogsResponse>> {
    return searchBlogsWithFallback(req);
  }

  /**
   * Search blogs with partial response recovery.
   *
   * Extracts complete blog entries from truncated responses on timeout.
   *
   * @param req - Search parameters (see {@link search} for details)
   * @returns Result with partial recovery metadata
   * @throws {ApiError} If request fails before any data is received
   *
   * @see {@link PostsApi.listWithPartialRecovery} for detailed recovery documentation
   */
  async searchWithPartialRecovery(
    req: SearchBlogsRequest
  ): Promise<PartialResponseResult<SearchBlogsResponse>> {
    return searchBlogsWithPartialRecovery(req);
  }

  /**
   * Get detailed information about a blog.
   *
   * Retrieves full blog metadata including name, title, description,
   * avatar, post count, follower count, and settings.
   *
   * @param req - Request parameters
   * @param req.blog_id - Numeric ID of the blog to retrieve (required)
   *
   * @returns Full blog details
   * @returns blog - Blog object with all metadata fields
   *
   * @throws {ApiError} With code NOT_FOUND if blog doesn't exist
   * @throws {ApiError} With code TIMEOUT if request exceeds 5 seconds
   * @throws {ApiError} With code NETWORK if network request fails
   *
   * @example
   * ```typescript
   * const response = await client.blogs.get({ blog_id: 12345 });
   * const blog = response.blog;
   *
   * console.log(`Blog: ${blog.name}`);
   * console.log(`Title: ${blog.title}`);
   * console.log(`Posts: ${blog.postsCount}`);
   * console.log(`Followers: ${blog.followersCount}`);
   * ```
   */
  async get(req: GetBlogRequest): Promise<GetBlogResponse> {
    return getBlog(req);
  }

  /**
   * Get blog details with stale-while-revalidate caching.
   *
   * Returns cached blog data immediately, refreshes in background if stale.
   * Ideal for blog profile pages where instant display matters.
   *
   * @param req - Request parameters (see {@link get} for details)
   * @param options - SWR timing options (see {@link searchSWR} for details)
   *
   * @returns SWR result with cache state indicators
   *
   * @throws {ApiError} Only if no cached data AND API request fails
   */
  async getSWR(
    req: GetBlogRequest,
    options?: { freshTTL?: number; staleTTL?: number; maxAge?: number }
  ): Promise<SWRResult<GetBlogResponse>> {
    return getBlogSWR(req, options);
  }

  /**
   * Get blog details with stale data fallback on errors.
   *
   * Returns cached stale blog data instead of throwing on transient errors.
   *
   * @param req - Request parameters (see {@link get} for details)
   * @returns Result with staleness indicator
   * @throws {ApiError} Only if API fails AND no stale cache exists
   */
  async getWithFallback(
    req: GetBlogRequest
  ): Promise<StaleDataResult<GetBlogResponse>> {
    return getBlogWithFallback(req);
  }

  /**
   * Resolve a blog name to its numeric ID.
   *
   * Uses cached mapping for efficiency. Cache persists across sessions.
   * Essential for routing from blog URLs to API calls.
   *
   * @param blogName - The blog's URL-safe name (e.g., "myblog")
   *
   * @returns The numeric blog ID, or null if blog doesn't exist
   *
   * @throws {ApiError} With code TIMEOUT if resolution request times out
   *
   * @example
   * ```typescript
   * // Resolve a blog name from URL
   * const blogId = await client.blogs.resolveId('photography-blog');
   * if (blogId) {
   *   const posts = await client.posts.list({ blog_id: blogId });
   * }
   * ```
   *
   * @see {@link resolveName} for reverse lookup (ID → name)
   * @see {@link resolveNames} for batch resolution
   */
  async resolveId(blogName: string): Promise<number | null> {
    return resolveIdentifierCached(blogName);
  }

  /**
   * Resolve a blog ID to its name.
   *
   * Uses cached mapping for efficiency. Useful for displaying blog names
   * when you only have IDs (e.g., from follower lists).
   *
   * @param blogId - The numeric blog ID
   *
   * @returns The blog's URL-safe name, or null if blog doesn't exist
   *
   * @throws {ApiError} With code TIMEOUT if resolution request times out
   *
   * @example
   * ```typescript
   * const name = await client.blogs.resolveName(12345);
   * if (name) {
   *   console.log(`Blog URL: https://bdsmlr.com/${name}`);
   * }
   * ```
   *
   * @see {@link resolveId} for reverse lookup (name → ID)
   * @see {@link resolveNames} for batch resolution (more efficient for lists)
   */
  async resolveName(blogId: number): Promise<string | null> {
    return resolveBlogIdToName(blogId);
  }

  /**
   * Batch resolve multiple blog IDs to names.
   *
   * More efficient than multiple {@link resolveName} calls for lists.
   * Uses parallel API requests with caching.
   *
   * @param blogIds - Array of numeric blog IDs to resolve
   *
   * @returns Map of blog ID to name (null if blog doesn't exist)
   *
   * @example
   * ```typescript
   * // Resolve names for a follower list
   * const followerIds = followers.map(f => f.blogId);
   * const names = await client.blogs.resolveNames(followerIds);
   *
   * followers.forEach(f => {
   *   const name = names.get(f.blogId);
   *   console.log(`Follower: ${name ?? 'unknown'}`);
   * });
   * ```
   */
  async resolveNames(blogIds: number[]): Promise<Map<number, string | null>> {
    return resolveBlogIdsToNames(blogIds);
  }

  /**
   * List followers of a blog.
   *
   * **Note:** This is a legacy endpoint. For full follower/following data,
   * use {@link FollowGraphApi.get} with `direction: 0` (followers).
   *
   * @param req - Request parameters
   * @param req.blog_id - ID of the blog whose followers to list
   * @param req.page_token - Pagination cursor
   * @param req.limit - Maximum results to return
   *
   * @returns Paginated list of follower blog IDs
   *
   * @deprecated Use {@link FollowGraphApi.get} for richer follower data
   */
  async listFollowers(req: ListBlogActivityRequest): Promise<ListBlogActivityResponse> {
    return listBlogFollowers(req);
  }

  /**
   * List blogs a blog is following.
   *
   * **Note:** This is a legacy endpoint. For full follower/following data,
   * use {@link FollowGraphApi.get} with `direction: 1` (following).
   *
   * @param req - Request parameters
   * @param req.blog_id - ID of the blog whose following list to retrieve
   * @param req.page_token - Pagination cursor
   * @param req.limit - Maximum results to return
   *
   * @returns Paginated list of followed blog IDs
   *
   * @deprecated Use {@link FollowGraphApi.get} for richer following data
   */
  async listFollowing(req: ListBlogActivityRequest): Promise<ListBlogActivityResponse> {
    return listBlogFollowing(req);
  }

  // ============================================
  // Unified Methods (TECH-010c)
  // ============================================

  /**
   * Search blogs with unified caching options (TECH-010c).
   *
   * @param req - The search request parameters
   * @param options - Cache options
   * @returns Unified result with data and cache metadata
   */
  async searchWithOptions(
    req: SearchBlogsRequest,
    options: CacheOptions = {}
  ): Promise<UnifiedCacheResult<SearchBlogsResponse>> {
    const { cache = 'none', skipCache, partialRecovery, freshTTL, staleTTL, maxAge } = options;

    // Handle partial recovery first
    if (partialRecovery) {
      const result = await searchBlogsWithPartialRecovery(req);
      return partialToUnifiedResult(result);
    }

    switch (cache) {
      case 'standard': {
        const result = await searchBlogsCached(req, { skipCache });
        return toUnifiedResult(result, 'standard');
      }

      case 'swr': {
        const result = await searchBlogsSWR(req, { freshTTL, staleTTL, maxAge });
        return swrToUnifiedResult(result);
      }

      case 'stale-fallback': {
        const result = await searchBlogsWithFallback(req);
        return staleToUnifiedResult(result);
      }

      case 'none':
      default: {
        const data = await searchBlogs(req);
        return {
          data,
          meta: { fromCache: false },
        };
      }
    }
  }

  /**
   * Get blog details with unified caching options (TECH-010c).
   *
   * @param req - The get blog request parameters
   * @param options - Cache options
   * @returns Unified result with data and cache metadata
   */
  async getWithOptions(
    req: GetBlogRequest,
    options: CacheOptions = {}
  ): Promise<UnifiedCacheResult<GetBlogResponse>> {
    const { cache = 'none', freshTTL, staleTTL, maxAge } = options;

    switch (cache) {
      case 'swr': {
        const result = await getBlogSWR(req, { freshTTL, staleTTL, maxAge });
        return swrToUnifiedResult(result);
      }

      case 'stale-fallback': {
        const result = await getBlogWithFallback(req);
        return staleToUnifiedResult(result);
      }

      case 'standard':
      case 'none':
      default: {
        // Note: getBlog doesn't have a standard cached version,
        // so 'standard' falls through to uncached
        const data = await getBlog(req);
        return {
          data,
          meta: { fromCache: false },
        };
      }
    }
  }
}

/**
 * Follow Graph API namespace.
 *
 * Provides methods for retrieving follower/following relationships for blogs.
 * This is the recommended API for follower data (replaces legacy BlogsApi.listFollowers/listFollowing).
 *
 * The follow graph can retrieve:
 * - **Followers** (direction: 0): Blogs that follow the specified blog
 * - **Following** (direction: 1): Blogs that the specified blog follows
 * - **Both** (direction: 2): Bidirectional relationship data
 *
 * Data is cached with a 2-hour TTL by default since follow relationships
 * change infrequently. Use {@link invalidateCache} after follow/unfollow actions.
 *
 * @example
 * ```typescript
 * // Get all followers of a blog
 * const followers = await client.followGraph.get({
 *   blog_id: 123,
 *   direction: 0  // FOLLOWERS
 * });
 *
 * // Get blogs that a user follows
 * const following = await client.followGraph.getCached({
 *   blog_id: 123,
 *   direction: 1  // FOLLOWING
 * });
 *
 * // Invalidate after follow action
 * await performFollow(targetBlogId);
 * client.followGraph.invalidateCache(myBlogId);
 * ```
 *
 * @see {@link BlogFollowGraphRequest} for request parameters
 * @see {@link FollowGraphDirection} for direction enum values
 */
export class FollowGraphApi {
  /**
   * Get follow graph data for a blog.
   *
   * Retrieves follower and/or following relationships. Results include
   * full blog metadata for related blogs, not just IDs.
   *
   * @param req - Request parameters
   * @param req.blog_id - Numeric ID of the blog (required)
   * @param req.direction - Relationship direction to retrieve:
   *   - 0 (FOLLOWERS): Blogs that follow this blog
   *   - 1 (FOLLOWING): Blogs this blog follows
   *   - 2 (BOTH): Both directions (larger response)
   * @param req.page_token - Pagination cursor from previous response
   * @param req.limit - Maximum results to return (default: 50, max: 200)
   *
   * @returns Follow graph data
   * @returns followers - Array of blogs following this blog (if direction is 0 or 2)
   * @returns following - Array of blogs this blog follows (if direction is 1 or 2)
   * @returns nextPageToken - Cursor for next page
   * @returns totalFollowers - Total follower count
   * @returns totalFollowing - Total following count
   *
   * @throws {ApiError} With code TIMEOUT if request exceeds 30 seconds
   * @throws {ApiError} With code NOT_FOUND if blog doesn't exist
   * @throws {ApiError} With code NETWORK if network request fails
   *
   * @example
   * ```typescript
   * // Get followers with pagination
   * let pageToken: string | undefined;
   * const allFollowers: Blog[] = [];
   *
   * do {
   *   const response = await client.followGraph.get({
   *     blog_id: 12345,
   *     direction: 0,  // FOLLOWERS
   *     page_token: pageToken,
   *     limit: 100
   *   });
   *
   *   if (response.followers) {
   *     allFollowers.push(...response.followers);
   *   }
   *   pageToken = response.nextPageToken;
   * } while (pageToken);
   *
   * console.log(`Total followers: ${allFollowers.length}`);
   * ```
   */
  async get(req: BlogFollowGraphRequest): Promise<BlogFollowGraphResponse> {
    return blogFollowGraph(req);
  }

  /**
   * Get follow graph with TTL-based caching.
   *
   * Caches results for 2 hours since follow relationships change infrequently.
   * Significantly reduces API load for follower pages.
   *
   * @param req - Request parameters (see {@link get} for details)
   * @param options - Caching options
   * @param options.skipCache - Force fresh fetch even if cache is valid
   *
   * @returns Response with `fromCache` indicator
   *
   * @throws {ApiError} Same as {@link get}
   *
   * @example
   * ```typescript
   * // Normal usage - leverages 2-hour cache
   * const result = await client.followGraph.getCached({
   *   blog_id: 123,
   *   direction: 0
   * });
   *
   * // After user action, force refresh
   * await performUnfollow(targetBlogId);
   * const fresh = await client.followGraph.getCached(
   *   { blog_id: 123, direction: 1 },
   *   { skipCache: true }
   * );
   * ```
   *
   * @see {@link get} for non-cached version
   * @see {@link invalidateCache} for cache invalidation
   */
  async getCached(
    req: BlogFollowGraphRequest,
    options?: { skipCache?: boolean }
  ): Promise<BlogFollowGraphResponse & { fromCache: boolean }> {
    return blogFollowGraphCached(req, options);
  }

  /**
   * Get follow graph with stale-while-revalidate caching.
   *
   * Returns cached data immediately, refreshes in background if stale.
   * Ideal for follower counts/lists on profile pages.
   *
   * @param req - Request parameters (see {@link get} for details)
   * @param options - SWR timing options
   * @param options.freshTTL - How long data is considered fresh (default: 60000ms)
   * @param options.staleTTL - How long stale data can be served (default: 7200000ms)
   * @param options.maxAge - Maximum age before eviction (default: 86400000ms)
   *
   * @returns SWR result with cache state indicators
   *
   * @throws {ApiError} Only if no cached data AND API request fails
   *
   * @see {@link PostsApi.listSWR} for detailed SWR documentation
   */
  async getSWR(
    req: BlogFollowGraphRequest,
    options?: { freshTTL?: number; staleTTL?: number; maxAge?: number }
  ): Promise<SWRResult<BlogFollowGraphResponse>> {
    return blogFollowGraphSWR(req, options);
  }

  /**
   * Get follow graph with stale data fallback on errors.
   *
   * Returns cached stale data instead of throwing on transient errors.
   * Essential for displaying follower counts even when API is unavailable.
   *
   * @param req - Request parameters (see {@link get} for details)
   * @returns Result with staleness indicator
   * @throws {ApiError} Only if API fails AND no stale cache exists
   *
   * @see {@link PostsApi.listWithFallback} for detailed fallback documentation
   */
  async getWithFallback(
    req: BlogFollowGraphRequest
  ): Promise<StaleDataResult<BlogFollowGraphResponse>> {
    return blogFollowGraphWithFallback(req);
  }

  /**
   * Get follow graph with partial response recovery.
   *
   * Extracts complete follower/following entries from truncated responses.
   * Useful for large follow graphs on slow connections.
   *
   * @param req - Request parameters (see {@link get} for details)
   * @returns Result with partial recovery metadata
   * @throws {ApiError} If request fails before any data is received
   *
   * @see {@link PostsApi.listWithPartialRecovery} for detailed recovery documentation
   */
  async getWithPartialRecovery(
    req: BlogFollowGraphRequest
  ): Promise<PartialResponseResult<BlogFollowGraphResponse>> {
    return blogFollowGraphWithPartialRecovery(req);
  }

  /**
   * Invalidate cached follow graph for a specific blog.
   *
   * Call this after follow/unfollow actions to ensure fresh data on next request.
   * If no blogId provided, clears the entire follow graph cache.
   *
   * @param blogId - Blog ID to invalidate cache for, or undefined to clear all
   *
   * @example
   * ```typescript
   * // After following a blog
   * await performFollow(targetBlogId);
   * client.followGraph.invalidateCache(myBlogId);  // Refresh "following" list
   *
   * // After bulk unfollow, clear everything
   * client.followGraph.invalidateCache();
   * ```
   */
  invalidateCache(blogId?: number): void {
    invalidateFollowGraphCache(blogId);
  }

  /**
   * Clear all follow graph cache entries.
   *
   * Removes all cached follow graph data. Use sparingly as it forces
   * fresh API calls for all subsequent requests.
   *
   * @example
   * ```typescript
   * // On logout, clear cached social data
   * client.followGraph.clearCache();
   * client.recentActivity.clearCache();
   * ```
   */
  clearCache(): void {
    clearFollowGraphCache();
  }

  /**
   * Get follow graph cache statistics.
   *
   * Returns information about cache size, hit rates, and entry ages.
   * Useful for debugging and monitoring cache efficiency.
   *
   * @returns Cache statistics object
   * @returns size - Number of entries in cache
   * @returns hits - Total cache hits since start
   * @returns misses - Total cache misses since start
   * @returns hitRate - Hit rate percentage (0-100)
   *
   * @example
   * ```typescript
   * const stats = client.followGraph.getCacheStats();
   * console.log(`Cache entries: ${stats.size}`);
   * console.log(`Hit rate: ${stats.hitRate.toFixed(1)}%`);
   * ```
   */
  getCacheStats(): ReturnType<typeof getFollowGraphCacheStats> {
    return getFollowGraphCacheStats();
  }

  // ============================================
  // Unified Methods (TECH-010c)
  // ============================================

  /**
   * Get follow graph with unified caching options (TECH-010c).
   *
   * @param req - The follow graph request parameters
   * @param options - Cache options
   * @returns Unified result with data and cache metadata
   */
  async getWithOptions(
    req: BlogFollowGraphRequest,
    options: CacheOptions = {}
  ): Promise<UnifiedCacheResult<BlogFollowGraphResponse>> {
    const { cache = 'none', skipCache, partialRecovery, freshTTL, staleTTL, maxAge } = options;

    // Handle partial recovery first
    if (partialRecovery) {
      const result = await blogFollowGraphWithPartialRecovery(req);
      return partialToUnifiedResult(result);
    }

    switch (cache) {
      case 'standard': {
        const result = await blogFollowGraphCached(req, { skipCache });
        return toUnifiedResult(result, 'standard');
      }

      case 'swr': {
        const result = await blogFollowGraphSWR(req, { freshTTL, staleTTL, maxAge });
        return swrToUnifiedResult(result);
      }

      case 'stale-fallback': {
        const result = await blogFollowGraphWithFallback(req);
        return staleToUnifiedResult(result);
      }

      case 'none':
      default: {
        const data = await blogFollowGraph(req);
        return {
          data,
          meta: { fromCache: false },
        };
      }
    }
  }
}

/**
 * Recent Activity API namespace.
 *
 * Provides methods for retrieving merged activity feeds from multiple blogs.
 * This is the primary API for building dashboard/timeline views that show
 * posts from blogs the user follows.
 *
 * The server performs the merge operation, sorting posts by timestamp across
 * multiple blogs. This is more efficient than client-side merging for large
 * follow lists.
 *
 * **Important:** This endpoint has a 45-second timeout due to server-side
 * merge complexity. Use caching strategies for better UX.
 *
 * @example
 * ```typescript
 * // Get recent activity from followed blogs
 * const feed = await client.recentActivity.list({
 *   blog_ids: followedBlogIds,
 *   limit: 50
 * });
 *
 * // With SWR for instant dashboard display
 * const dashboard = await client.recentActivity.listSWR({
 *   blog_ids: followedBlogIds
 * });
 * displayPosts(dashboard.data.posts);
 * if (dashboard.revalidating) showRefreshIndicator();
 * ```
 *
 * @see {@link ListBlogsRecentActivityRequest} for request parameters
 */
export class RecentActivityApi {
  /**
   * List recent activity from multiple blogs.
   *
   * Server-side merge of posts from specified blogs, sorted by timestamp.
   * Ideal for building "Following" feeds and dashboards.
   *
   * @param req - Request parameters
   * @param req.blog_ids - Array of blog IDs to fetch activity from (required)
   * @param req.page_token - Pagination cursor from previous response
   * @param req.limit - Maximum posts to return (default: 20, max: 100)
   * @param req.types - Filter by post types (2=IMAGE, 3=VIDEO, etc.)
   *
   * @returns Merged activity feed
   * @returns posts - Array of posts sorted by timestamp (newest first)
   * @returns nextPageToken - Cursor for next page
   *
   * @throws {ApiError} With code TIMEOUT if request exceeds 45 seconds
   * @throws {ApiError} With code NETWORK if network request fails
   * @throws {ApiError} With code SERVER_ERROR if API returns 5xx status
   *
   * @example
   * ```typescript
   * // Build a "Following" feed
   * const followingResponse = await client.followGraph.get({
   *   blog_id: myBlogId,
   *   direction: 1  // FOLLOWING
   * });
   * const followedIds = followingResponse.following?.map(b => b.id) ?? [];
   *
   * const feed = await client.recentActivity.list({
   *   blog_ids: followedIds,
   *   limit: 50
   * });
   *
   * feed.posts.forEach(post => {
   *   displayPost(post);
   * });
   * ```
   */
  async list(
    req: ListBlogsRecentActivityRequest
  ): Promise<ListBlogsRecentActivityResponse> {
    return listBlogsRecentActivity(req);
  }

  /**
   * List recent activity with TTL-based caching.
   *
   * Caches merged feeds for 5 minutes. Reduces server load for
   * repeated dashboard/feed views.
   *
   * @param req - Request parameters (see {@link list} for details)
   * @param options - Caching options
   * @param options.skipCache - Force fresh fetch even if cache is valid
   *
   * @returns Response with `fromCache` indicator
   *
   * @throws {ApiError} Same as {@link list}
   *
   * @see {@link list} for non-cached version
   */
  async listCached(
    req: ListBlogsRecentActivityRequest,
    options?: { skipCache?: boolean }
  ): Promise<ListBlogsRecentActivityResponse & { fromCache: boolean }> {
    return listBlogsRecentActivityCached(req, options);
  }

  /**
   * List recent activity with stale-while-revalidate caching.
   *
   * Returns cached feed immediately, refreshes in background if stale.
   * **Recommended for dashboard pages** where instant display matters.
   *
   * @param req - Request parameters (see {@link list} for details)
   * @param options - SWR timing options
   * @param options.freshTTL - How long data is considered fresh (default: 60000ms)
   * @param options.staleTTL - How long stale data can be served (default: 300000ms)
   * @param options.maxAge - Maximum age before eviction (default: 3600000ms)
   *
   * @returns SWR result with cache state indicators
   *
   * @throws {ApiError} Only if no cached data AND API request fails
   *
   * @see {@link PostsApi.listSWR} for detailed SWR documentation
   */
  async listSWR(
    req: ListBlogsRecentActivityRequest,
    options?: { freshTTL?: number; staleTTL?: number; maxAge?: number }
  ): Promise<SWRResult<ListBlogsRecentActivityResponse>> {
    return listBlogsRecentActivitySWR(req, options);
  }

  /**
   * List recent activity with stale data fallback on errors.
   *
   * Returns cached stale feed instead of throwing on transient errors.
   * Essential for maintaining feed display during API issues.
   *
   * @param req - Request parameters (see {@link list} for details)
   * @returns Result with staleness indicator
   * @throws {ApiError} Only if API fails AND no stale cache exists
   *
   * @see {@link PostsApi.listWithFallback} for detailed fallback documentation
   */
  async listWithFallback(
    req: ListBlogsRecentActivityRequest
  ): Promise<StaleDataResult<ListBlogsRecentActivityResponse>> {
    return listBlogsRecentActivityWithFallback(req);
  }

  /**
   * List recent activity with partial response recovery.
   *
   * Extracts complete posts from truncated responses on timeout.
   * Particularly useful for this endpoint due to its 45-second timeout.
   *
   * @param req - Request parameters (see {@link list} for details)
   * @returns Result with partial recovery metadata
   * @throws {ApiError} If request fails before any data is received
   *
   * @see {@link PostsApi.listWithPartialRecovery} for detailed recovery documentation
   */
  async listWithPartialRecovery(
    req: ListBlogsRecentActivityRequest
  ): Promise<PartialResponseResult<ListBlogsRecentActivityResponse>> {
    return listBlogsRecentActivityWithPartialRecovery(req);
  }

  /**
   * Invalidate cached recent activity for specific blogs.
   *
   * Call this when content changes for blogs in the feed
   * (e.g., user created a new post). If no blogIds provided,
   * clears the entire recent activity cache.
   *
   * @param blogIds - Array of blog IDs to invalidate, or undefined to clear all
   *
   * @example
   * ```typescript
   * // After user creates a post
   * await createPost(myBlogId, postData);
   * client.recentActivity.invalidateCache([myBlogId]);
   *
   * // Force refresh of dashboard
   * const fresh = await client.recentActivity.listCached(
   *   { blog_ids: followedIds },
   *   { skipCache: true }
   * );
   * ```
   */
  invalidateCache(blogIds?: number[]): void {
    invalidateRecentActivityCache(blogIds);
  }

  /**
   * Clear all recent activity cache entries.
   *
   * Removes all cached feed data. Use sparingly.
   *
   * @example
   * ```typescript
   * // On logout, clear all cached data
   * client.recentActivity.clearCache();
   * client.followGraph.clearCache();
   * ```
   */
  clearCache(): void {
    clearRecentActivityCache();
  }

  /**
   * Get recent activity cache statistics.
   *
   * @returns Cache statistics object (see {@link FollowGraphApi.getCacheStats})
   */
  getCacheStats(): ReturnType<typeof getRecentActivityCacheStats> {
    return getRecentActivityCacheStats();
  }

  // ============================================
  // Unified Methods (TECH-010c)
  // ============================================

  /**
   * List recent activity with unified caching options (TECH-010c).
   *
   * @param req - The recent activity request parameters
   * @param options - Cache options
   * @returns Unified result with data and cache metadata
   */
  async listWithOptions(
    req: ListBlogsRecentActivityRequest,
    options: CacheOptions = {}
  ): Promise<UnifiedCacheResult<ListBlogsRecentActivityResponse>> {
    const { cache = 'none', skipCache, partialRecovery, freshTTL, staleTTL, maxAge } = options;

    // Handle partial recovery first
    if (partialRecovery) {
      const result = await listBlogsRecentActivityWithPartialRecovery(req);
      return partialToUnifiedResult(result);
    }

    switch (cache) {
      case 'standard': {
        const result = await listBlogsRecentActivityCached(req, { skipCache });
        return toUnifiedResult(result, 'standard');
      }

      case 'swr': {
        const result = await listBlogsRecentActivitySWR(req, { freshTTL, staleTTL, maxAge });
        return swrToUnifiedResult(result);
      }

      case 'stale-fallback': {
        const result = await listBlogsRecentActivityWithFallback(req);
        return staleToUnifiedResult(result);
      }

      case 'none':
      default: {
        const data = await listBlogsRecentActivity(req);
        return {
          data,
          meta: { fromCache: false },
        };
      }
    }
  }
}

/**
 * Post Engagement API namespace.
 *
 * Provides methods for retrieving engagement data (likes, comments, reblogs)
 * for individual posts. Use these for post detail views and engagement analytics.
 *
 * @example
 * ```typescript
 * // Get engagement data for a post detail view
 * const [likes, comments, reblogs] = await Promise.all([
 *   client.engagement.getLikes(postId),
 *   client.engagement.getComments(postId),
 *   client.engagement.getReblogs(postId)
 * ]);
 *
 * displayEngagement({
 *   likeCount: likes.likes.length,
 *   commentCount: comments.comments.length,
 *   reblogCount: reblogs.reblogs.length
 * });
 * ```
 */
export class EngagementApi {
  /**
   * Get users who liked a post.
   *
   * Returns a list of blogs that have liked the specified post.
   * Useful for "liked by" displays and engagement analytics.
   *
   * @param postId - Numeric ID of the post
   *
   * @returns List of likes with blog info
   * @returns likes - Array of like objects containing blog info
   *
   * @throws {ApiError} With code NOT_FOUND if post doesn't exist
   * @throws {ApiError} With code TIMEOUT if request exceeds 15 seconds
   *
   * @example
   * ```typescript
   * const result = await client.engagement.getLikes(12345);
   * console.log(`${result.likes.length} people liked this post`);
   *
   * result.likes.forEach(like => {
   *   console.log(`Liked by: ${like.blog.name}`);
   * });
   * ```
   */
  async getLikes(postId: number): Promise<ListPostLikesResponse> {
    return listPostLikes(postId);
  }

  /**
   * Get comments on a post.
   *
   * Returns a list of comments on the specified post with commenter info.
   *
   * @param postId - Numeric ID of the post
   *
   * @returns List of comments with blog info and content
   * @returns comments - Array of comment objects
   *
   * @throws {ApiError} With code NOT_FOUND if post doesn't exist
   * @throws {ApiError} With code TIMEOUT if request exceeds 15 seconds
   *
   * @example
   * ```typescript
   * const result = await client.engagement.getComments(12345);
   * result.comments.forEach(comment => {
   *   console.log(`${comment.blog.name}: ${comment.content}`);
   * });
   * ```
   */
  async getComments(postId: number): Promise<ListPostCommentsResponse> {
    return listPostComments(postId);
  }

  /**
   * Get reblogs of a post.
   *
   * Returns a list of blogs that have reblogged the specified post.
   * Useful for tracking content spread and "reblogged by" displays.
   *
   * @param postId - Numeric ID of the post
   *
   * @returns List of reblogs with blog info
   * @returns reblogs - Array of reblog objects containing blog info
   *
   * @throws {ApiError} With code NOT_FOUND if post doesn't exist
   * @throws {ApiError} With code TIMEOUT if request exceeds 15 seconds
   *
   * @example
   * ```typescript
   * const result = await client.engagement.getReblogs(12345);
   * console.log(`Reblogged ${result.reblogs.length} times`);
   *
   * result.reblogs.forEach(reblog => {
   *   console.log(`Reblogged by: ${reblog.blog.name}`);
   * });
   * ```
   */
  async getReblogs(postId: number): Promise<ListPostReblogsResponse> {
    return listPostReblogs(postId);
  }
}

/**
 * Media API namespace.
 *
 * Provides methods for working with media URLs. Handles URL signing for
 * authenticated access to protected media, and validation of image URLs.
 *
 * @example
 * ```typescript
 * // Sign a media URL for authenticated access
 * const signedUrl = await client.media.signUrl(post.imageUrl);
 * img.src = signedUrl;
 *
 * // Validate image before display
 * const exists = await client.media.checkImageExists(avatarUrl);
 * if (!exists) {
 *   avatarUrl = '/default-avatar.png';
 * }
 * ```
 */
export class MediaApi {
  /**
   * Sign a URL for authenticated access.
   *
   * Generates a signed URL with temporary credentials for accessing
   * protected media content. The signed URL has a limited validity period.
   *
   * @param url - The original media URL to sign
   *
   * @returns The signed URL with authentication parameters
   *
   * @throws {ApiError} With code AUTH_REQUIRED if not authenticated
   * @throws {ApiError} With code TIMEOUT if request exceeds 5 seconds
   *
   * @example
   * ```typescript
   * // Sign URLs for post images
   * const signedImages = await Promise.all(
   *   post.images.map(img => client.media.signUrl(img.url))
   * );
   *
   * // Use signed URLs in image elements
   * signedImages.forEach((url, i) => {
   *   imageElements[i].src = url;
   * });
   * ```
   */
  async signUrl(url: string): Promise<string> {
    return signUrl(url);
  }

  /**
   * Check if an image exists at a URL.
   *
   * Performs a HEAD request to verify the image exists and is accessible.
   * Useful for validating URLs before displaying or for fallback logic.
   *
   * @param url - The image URL to check
   *
   * @returns true if image exists and is accessible, false otherwise
   *
   * @example
   * ```typescript
   * // Validate avatar before display
   * const avatarExists = await client.media.checkImageExists(blog.avatarUrl);
   * const displayUrl = avatarExists ? blog.avatarUrl : '/default-avatar.png';
   *
   * // Validate multiple images in parallel
   * const images = ['url1', 'url2', 'url3'];
   * const validResults = await Promise.all(
   *   images.map(url => client.media.checkImageExists(url))
   * );
   * const validImages = images.filter((_, i) => validResults[i]);
   * ```
   */
  async checkImageExists(url: string): Promise<boolean> {
    return checkImageExists(url);
  }
}

/**
 * Identity Resolution API namespace.
 *
 * Provides methods for resolving blog identifiers between names and numeric IDs.
 * Essential for URL routing (name → ID) and display (ID → name).
 *
 * All resolution methods use caching for efficiency. Cache entries persist
 * across sessions in localStorage.
 *
 * **Note:** {@link BlogsApi} provides convenience wrappers for the most
 * common resolution operations. This namespace exposes the full API.
 *
 * @example
 * ```typescript
 * // Resolve blog name from URL to ID for API calls
 * const blogId = await client.identity.resolveNameToId('my-blog');
 *
 * // Resolve IDs to names for display
 * const blogName = await client.identity.resolveIdToName(12345);
 *
 * // Batch resolve for efficiency
 * const names = await client.identity.batchResolveIds([1, 2, 3, 4, 5]);
 * ```
 *
 * @see {@link BlogsApi.resolveId} for the convenience wrapper
 * @see {@link BlogsApi.resolveName} for the convenience wrapper
 */
export class IdentityApi {
  /**
   * Resolve a blog identifier (name or ID).
   *
   * Low-level resolution method that accepts either a blog name or ID
   * and returns full resolution data. For simpler use cases, prefer
   * {@link resolveNameToId} or {@link resolveIdToName}.
   *
   * @param req - Resolution request
   * @param req.identifier - Blog name (string) or ID (number)
   *
   * @returns Full resolution response with both name and ID
   *
   * @throws {ApiError} With code NOT_FOUND if blog doesn't exist
   * @throws {ApiError} With code TIMEOUT if request exceeds 5 seconds
   */
  async resolve(req: ResolveIdentifierRequest): Promise<ResolveIdentifierResponse> {
    return resolveIdentifier(req);
  }

  /**
   * Resolve a blog name to its numeric ID.
   *
   * Uses cached mapping for efficiency. Primary method for URL routing.
   *
   * @param blogName - The blog's URL-safe name (e.g., "my-blog")
   *
   * @returns The numeric blog ID, or null if blog doesn't exist
   *
   * @throws {ApiError} With code TIMEOUT if resolution request times out
   *
   * @example
   * ```typescript
   * // Route URL to API call
   * const blogId = await client.identity.resolveNameToId(urlParams.blogName);
   * if (blogId) {
   *   const posts = await client.posts.list({ blog_id: blogId });
   * } else {
   *   showNotFound();
   * }
   * ```
   *
   * @see {@link BlogsApi.resolveId} for the identical convenience method
   */
  async resolveNameToId(blogName: string): Promise<number | null> {
    return resolveIdentifierCached(blogName);
  }

  /**
   * Resolve a blog ID to its name.
   *
   * Uses cached mapping for efficiency. Useful for generating URLs
   * or display names from numeric IDs.
   *
   * @param blogId - The numeric blog ID
   *
   * @returns The blog's URL-safe name, or null if blog doesn't exist
   *
   * @throws {ApiError} With code TIMEOUT if resolution request times out
   *
   * @example
   * ```typescript
   * const name = await client.identity.resolveIdToName(12345);
   * const profileUrl = name ? `/blog/${name}` : '/not-found';
   * ```
   *
   * @see {@link BlogsApi.resolveName} for the identical convenience method
   */
  async resolveIdToName(blogId: number): Promise<string | null> {
    return resolveBlogIdToName(blogId);
  }

  /**
   * Batch resolve multiple blog IDs to names.
   *
   * More efficient than multiple individual calls. Uses parallel
   * requests with caching.
   *
   * @param blogIds - Array of numeric blog IDs to resolve
   *
   * @returns Map of blog ID to name (null for non-existent blogs)
   *
   * @example
   * ```typescript
   * // Resolve names for a list of followers
   * const followerIds = [123, 456, 789];
   * const names = await client.identity.batchResolveIds(followerIds);
   *
   * followerIds.forEach(id => {
   *   const name = names.get(id) ?? 'unknown';
   *   console.log(`Blog ${id}: ${name}`);
   * });
   * ```
   *
   * @see {@link BlogsApi.resolveNames} for the identical convenience method
   */
  async batchResolveIds(blogIds: number[]): Promise<Map<number, string | null>> {
    return resolveBlogIdsToNames(blogIds);
  }
}

/**
 * Configuration options for ApiClient.
 *
 * @example
 * ```typescript
 * const config: ApiClientConfig = {
 *   baseUrl: 'https://api.bdsmlr.com',
 *   credentials: {
 *     email: process.env.API_EMAIL!,
 *     password: process.env.API_PASSWORD!
 *   },
 *   defaultTimeout: 20000,      // 20 seconds
 *   autoRefresh: true,          // Proactive token refresh
 *   refreshThresholdMinutes: 10 // Refresh 10 min before expiry
 * };
 * ```
 */
export interface ApiClientConfig {
  /**
   * Base URL for API requests.
   * Should include protocol and host, no trailing slash.
   * @example 'https://api.bdsmlr.com'
   */
  baseUrl: string;

  /**
   * Authentication credentials for API access.
   * Used for login and token refresh.
   */
  credentials: {
    /** Email address for authentication */
    email: string;
    /** Password for authentication */
    password: string;
  };

  /**
   * Default request timeout in milliseconds.
   * Individual endpoints may override this with their own timeouts.
   * @default 15000 (15 seconds)
   */
  defaultTimeout?: number;

  /**
   * Whether to enable automatic token refresh before expiry.
   * When enabled, the client proactively refreshes tokens before they expire,
   * preventing authentication errors during requests.
   * @default true
   */
  autoRefresh?: boolean;

  /**
   * Minutes before expiry to trigger proactive token refresh.
   * Only applies when autoRefresh is true.
   * @default 5
   */
  refreshThresholdMinutes?: number;
}

/**
 * Token state tracked by ApiClient instance.
 */
interface TokenState {
  /** Current access token */
  token: string | null;
  /** Token expiry timestamp in milliseconds */
  expiresAt: number | null;
  /** Promise for in-flight login/refresh request (for deduplication) */
  refreshPromise: Promise<string> | null;
}

/**
 * Centralized API client for BDSMLR API (TECH-010).
 *
 * The ApiClient is the main entry point for all API operations. It provides:
 *
 * **Authentication Management:**
 * - Automatic login on first API call
 * - Proactive token refresh before expiry (prevents auth errors mid-request)
 * - Deduplication of concurrent refresh requests (prevents race conditions)
 * - Session persistence via localStorage (survives page reloads)
 *
 * **Namespaced API Access:**
 * - {@link posts} - List and search posts
 * - {@link blogs} - Search blogs, get details, resolve names/IDs
 * - {@link followGraph} - Follower/following relationships
 * - {@link recentActivity} - Merged activity feeds
 * - {@link engagement} - Likes, comments, reblogs
 * - {@link media} - URL signing, image validation
 * - {@link identity} - Blog name/ID resolution
 *
 * **Caching Strategies:**
 * Each API namespace provides multiple caching strategies:
 * - Basic (no cache) - Always fresh data
 * - Cached - TTL-based caching
 * - SWR - Stale-while-revalidate for instant UI
 * - WithFallback - Stale data on errors
 * - WithPartialRecovery - Extract data from truncated responses
 * - WithOptions - Unified interface for all strategies
 *
 * @example Basic Usage
 * ```typescript
 * // Create client (typically once at app init)
 * const client = new ApiClient({
 *   baseUrl: 'https://api.bdsmlr.com',
 *   credentials: {
 *     email: import.meta.env.VITE_AUTH_EMAIL,
 *     password: import.meta.env.VITE_AUTH_PASSWORD
 *   }
 * });
 *
 * // Use namespaced methods for API calls
 * const posts = await client.posts.list({ blog_id: 123 });
 * const blogs = await client.blogs.search({ query: 'art' });
 * ```
 *
 * @example Caching Strategies
 * ```typescript
 * // Standard caching - reduces API calls
 * const cached = await client.posts.listCached({ blog_id: 123 });
 *
 * // SWR - instant display, background refresh
 * const swr = await client.posts.listSWR({ blog_id: 123 });
 * if (swr.revalidating) showRefreshIndicator();
 *
 * // Fallback - resilient to network issues
 * const fallback = await client.posts.listWithFallback({ blog_id: 123 });
 * if (fallback.isStale) showStaleDataWarning();
 *
 * // Unified interface - one method, all strategies
 * const unified = await client.posts.listWithOptions(req, {
 *   cache: 'swr',
 *   partialRecovery: true
 * });
 * ```
 *
 * @example Authentication
 * ```typescript
 * // Token is managed automatically, but you can also:
 * const token = await client.getToken();  // Get current token
 * const isAuth = client.isAuthenticated();  // Check auth status
 * client.clearAuth();  // Force re-authentication
 * ```
 *
 * @see {@link ApiClientConfig} for configuration options
 * @see {@link PostsApi} for posts operations
 * @see {@link BlogsApi} for blogs operations
 * @see {@link FollowGraphApi} for follower/following operations
 */
export class ApiClient {
  private readonly config: Required<ApiClientConfig>;
  private tokenState: TokenState;

  // ============================================
  // Namespaced API Instances (TECH-010b)
  // ============================================
  // Each namespace provides a focused set of methods for a specific API domain.
  // Usage: client.posts.list(), client.blogs.search(), client.followGraph.get(), etc.

  /**
   * Posts API namespace.
   * Methods: list, listCached, listSWR, listWithFallback, listWithPartialRecovery,
   *          search, searchCached, searchSWR, searchWithFallback, searchWithPartialRecovery
   */
  readonly posts: PostsApi;

  /**
   * Blogs API namespace.
   * Methods: search, searchCached, searchSWR, searchWithFallback, searchWithPartialRecovery,
   *          get, getSWR, getWithFallback, resolveId, resolveName, resolveNames,
   *          listFollowers, listFollowing
   */
  readonly blogs: BlogsApi;

  /**
   * Follow Graph API namespace.
   * Methods: get, getCached, getSWR, getWithFallback, getWithPartialRecovery,
   *          invalidateCache, clearCache, getCacheStats
   */
  readonly followGraph: FollowGraphApi;

  /**
   * Recent Activity API namespace (merged feeds from multiple blogs).
   * Methods: list, listCached, listSWR, listWithFallback, listWithPartialRecovery,
   *          invalidateCache, clearCache, getCacheStats
   */
  readonly recentActivity: RecentActivityApi;

  /**
   * Post Engagement API namespace (likes, comments, reblogs).
   * Methods: getLikes, getComments, getReblogs
   */
  readonly engagement: EngagementApi;

  /**
   * Media API namespace (URL signing, image validation).
   * Methods: signUrl, checkImageExists
   */
  readonly media: MediaApi;

  /**
   * Identity Resolution API namespace.
   * Methods: resolve, resolveNameToId, resolveIdToName, batchResolveIds
   */
  readonly identity: IdentityApi;

  /**
   * Create a new ApiClient instance.
   *
   * @param config - Configuration options including base URL and credentials
   */
  constructor(config: ApiClientConfig) {
    // Apply defaults for optional config options
    this.config = {
      baseUrl: config.baseUrl,
      credentials: config.credentials,
      defaultTimeout: config.defaultTimeout ?? DEFAULT_REQUEST_TIMEOUT,
      autoRefresh: config.autoRefresh ?? true,
      refreshThresholdMinutes: config.refreshThresholdMinutes ?? 5,
    };

    // Initialize token state
    this.tokenState = {
      token: null,
      expiresAt: null,
      refreshPromise: null,
    };

    // Initialize namespaced API instances
    this.posts = new PostsApi();
    this.blogs = new BlogsApi();
    this.followGraph = new FollowGraphApi();
    this.recentActivity = new RecentActivityApi();
    this.engagement = new EngagementApi();
    this.media = new MediaApi();
    this.identity = new IdentityApi();

    // Try to load existing token from storage
    this.loadStoredToken();
  }

  /**
   * Load token from localStorage if available and not expired.
   * This allows the client to resume sessions without re-authenticating.
   */
  private loadStoredToken(): void {
    const stored = getValidToken();
    if (stored) {
      this.tokenState.token = stored;
      // We don't know exact expiry from storage, but getValidToken checks it
      // Set a placeholder expiry that will trigger refresh check
      this.tokenState.expiresAt = Date.now() + this.config.refreshThresholdMinutes * 60 * 1000 + 1;
    }
  }

  /**
   * Authenticate with the API and obtain an access token.
   *
   * @returns The access token
   * @throws Error if authentication fails
   */
  async login(): Promise<string> {
    const resp = await fetch(`${this.config.baseUrl}/v2/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({
        email: this.config.credentials.email,
        password: this.config.credentials.password,
      }),
    });

    const data: LoginResponse = await resp.json();

    if (data.error || !data.access_token) {
      throw new Error(data.error || 'Login failed');
    }

    // Calculate expiry timestamp
    const expiresIn = data.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    // Update instance state
    this.tokenState.token = data.access_token;
    this.tokenState.expiresAt = expiresAt;

    // Persist to storage (for session continuity)
    setToken(data.access_token, expiresIn);

    return data.access_token;
  }

  /**
   * Check if the current token needs to be refreshed.
   *
   * @returns true if token is expired or will expire within the refresh threshold
   */
  private tokenNeedsRefresh(): boolean {
    if (!this.tokenState.token || !this.tokenState.expiresAt) {
      return true;
    }

    // Check if token expires within the threshold
    const thresholdMs = this.config.refreshThresholdMinutes * 60 * 1000;
    return Date.now() > this.tokenState.expiresAt - thresholdMs;
  }

  /**
   * Proactively refresh the token if it's about to expire.
   * This method deduplicates concurrent refresh requests.
   *
   * @returns Promise that resolves when refresh is complete (or unnecessary)
   */
  async refreshTokenIfNeeded(): Promise<void> {
    if (!this.config.autoRefresh) {
      return;
    }

    // Also check the global storage token
    if (!this.tokenNeedsRefresh() && !tokenNeedsRefresh()) {
      return;
    }

    // Dedupe concurrent refresh requests
    if (this.tokenState.refreshPromise) {
      await this.tokenState.refreshPromise;
      return;
    }

    try {
      this.tokenState.refreshPromise = this.login();
      await this.tokenState.refreshPromise;
    } finally {
      this.tokenState.refreshPromise = null;
    }
  }

  /**
   * Get a valid access token, refreshing if necessary.
   *
   * This method:
   * 1. Proactively refreshes if token is about to expire
   * 2. Returns cached token if available and valid
   * 3. Authenticates if no valid token exists
   *
   * @returns A valid access token
   * @throws Error if authentication fails
   */
  async getToken(): Promise<string> {
    // Check if we need proactive refresh
    await this.refreshTokenIfNeeded();

    // Return cached token if available
    if (this.tokenState.token) {
      return this.tokenState.token;
    }

    // Check storage for persisted token
    const stored = getValidToken();
    if (stored) {
      this.tokenState.token = stored;
      return stored;
    }

    // No valid token - must authenticate
    return this.login();
  }

  /**
   * Clear the current authentication state.
   * Use this after receiving a 401 response to force re-authentication.
   */
  clearAuth(): void {
    this.tokenState.token = null;
    this.tokenState.expiresAt = null;
    this.tokenState.refreshPromise = null;
    clearToken();
  }

  /**
   * Check if the client currently has a valid token.
   *
   * @returns true if a non-expired token is available
   */
  isAuthenticated(): boolean {
    if (!this.tokenState.token) {
      return !!getValidToken();
    }

    if (!this.tokenState.expiresAt) {
      return false;
    }

    return Date.now() < this.tokenState.expiresAt;
  }

  /**
   * Get the configured base URL for API requests.
   *
   * @returns The base URL string
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Get the default request timeout in milliseconds.
   *
   * @returns The default timeout value
   */
  getDefaultTimeout(): number {
    return this.config.defaultTimeout;
  }
}

// ============================================
// Default ApiClient Instance
// ============================================
// Create a default instance using environment variables for backwards compatibility.
// Page scripts can import this instance or create their own with custom config.

/**
 * Default ApiClient instance configured from environment variables.
 *
 * Uses:
 * - VITE_API_BASE_URL for base URL
 * - VITE_AUTH_EMAIL for email
 * - VITE_AUTH_PASSWORD for password
 *
 * @example
 * ```typescript
 * import { defaultApiClient } from './api.js';
 *
 * const token = await defaultApiClient.getToken();
 * ```
 */
export const defaultApiClient = new ApiClient({
  baseUrl: API_BASE,
  credentials: {
    email: AUTH_EMAIL,
    password: AUTH_PASSWORD,
  },
});
