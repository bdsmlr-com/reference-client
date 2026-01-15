/**
 * Unified Storage Service
 *
 * Centralizes all localStorage operations with type-safety,
 * expiry management, and migration support.
 */

// Storage keys
const KEYS = {
  TOKEN: 'bdsmlr_token',
  TOKEN_EXPIRY: 'bdsmlr_token_expiry',
  THEME: 'bdsmlr_theme',
  CURRENT_BLOG: 'bdsmlr_current_blog',
  ACTIVITY_BLOGS: 'bdsmlr_activity_blogs',
  BLOG_CACHE: 'bdsmlr_blog_cache',
  BLOG_ID_CACHE: 'bdsmlr_blog_id_cache', // Reverse cache: blogId -> blogName
  BLOG_AVATAR_CACHE: 'bdsmlr_blog_avatar_cache', // Avatar URL cache: blogId -> avatarUrl (SOC-016)
  POST_BUFFER: 'bdsmlr_post_buffer',
  PREFS: 'bdsmlr_prefs',
  STORAGE_VERSION: 'bdsmlr_storage_version',
  SEARCH_CACHE: 'bdsmlr_search_cache', // Search results cache
  RESPONSE_CACHE: 'bdsmlr_response_cache', // API response cache for stale fallback
  FOLLOW_GRAPH_CACHE: 'bdsmlr_follow_graph_cache', // Follow graph cache (CACHE-006)
  RECENT_ACTIVITY_CACHE: 'bdsmlr_recent_activity_cache', // Recent activity cache (CACHE-007)
  BLOG_SEARCH_CACHE: 'bdsmlr_blog_search_cache', // Blog search cache (CACHE-008)
  SWR_CACHE: 'bdsmlr_swr_cache', // Stale-while-revalidate cache (CACHE-004)
  PAGINATION_CURSOR_CACHE: 'bdsmlr_pagination_cursor_cache', // Pagination cursor cache (CACHE-003)
  HTTP_CACHE: 'bdsmlr_http_cache', // HTTP ETag/Last-Modified cache (CACHE-005)
} as const;

// Current storage version for migration
const CURRENT_VERSION = 1;

// Types
export type Theme = 'dark' | 'light' | 'system';
export type VariantSelection = 'all' | 'original' | 'reblog';

export interface UserPreferences {
  // Filter defaults
  postVariant: VariantSelection;
  postTypes: number[];

  // UI preferences
  infiniteScroll: boolean;
  compactMode: boolean;

  // Per-page overrides (optional)
  pagePrefs?: {
    [pageName: string]: {
      postVariant?: VariantSelection;
      postTypes?: number[];
      infiniteScroll?: boolean;
    };
  };
}

export interface BlogCacheEntry {
  blogId: number | null;
  timestamp: number;
}

export interface BlogCache {
  [blogName: string]: BlogCacheEntry;
}

export interface BlogIdCacheEntry {
  blogName: string | null;
  timestamp: number;
}

export interface BlogIdCache {
  [blogId: string]: BlogIdCacheEntry; // Key is string since object keys must be strings
}

// Avatar cache types (SOC-016)
export interface BlogAvatarCacheEntry {
  avatarUrl: string | null; // null means no avatar / fetch attempted but none found
  timestamp: number;
}

export interface BlogAvatarCache {
  [blogId: string]: BlogAvatarCacheEntry; // Key is string since object keys must be strings
}

export interface SearchCacheEntry<T = unknown> {
  response: T;
  timestamp: number;
}

export interface SearchCache {
  [cacheKey: string]: SearchCacheEntry;
}

// Response cache for stale fallback (CONN-002)
export interface ResponseCacheEntry<T = unknown> {
  response: T;
  timestamp: number;
  endpoint: string; // For debugging/logging
}

export interface ResponseCache {
  [cacheKey: string]: ResponseCacheEntry;
}

export interface CachedResponse<T> {
  data: T;
  isStale: boolean;
  cachedAt: number;
}

// Follow graph cache types (CACHE-006)
export interface FollowGraphCacheEntry<T = unknown> {
  response: T;
  timestamp: number;
  blogId: number;
  direction: 'followers' | 'following';
}

export interface FollowGraphCache {
  [cacheKey: string]: FollowGraphCacheEntry;
}

// Recent activity cache types (CACHE-007)
export interface RecentActivityCacheEntry<T = unknown> {
  response: T;
  timestamp: number;
  blogIds: number[]; // The blog IDs this cache entry covers
  globalMerge: boolean;
}

export interface RecentActivityCache {
  [cacheKey: string]: RecentActivityCacheEntry;
}

// Blog search cache types (CACHE-008)
export interface BlogSearchCacheEntry<T = unknown> {
  response: T;
  timestamp: number;
  query: string; // The search query (for debugging)
}

export interface BlogSearchCache {
  [cacheKey: string]: BlogSearchCacheEntry;
}

// Stale-While-Revalidate cache types (CACHE-004)
export interface SWRCacheEntry<T = unknown> {
  response: T;
  timestamp: number;
  endpoint: string;
  revalidating: boolean; // True if a background revalidation is in progress
  revalidationPromiseId?: string; // Unique ID to track revalidation deduplication
}

export interface SWRCache {
  [cacheKey: string]: SWRCacheEntry;
}

/**
 * Result from SWR cache lookup.
 * - data: The cached data
 * - isFresh: True if data is within fresh TTL
 * - isStale: True if data is beyond fresh TTL but still servable
 * - needsRevalidation: True if data should be revalidated in background
 * - cachedAt: Timestamp when data was cached
 */
export interface SWRCacheResult<T> {
  data: T;
  isFresh: boolean;
  isStale: boolean;
  needsRevalidation: boolean;
  cachedAt: number;
}

// Pagination cursor cache types (CACHE-003)
/**
 * Entry for pagination cursor cache.
 * Stores the state needed to resume infinite scroll from a previous position.
 */
export interface PaginationCursorEntry {
  cursor: string | null; // The API pagination cursor (nextPageToken)
  scrollPosition: number; // Window scroll position in pixels
  itemCount: number; // Number of items loaded at time of save
  timestamp: number; // When this entry was saved
  exhausted: boolean; // Whether all pages were loaded
}

export interface PaginationCursorCache {
  [pageKey: string]: PaginationCursorEntry;
}

// HTTP cache types for ETag/Last-Modified (CACHE-005)
export interface HttpCacheEntry<T = unknown> {
  response: T;
  etag: string | null;
  lastModified: string | null;
  timestamp: number;
  endpoint: string;
}

export interface HttpCache {
  [cacheKey: string]: HttpCacheEntry;
}

// Default preferences
const DEFAULT_PREFS: UserPreferences = {
  postVariant: 'all',
  postTypes: [],
  infiniteScroll: true,
  compactMode: false,
};

// Cache TTLs
const BLOG_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const BLOG_NOT_FOUND_TTL = 60 * 60 * 1000; // 1 hour
const MAX_BLOG_CACHE_ENTRIES = 500;

// Avatar cache configuration (SOC-016)
// Avatars change infrequently, so 24-hour TTL is appropriate
const AVATAR_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const AVATAR_NOT_FOUND_TTL = 60 * 60 * 1000; // 1 hour for blogs with no avatar
const MAX_AVATAR_CACHE_ENTRIES = 500;

// Search cache configuration
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_SEARCH_CACHE_ENTRIES = 50; // Limit number of cached searches

// Response cache configuration (stale fallback - CONN-002)
const RESPONSE_CACHE_FRESH_TTL = 5 * 60 * 1000; // 5 minutes - data is "fresh"
const RESPONSE_CACHE_STALE_TTL = 60 * 60 * 1000; // 1 hour - data can be served stale
const MAX_RESPONSE_CACHE_ENTRIES = 100; // Limit total cached responses

// Follow graph cache configuration (CACHE-006, CACHE-009)
// Follow relationships change infrequently (1-4 hours typical), so longer TTL is appropriate
const FOLLOW_GRAPH_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours (was 30 minutes, increased per CACHE-009)
const MAX_FOLLOW_GRAPH_CACHE_ENTRIES = 50; // Limit number of cached follow graphs

// Recent activity cache configuration (CACHE-007)
// Activity data changes frequently, so shorter TTL is appropriate
const RECENT_ACTIVITY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RECENT_ACTIVITY_CACHE_ENTRIES = 30; // Limit number of cached activity feeds

// Blog search cache configuration (CACHE-008)
// Blog metadata changes infrequently; 10 minutes is reasonable for search results
const BLOG_SEARCH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_BLOG_SEARCH_CACHE_ENTRIES = 30; // Limit number of cached blog searches

// Stale-While-Revalidate cache configuration (CACHE-004)
// SWR returns cached data immediately (even if stale), then revalidates in background
const SWR_CACHE_FRESH_TTL = 30 * 1000; // 30 seconds - data is "fresh", no revalidation needed
const SWR_CACHE_STALE_TTL = 5 * 60 * 1000; // 5 minutes - data is "stale" but servable, needs revalidation
const SWR_CACHE_MAX_AGE = 60 * 60 * 1000; // 1 hour - data too old, must fetch fresh
const MAX_SWR_CACHE_ENTRIES = 100; // Limit total cached entries

// Pagination cursor cache configuration (CACHE-003)
// Stores pagination cursors and scroll positions for resumable infinite scroll
const PAGINATION_CURSOR_CACHE_TTL = 30 * 60 * 1000; // 30 minutes - reasonable time to return to page
const MAX_PAGINATION_CURSOR_ENTRIES = 20; // Limit number of cached page positions

// HTTP ETag/Last-Modified cache configuration (CACHE-005)
// Stores ETag and Last-Modified headers for conditional requests
// Long TTL since we use server headers to validate; cache only evicted when server says changed
const HTTP_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours - server validation determines freshness
const MAX_HTTP_CACHE_ENTRIES = 200; // Higher limit since these are validated by server

// Token refresh buffer (5 minutes before expiry)
const TOKEN_REFRESH_BUFFER = 5 * 60;

/**
 * Initialize storage - run migrations if needed
 */
export function initStorage(): void {
  const version = getStorageVersion();
  if (version < CURRENT_VERSION) {
    runMigrations(version);
    setStorageVersion(CURRENT_VERSION);
  }
}

function getStorageVersion(): number {
  const stored = localStorage.getItem(KEYS.STORAGE_VERSION);
  return stored ? parseInt(stored, 10) : 0;
}

function setStorageVersion(version: number): void {
  localStorage.setItem(KEYS.STORAGE_VERSION, version.toString());
}

/**
 * Run migrations from one version to another.
 *
 * Migration Guide:
 * - When you need to change the storage schema, increment CURRENT_VERSION
 * - Add a new migration block: if (fromVersion < N) { ... migrate to N ... }
 * - Migrations should be idempotent and backward-compatible
 * - Always migrate data, never delete user data unless necessary
 *
 * Example migration:
 *   if (fromVersion < 2) {
 *     // v1 -> v2: Renamed 'bdsmlr_theme' values from 'auto' to 'system'
 *     const theme = localStorage.getItem('bdsmlr_theme');
 *     if (theme === 'auto') {
 *       localStorage.setItem('bdsmlr_theme', 'system');
 *     }
 *   }
 */
function runMigrations(fromVersion: number): void {
  // v0 -> v1: Initial version, no migrations needed
  if (fromVersion < 1) {
    // Clean up any legacy keys from before unified storage
    const legacyKeys = ['theme', 'token', 'blogId', 'currentBlog'];
    for (const key of legacyKeys) {
      const value = localStorage.getItem(key);
      if (value) {
        // Only migrate if not already using new keys
        const newKey = `bdsmlr_${key}`;
        if (!localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, value);
        }
        localStorage.removeItem(key);
      }
    }
  }

  // Future migrations go here:
  // if (fromVersion < 2) { ... }

  console.log(`Storage migrated from v${fromVersion} to v${CURRENT_VERSION}`);
}

// ============================================
// Token Management
// ============================================

export interface TokenInfo {
  token: string;
  expiresAt: number; // Unix timestamp in seconds
}

export function getToken(): TokenInfo | null {
  const token = localStorage.getItem(KEYS.TOKEN);
  const expiry = localStorage.getItem(KEYS.TOKEN_EXPIRY);

  if (!token || !expiry) {
    return null;
  }

  const expiresAt = parseInt(expiry, 10);
  return { token, expiresAt };
}

export function setToken(token: string, expiresIn: number): void {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  localStorage.setItem(KEYS.TOKEN, token);
  localStorage.setItem(KEYS.TOKEN_EXPIRY, expiresAt.toString());
}

export function clearToken(): void {
  localStorage.removeItem(KEYS.TOKEN);
  localStorage.removeItem(KEYS.TOKEN_EXPIRY);
}

/**
 * Check if token is valid and not close to expiry
 */
export function isTokenValid(): boolean {
  const info = getToken();
  if (!info) return false;

  const now = Math.floor(Date.now() / 1000);
  return now < info.expiresAt - 60; // 60 second buffer
}

/**
 * Check if token needs refresh (within 5 minutes of expiry)
 */
export function tokenNeedsRefresh(): boolean {
  const info = getToken();
  if (!info) return true; // No token = needs refresh

  const now = Math.floor(Date.now() / 1000);
  return now >= info.expiresAt - TOKEN_REFRESH_BUFFER;
}

/**
 * Get valid token string or null if expired
 */
export function getValidToken(): string | null {
  if (!isTokenValid()) {
    clearToken();
    return null;
  }
  return getToken()?.token || null;
}

// ============================================
// Theme Management
// ============================================

export function getTheme(): Theme {
  const stored = localStorage.getItem(KEYS.THEME);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(KEYS.THEME, theme);
}

export function getEffectiveTheme(): 'dark' | 'light' {
  const theme = getTheme();
  if (theme === 'system') {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }
  return theme;
}

// ============================================
// Current Blog Management
// ============================================

export function getCurrentBlog(): string {
  return localStorage.getItem(KEYS.CURRENT_BLOG) || '';
}

export function setCurrentBlog(blogName: string): void {
  if (blogName) {
    localStorage.setItem(KEYS.CURRENT_BLOG, blogName);
  } else {
    localStorage.removeItem(KEYS.CURRENT_BLOG);
  }
}

export function clearCurrentBlog(): void {
  localStorage.removeItem(KEYS.CURRENT_BLOG);
}

// ============================================
// Activity Blogs Management
// ============================================

export function getActivityBlogs(): string[] {
  try {
    const stored = localStorage.getItem(KEYS.ACTIVITY_BLOGS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function setActivityBlogs(blogs: string[]): void {
  localStorage.setItem(KEYS.ACTIVITY_BLOGS, JSON.stringify(blogs));
}

export function clearActivityBlogs(): void {
  localStorage.removeItem(KEYS.ACTIVITY_BLOGS);
}

// ============================================
// Blog Cache Management
// ============================================

function getBlogCache(): BlogCache {
  try {
    return JSON.parse(localStorage.getItem(KEYS.BLOG_CACHE) || '{}');
  } catch {
    return {};
  }
}

function setBlogCache(cache: BlogCache): void {
  localStorage.setItem(KEYS.BLOG_CACHE, JSON.stringify(cache));
}

export function getCachedBlogId(blogName: string): number | null | undefined {
  const cache = getBlogCache();
  const key = blogName.toLowerCase();
  const entry = cache[key];

  if (!entry) {
    return undefined; // Cache miss
  }

  const ttl = entry.blogId === null ? BLOG_NOT_FOUND_TTL : BLOG_CACHE_TTL;
  if (Date.now() > entry.timestamp + ttl) {
    return undefined; // Expired
  }

  return entry.blogId; // Cache hit (may be null for "not found")
}

export function setCachedBlogId(blogName: string, blogId: number | null): void {
  const cache = getBlogCache();
  const key = blogName.toLowerCase();

  // Evict old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= MAX_BLOG_CACHE_ENTRIES) {
    // Sort by timestamp and remove oldest 100
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, 100);
    for (const [name] of toRemove) {
      delete cache[name];
    }
  }

  cache[key] = {
    blogId,
    timestamp: Date.now(),
  };

  setBlogCache(cache);
}

export function clearBlogCache(): void {
  localStorage.removeItem(KEYS.BLOG_CACHE);
}

// ============================================
// Blog ID Cache Management (Reverse: blogId -> blogName)
// ============================================

function getBlogIdCache(): BlogIdCache {
  try {
    return JSON.parse(localStorage.getItem(KEYS.BLOG_ID_CACHE) || '{}');
  } catch {
    return {};
  }
}

function setBlogIdCache(cache: BlogIdCache): void {
  localStorage.setItem(KEYS.BLOG_ID_CACHE, JSON.stringify(cache));
}

export function getCachedBlogName(blogId: number): string | null | undefined {
  const cache = getBlogIdCache();
  const key = blogId.toString();
  const entry = cache[key];

  if (!entry) {
    return undefined; // Cache miss
  }

  const ttl = entry.blogName === null ? BLOG_NOT_FOUND_TTL : BLOG_CACHE_TTL;
  if (Date.now() > entry.timestamp + ttl) {
    return undefined; // Expired
  }

  return entry.blogName; // Cache hit (may be null for "not found")
}

export function setCachedBlogName(blogId: number, blogName: string | null): void {
  const cache = getBlogIdCache();
  const key = blogId.toString();

  // Evict old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= MAX_BLOG_CACHE_ENTRIES) {
    // Sort by timestamp and remove oldest 100
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, 100);
    for (const [id] of toRemove) {
      delete cache[id];
    }
  }

  cache[key] = {
    blogName,
    timestamp: Date.now(),
  };

  setBlogIdCache(cache);
}

export function clearBlogIdCache(): void {
  localStorage.removeItem(KEYS.BLOG_ID_CACHE);
}

// ============================================
// Blog Avatar Cache Management (SOC-016)
// ============================================

function getBlogAvatarCache(): BlogAvatarCache {
  try {
    return JSON.parse(localStorage.getItem(KEYS.BLOG_AVATAR_CACHE) || '{}');
  } catch {
    return {};
  }
}

function setBlogAvatarCache(cache: BlogAvatarCache): void {
  localStorage.setItem(KEYS.BLOG_AVATAR_CACHE, JSON.stringify(cache));
}

/**
 * Get cached avatar URL for a blog ID.
 * @returns avatarUrl string if found, null if explicitly no avatar, undefined if cache miss
 */
export function getCachedAvatarUrl(blogId: number): string | null | undefined {
  const cache = getBlogAvatarCache();
  const key = blogId.toString();
  const entry = cache[key];

  if (!entry) {
    return undefined; // Cache miss
  }

  const ttl = entry.avatarUrl === null ? AVATAR_NOT_FOUND_TTL : AVATAR_CACHE_TTL;
  if (Date.now() > entry.timestamp + ttl) {
    return undefined; // Expired
  }

  return entry.avatarUrl; // Cache hit (may be null for "no avatar")
}

/**
 * Store avatar URL in cache.
 * @param blogId The blog ID
 * @param avatarUrl The avatar URL, or null if the blog has no avatar
 */
export function setCachedAvatarUrl(blogId: number, avatarUrl: string | null): void {
  const cache = getBlogAvatarCache();
  const key = blogId.toString();

  // Evict old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= MAX_AVATAR_CACHE_ENTRIES) {
    // Sort by timestamp and remove oldest 100
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, 100);
    for (const [id] of toRemove) {
      delete cache[id];
    }
  }

  cache[key] = {
    avatarUrl,
    timestamp: Date.now(),
  };

  setBlogAvatarCache(cache);
}

/**
 * Clear all avatar cache entries.
 */
export function clearBlogAvatarCache(): void {
  localStorage.removeItem(KEYS.BLOG_AVATAR_CACHE);
}

// ============================================
// Search Cache Management
// ============================================

function getSearchCache(): SearchCache {
  try {
    return JSON.parse(localStorage.getItem(KEYS.SEARCH_CACHE) || '{}');
  } catch {
    return {};
  }
}

function setSearchCache(cache: SearchCache): void {
  localStorage.setItem(KEYS.SEARCH_CACHE, JSON.stringify(cache));
}

/**
 * Generate a cache key from search request parameters
 */
export function generateSearchCacheKey(request: Record<string, unknown>): string {
  // Create a deterministic string from the request
  // Sort keys to ensure consistent ordering
  const sortedKeys = Object.keys(request).sort();
  const parts: string[] = [];
  for (const key of sortedKeys) {
    const value = request[key];
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        parts.push(`${key}:${value.slice().sort().join(',')}`);
      } else {
        parts.push(`${key}:${value}`);
      }
    }
  }
  return parts.join('|');
}

/**
 * Get cached search result
 * @returns The cached response or undefined if not found/expired
 */
export function getCachedSearchResult<T>(cacheKey: string): T | undefined {
  const cache = getSearchCache();
  const entry = cache[cacheKey];

  if (!entry) {
    return undefined; // Cache miss
  }

  if (Date.now() > entry.timestamp + SEARCH_CACHE_TTL) {
    return undefined; // Expired
  }

  return entry.response as T;
}

/**
 * Set search result in cache
 */
export function setCachedSearchResult<T>(cacheKey: string, response: T): void {
  const cache = getSearchCache();

  // Evict old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= MAX_SEARCH_CACHE_ENTRIES) {
    // Sort by timestamp and remove oldest half
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.floor(MAX_SEARCH_CACHE_ENTRIES / 2);
    for (let i = 0; i < toRemove; i++) {
      delete cache[entries[i][0]];
    }
  }

  cache[cacheKey] = {
    response,
    timestamp: Date.now(),
  };

  setSearchCache(cache);
}

/**
 * Clear all search cache entries
 */
export function clearSearchCache(): void {
  localStorage.removeItem(KEYS.SEARCH_CACHE);
}

/**
 * Clear expired search cache entries only
 */
export function pruneSearchCache(): void {
  const cache = getSearchCache();
  const now = Date.now();
  let changed = false;

  for (const key of Object.keys(cache)) {
    if (now > cache[key].timestamp + SEARCH_CACHE_TTL) {
      delete cache[key];
      changed = true;
    }
  }

  if (changed) {
    setSearchCache(cache);
  }
}

// ============================================
// Response Cache Management (Stale Fallback - CONN-002)
// ============================================

function getResponseCache(): ResponseCache {
  try {
    return JSON.parse(localStorage.getItem(KEYS.RESPONSE_CACHE) || '{}');
  } catch {
    return {};
  }
}

function setResponseCache(cache: ResponseCache): void {
  localStorage.setItem(KEYS.RESPONSE_CACHE, JSON.stringify(cache));
}

/**
 * Generate a cache key from endpoint and request body
 */
export function generateResponseCacheKey(endpoint: string, body: unknown): string {
  const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);
  // Use a simple hash-like approach for the key
  return `${endpoint}:${bodyStr}`;
}

/**
 * Get cached API response with staleness information.
 * Returns fresh data if within fresh TTL.
 * Returns stale data (with isStale=true) if within stale TTL.
 * Returns undefined if no cache or beyond stale TTL.
 */
export function getCachedResponse<T>(cacheKey: string): CachedResponse<T> | undefined {
  const cache = getResponseCache();
  const entry = cache[cacheKey];

  if (!entry) {
    return undefined; // Cache miss
  }

  const now = Date.now();
  const age = now - entry.timestamp;

  // Beyond stale TTL - data is too old
  if (age > RESPONSE_CACHE_STALE_TTL) {
    return undefined;
  }

  // Return data with staleness indicator
  return {
    data: entry.response as T,
    isStale: age > RESPONSE_CACHE_FRESH_TTL,
    cachedAt: entry.timestamp,
  };
}

/**
 * Check if we have stale data available for a cache key.
 * Returns true if there's cached data that can be served as fallback.
 */
export function hasStaleData(cacheKey: string): boolean {
  return getCachedResponse(cacheKey) !== undefined;
}

/**
 * Get stale cached response for fallback when API fails.
 * This bypasses the fresh TTL and returns any data within stale TTL.
 */
export function getStaleResponse<T>(cacheKey: string): CachedResponse<T> | undefined {
  return getCachedResponse<T>(cacheKey);
}

/**
 * Store API response in cache
 */
export function setCachedResponse<T>(cacheKey: string, response: T, endpoint: string): void {
  const cache = getResponseCache();

  // Evict old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= MAX_RESPONSE_CACHE_ENTRIES) {
    // Sort by timestamp and remove oldest half
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.floor(MAX_RESPONSE_CACHE_ENTRIES / 2);
    for (let i = 0; i < toRemove; i++) {
      delete cache[entries[i][0]];
    }
  }

  cache[cacheKey] = {
    response,
    timestamp: Date.now(),
    endpoint,
  };

  setResponseCache(cache);
}

/**
 * Clear all response cache entries
 */
export function clearResponseCache(): void {
  localStorage.removeItem(KEYS.RESPONSE_CACHE);
}

/**
 * Prune expired response cache entries (beyond stale TTL)
 */
export function pruneResponseCache(): void {
  const cache = getResponseCache();
  const now = Date.now();
  let changed = false;

  for (const key of Object.keys(cache)) {
    if (now > cache[key].timestamp + RESPONSE_CACHE_STALE_TTL) {
      delete cache[key];
      changed = true;
    }
  }

  if (changed) {
    setResponseCache(cache);
  }
}

// ============================================
// Follow Graph Cache Management (CACHE-006)
// ============================================

function getFollowGraphCache(): FollowGraphCache {
  try {
    return JSON.parse(localStorage.getItem(KEYS.FOLLOW_GRAPH_CACHE) || '{}');
  } catch {
    return {};
  }
}

function setFollowGraphCache(cache: FollowGraphCache): void {
  localStorage.setItem(KEYS.FOLLOW_GRAPH_CACHE, JSON.stringify(cache));
}

/**
 * Generate a cache key for follow graph requests
 * @param blogId The blog ID
 * @param direction 'followers' or 'following'
 * @param pageToken Optional page token for pagination
 * @returns A unique cache key
 */
export function generateFollowGraphCacheKey(
  blogId: number,
  direction: 'followers' | 'following',
  pageToken?: string
): string {
  // For first page (no token), cache key is simple
  // For pagination, include the page token to cache each page separately
  return pageToken
    ? `follow:${blogId}:${direction}:${pageToken}`
    : `follow:${blogId}:${direction}`;
}

/**
 * Get cached follow graph response
 * @param cacheKey The cache key generated by generateFollowGraphCacheKey
 * @returns The cached response or undefined if not found/expired
 */
export function getCachedFollowGraph<T>(cacheKey: string): T | undefined {
  const cache = getFollowGraphCache();
  const entry = cache[cacheKey];

  if (!entry) {
    return undefined; // Cache miss
  }

  if (Date.now() > entry.timestamp + FOLLOW_GRAPH_CACHE_TTL) {
    return undefined; // Expired
  }

  return entry.response as T;
}

/**
 * Store follow graph response in cache
 * @param cacheKey The cache key
 * @param response The API response to cache
 * @param blogId The blog ID (for metadata)
 * @param direction The direction ('followers' or 'following')
 */
export function setCachedFollowGraph<T>(
  cacheKey: string,
  response: T,
  blogId: number,
  direction: 'followers' | 'following'
): void {
  const cache = getFollowGraphCache();

  // Evict old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= MAX_FOLLOW_GRAPH_CACHE_ENTRIES) {
    // Sort by timestamp and remove oldest half
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.floor(MAX_FOLLOW_GRAPH_CACHE_ENTRIES / 2);
    for (let i = 0; i < toRemove; i++) {
      delete cache[entries[i][0]];
    }
  }

  cache[cacheKey] = {
    response,
    timestamp: Date.now(),
    blogId,
    direction,
  };

  setFollowGraphCache(cache);
}

/**
 * Invalidate follow graph cache for a specific blog
 * Useful when user actions might change follow relationships
 * @param blogId Optional - if provided, only invalidates that blog's cache
 */
export function invalidateFollowGraphCache(blogId?: number): void {
  if (!blogId) {
    // Clear entire cache
    localStorage.removeItem(KEYS.FOLLOW_GRAPH_CACHE);
    return;
  }

  // Only clear entries for this specific blog
  const cache = getFollowGraphCache();
  let changed = false;

  for (const key of Object.keys(cache)) {
    if (cache[key].blogId === blogId) {
      delete cache[key];
      changed = true;
    }
  }

  if (changed) {
    setFollowGraphCache(cache);
  }
}

/**
 * Clear all follow graph cache entries
 */
export function clearFollowGraphCache(): void {
  localStorage.removeItem(KEYS.FOLLOW_GRAPH_CACHE);
}

/**
 * Prune expired follow graph cache entries
 */
export function pruneFollowGraphCache(): void {
  const cache = getFollowGraphCache();
  const now = Date.now();
  let changed = false;

  for (const key of Object.keys(cache)) {
    if (now > cache[key].timestamp + FOLLOW_GRAPH_CACHE_TTL) {
      delete cache[key];
      changed = true;
    }
  }

  if (changed) {
    setFollowGraphCache(cache);
  }
}

/**
 * Get follow graph cache statistics
 */
export function getFollowGraphCacheStats(): {
  totalEntries: number;
  byDirection: Record<'followers' | 'following', number>;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  const cache = getFollowGraphCache();
  const entries = Object.values(cache);

  const byDirection: Record<'followers' | 'following', number> = {
    followers: 0,
    following: 0,
  };

  let oldest: number | null = null;
  let newest: number | null = null;

  for (const entry of entries) {
    byDirection[entry.direction]++;
    if (oldest === null || entry.timestamp < oldest) {
      oldest = entry.timestamp;
    }
    if (newest === null || entry.timestamp > newest) {
      newest = entry.timestamp;
    }
  }

  return {
    totalEntries: entries.length,
    byDirection,
    oldestEntry: oldest,
    newestEntry: newest,
  };
}

// ============================================
// Recent Activity Cache Management (CACHE-007)
// ============================================

function getRecentActivityCache(): RecentActivityCache {
  try {
    return JSON.parse(localStorage.getItem(KEYS.RECENT_ACTIVITY_CACHE) || '{}');
  } catch {
    return {};
  }
}

function setRecentActivityCache(cache: RecentActivityCache): void {
  try {
    localStorage.setItem(KEYS.RECENT_ACTIVITY_CACHE, JSON.stringify(cache));
  } catch (e) {
    // Storage quota exceeded - clear cache and avoid throwing
    console.warn('Recent activity cache storage quota exceeded, clearing cache');
    clearRecentActivityCache();
  }
}

/**
 * Generate a cache key for recent activity requests.
 * The key is based on the blog IDs, globalMerge flag, and optional page token.
 * @param blogIds The array of blog IDs being queried
 * @param globalMerge Whether globalMerge is enabled
 * @param pageToken Optional page token for pagination
 * @returns A unique cache key
 */
export function generateRecentActivityCacheKey(
  blogIds: number[],
  globalMerge: boolean,
  pageToken?: string
): string {
  // Sort blog IDs to ensure consistent cache keys regardless of input order
  const sortedIds = [...blogIds].sort((a, b) => a - b).join(',');
  const mergeFlag = globalMerge ? 'merged' : 'separate';
  // For first page (no token), cache key is simple
  // For pagination, include the page token to cache each page separately
  return pageToken
    ? `activity:${sortedIds}:${mergeFlag}:${pageToken}`
    : `activity:${sortedIds}:${mergeFlag}`;
}

/**
 * Get cached recent activity response
 * @param cacheKey The cache key generated by generateRecentActivityCacheKey
 * @returns The cached response or undefined if not found/expired
 */
export function getCachedRecentActivity<T>(cacheKey: string): T | undefined {
  const cache = getRecentActivityCache();
  const entry = cache[cacheKey];

  if (!entry) {
    return undefined; // Cache miss
  }

  if (Date.now() > entry.timestamp + RECENT_ACTIVITY_CACHE_TTL) {
    return undefined; // Expired
  }

  return entry.response as T;
}

/**
 * Store recent activity response in cache
 * @param cacheKey The cache key
 * @param response The API response to cache
 * @param blogIds The blog IDs this response covers (for metadata)
 * @param globalMerge Whether this is a globally merged response
 */
export function setCachedRecentActivity<T>(
  cacheKey: string,
  response: T,
  blogIds: number[],
  globalMerge: boolean
): void {
  const cache = getRecentActivityCache();

  // Evict old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= MAX_RECENT_ACTIVITY_CACHE_ENTRIES) {
    // Sort by timestamp and remove oldest half
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.floor(MAX_RECENT_ACTIVITY_CACHE_ENTRIES / 2);
    for (let i = 0; i < toRemove; i++) {
      delete cache[entries[i][0]];
    }
  }

  cache[cacheKey] = {
    response,
    timestamp: Date.now(),
    blogIds,
    globalMerge,
  };

  setRecentActivityCache(cache);
}

/**
 * Invalidate recent activity cache for specific blog IDs.
 * Useful when user actions might affect the activity feed.
 * @param blogIds Optional - if provided, only invalidates cache entries containing those blog IDs
 */
export function invalidateRecentActivityCache(blogIds?: number[]): void {
  if (!blogIds || blogIds.length === 0) {
    // Clear entire cache
    localStorage.removeItem(KEYS.RECENT_ACTIVITY_CACHE);
    return;
  }

  // Only clear entries that contain any of the specified blog IDs
  const cache = getRecentActivityCache();
  let changed = false;
  const blogIdSet = new Set(blogIds);

  for (const key of Object.keys(cache)) {
    const entry = cache[key];
    // Check if any of the cached blogIds overlap with the ones to invalidate
    const hasOverlap = entry.blogIds.some((id) => blogIdSet.has(id));
    if (hasOverlap) {
      delete cache[key];
      changed = true;
    }
  }

  if (changed) {
    setRecentActivityCache(cache);
  }
}

/**
 * Clear all recent activity cache entries
 */
export function clearRecentActivityCache(): void {
  localStorage.removeItem(KEYS.RECENT_ACTIVITY_CACHE);
}

/**
 * Prune expired recent activity cache entries
 */
export function pruneRecentActivityCache(): void {
  const cache = getRecentActivityCache();
  const now = Date.now();
  let changed = false;

  for (const key of Object.keys(cache)) {
    if (now > cache[key].timestamp + RECENT_ACTIVITY_CACHE_TTL) {
      delete cache[key];
      changed = true;
    }
  }

  if (changed) {
    setRecentActivityCache(cache);
  }
}

/**
 * Get recent activity cache statistics
 */
export function getRecentActivityCacheStats(): {
  totalEntries: number;
  mergedEntries: number;
  separateEntries: number;
  uniqueBlogIds: number;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  const cache = getRecentActivityCache();
  const entries = Object.values(cache);

  let mergedEntries = 0;
  let separateEntries = 0;
  const allBlogIds = new Set<number>();
  let oldest: number | null = null;
  let newest: number | null = null;

  for (const entry of entries) {
    if (entry.globalMerge) {
      mergedEntries++;
    } else {
      separateEntries++;
    }
    for (const blogId of entry.blogIds) {
      allBlogIds.add(blogId);
    }
    if (oldest === null || entry.timestamp < oldest) {
      oldest = entry.timestamp;
    }
    if (newest === null || entry.timestamp > newest) {
      newest = entry.timestamp;
    }
  }

  return {
    totalEntries: entries.length,
    mergedEntries,
    separateEntries,
    uniqueBlogIds: allBlogIds.size,
    oldestEntry: oldest,
    newestEntry: newest,
  };
}

// ============================================
// Blog Search Cache Management (CACHE-008)
// ============================================

function getBlogSearchCache(): BlogSearchCache {
  try {
    return JSON.parse(localStorage.getItem(KEYS.BLOG_SEARCH_CACHE) || '{}');
  } catch {
    return {};
  }
}

function setBlogSearchCache(cache: BlogSearchCache): void {
  localStorage.setItem(KEYS.BLOG_SEARCH_CACHE, JSON.stringify(cache));
}

/**
 * Generate a cache key for blog search requests.
 * The key is based on query, sort_field, order, and page_token.
 * @param query The search query
 * @param sortField The sort field
 * @param order The sort order
 * @param pageToken Optional page token for pagination
 * @returns A unique cache key
 */
export function generateBlogSearchCacheKey(
  query: string,
  sortField: number,
  order: number,
  pageToken?: string
): string {
  // Normalize query to lowercase for consistent cache keys
  const normalizedQuery = query.toLowerCase().trim();
  // For first page (no token), cache key is simple
  // For pagination, include the page token to cache each page separately
  return pageToken
    ? `blogs:${normalizedQuery}:${sortField}:${order}:${pageToken}`
    : `blogs:${normalizedQuery}:${sortField}:${order}`;
}

/**
 * Get cached blog search response
 * @param cacheKey The cache key generated by generateBlogSearchCacheKey
 * @returns The cached response or undefined if not found/expired
 */
export function getCachedBlogSearch<T>(cacheKey: string): T | undefined {
  const cache = getBlogSearchCache();
  const entry = cache[cacheKey];

  if (!entry) {
    return undefined; // Cache miss
  }

  if (Date.now() > entry.timestamp + BLOG_SEARCH_CACHE_TTL) {
    return undefined; // Expired
  }

  return entry.response as T;
}

/**
 * Store blog search response in cache
 * @param cacheKey The cache key
 * @param response The API response to cache
 * @param query The search query (for metadata)
 */
export function setCachedBlogSearch<T>(
  cacheKey: string,
  response: T,
  query: string
): void {
  const cache = getBlogSearchCache();

  // Evict old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= MAX_BLOG_SEARCH_CACHE_ENTRIES) {
    // Sort by timestamp and remove oldest half
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.floor(MAX_BLOG_SEARCH_CACHE_ENTRIES / 2);
    for (let i = 0; i < toRemove; i++) {
      delete cache[entries[i][0]];
    }
  }

  cache[cacheKey] = {
    response,
    timestamp: Date.now(),
    query,
  };

  setBlogSearchCache(cache);
}

/**
 * Invalidate blog search cache for a specific query.
 * @param query Optional - if provided, only invalidates cache entries matching that query
 */
export function invalidateBlogSearchCache(query?: string): void {
  if (!query) {
    // Clear entire cache
    localStorage.removeItem(KEYS.BLOG_SEARCH_CACHE);
    return;
  }

  // Only clear entries matching the query
  const cache = getBlogSearchCache();
  let changed = false;
  const normalizedQuery = query.toLowerCase().trim();

  for (const key of Object.keys(cache)) {
    if (cache[key].query.toLowerCase().trim() === normalizedQuery) {
      delete cache[key];
      changed = true;
    }
  }

  if (changed) {
    setBlogSearchCache(cache);
  }
}

/**
 * Clear all blog search cache entries
 */
export function clearBlogSearchCache(): void {
  localStorage.removeItem(KEYS.BLOG_SEARCH_CACHE);
}

/**
 * Prune expired blog search cache entries
 */
export function pruneBlogSearchCache(): void {
  const cache = getBlogSearchCache();
  const now = Date.now();
  let changed = false;

  for (const key of Object.keys(cache)) {
    if (now > cache[key].timestamp + BLOG_SEARCH_CACHE_TTL) {
      delete cache[key];
      changed = true;
    }
  }

  if (changed) {
    setBlogSearchCache(cache);
  }
}

/**
 * Get blog search cache statistics
 */
export function getBlogSearchCacheStats(): {
  totalEntries: number;
  uniqueQueries: number;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  const cache = getBlogSearchCache();
  const entries = Object.values(cache);

  const uniqueQueries = new Set<string>();
  let oldest: number | null = null;
  let newest: number | null = null;

  for (const entry of entries) {
    uniqueQueries.add(entry.query.toLowerCase().trim());
    if (oldest === null || entry.timestamp < oldest) {
      oldest = entry.timestamp;
    }
    if (newest === null || entry.timestamp > newest) {
      newest = entry.timestamp;
    }
  }

  return {
    totalEntries: entries.length,
    uniqueQueries: uniqueQueries.size,
    oldestEntry: oldest,
    newestEntry: newest,
  };
}

// ============================================
// Stale-While-Revalidate Cache Management (CACHE-004)
// ============================================

function getSWRCache(): SWRCache {
  try {
    return JSON.parse(localStorage.getItem(KEYS.SWR_CACHE) || '{}');
  } catch {
    return {};
  }
}

function setSWRCache(cache: SWRCache): void {
  localStorage.setItem(KEYS.SWR_CACHE, JSON.stringify(cache));
}

/**
 * Generate a cache key for SWR requests.
 * @param endpoint The API endpoint
 * @param body The request body (will be JSON stringified)
 * @returns A unique cache key
 */
export function generateSWRCacheKey(endpoint: string, body: unknown): string {
  const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);
  return `swr:${endpoint}:${bodyStr}`;
}

/**
 * Get cached data using stale-while-revalidate strategy.
 *
 * Returns cached data with freshness information:
 * - isFresh: Data is within fresh TTL, no revalidation needed
 * - isStale: Data is beyond fresh TTL but still servable, should revalidate in background
 * - needsRevalidation: True if background revalidation should be triggered
 *
 * Returns undefined if:
 * - No cache entry exists
 * - Cache entry is beyond max age (too old to serve)
 *
 * @param cacheKey The cache key generated by generateSWRCacheKey
 * @param options Optional TTL overrides
 * @returns SWR cache result or undefined if no valid cache
 */
export function getSWRCachedData<T>(
  cacheKey: string,
  options?: {
    freshTTL?: number;
    staleTTL?: number;
    maxAge?: number;
  }
): SWRCacheResult<T> | undefined {
  const cache = getSWRCache();
  const entry = cache[cacheKey];

  if (!entry) {
    return undefined; // Cache miss
  }

  const now = Date.now();
  const age = now - entry.timestamp;
  const freshTTL = options?.freshTTL ?? SWR_CACHE_FRESH_TTL;
  const staleTTL = options?.staleTTL ?? SWR_CACHE_STALE_TTL;
  const maxAge = options?.maxAge ?? SWR_CACHE_MAX_AGE;

  // Data too old - don't serve
  if (age > maxAge) {
    return undefined;
  }

  // Determine freshness state
  const isFresh = age <= freshTTL;
  const isStale = age > freshTTL && age <= staleTTL;

  // Need revalidation if stale and not already revalidating
  const needsRevalidation = (isStale || age > staleTTL) && !entry.revalidating;

  return {
    data: entry.response as T,
    isFresh,
    isStale: !isFresh,
    needsRevalidation,
    cachedAt: entry.timestamp,
  };
}

/**
 * Store data in SWR cache.
 * @param cacheKey The cache key
 * @param response The API response to cache
 * @param endpoint The endpoint (for debugging)
 */
export function setSWRCachedData<T>(
  cacheKey: string,
  response: T,
  endpoint: string
): void {
  const cache = getSWRCache();

  // Evict old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= MAX_SWR_CACHE_ENTRIES) {
    // Sort by timestamp and remove oldest half
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.floor(MAX_SWR_CACHE_ENTRIES / 2);
    for (let i = 0; i < toRemove; i++) {
      delete cache[entries[i][0]];
    }
  }

  cache[cacheKey] = {
    response,
    timestamp: Date.now(),
    endpoint,
    revalidating: false,
  };

  setSWRCache(cache);
}

/**
 * Mark a cache entry as currently revalidating.
 * This prevents duplicate background fetches.
 * @param cacheKey The cache key
 * @param promiseId Unique ID to identify this revalidation
 */
export function markSWRRevalidating(cacheKey: string, promiseId: string): void {
  const cache = getSWRCache();
  const entry = cache[cacheKey];

  if (entry) {
    entry.revalidating = true;
    entry.revalidationPromiseId = promiseId;
    setSWRCache(cache);
  }
}

/**
 * Clear the revalidating flag after revalidation completes.
 * @param cacheKey The cache key
 * @param promiseId The promise ID to verify we're clearing the right revalidation
 */
export function clearSWRRevalidating(cacheKey: string, promiseId: string): void {
  const cache = getSWRCache();
  const entry = cache[cacheKey];

  if (entry && entry.revalidationPromiseId === promiseId) {
    entry.revalidating = false;
    entry.revalidationPromiseId = undefined;
    setSWRCache(cache);
  }
}

/**
 * Check if a cache entry is currently being revalidated.
 * @param cacheKey The cache key
 * @returns True if revalidation is in progress
 */
export function isSWRRevalidating(cacheKey: string): boolean {
  const cache = getSWRCache();
  const entry = cache[cacheKey];
  return entry?.revalidating ?? false;
}

/**
 * Invalidate a specific SWR cache entry.
 * @param cacheKey The cache key to invalidate
 */
export function invalidateSWRCache(cacheKey: string): void {
  const cache = getSWRCache();
  if (cache[cacheKey]) {
    delete cache[cacheKey];
    setSWRCache(cache);
  }
}

/**
 * Clear all SWR cache entries.
 */
export function clearSWRCache(): void {
  localStorage.removeItem(KEYS.SWR_CACHE);
}

/**
 * Prune expired SWR cache entries (beyond max age).
 */
export function pruneSWRCache(): void {
  const cache = getSWRCache();
  const now = Date.now();
  let changed = false;

  for (const key of Object.keys(cache)) {
    if (now > cache[key].timestamp + SWR_CACHE_MAX_AGE) {
      delete cache[key];
      changed = true;
    }
  }

  if (changed) {
    setSWRCache(cache);
  }
}

/**
 * Get SWR cache statistics.
 */
export function getSWRCacheStats(): {
  totalEntries: number;
  freshEntries: number;
  staleEntries: number;
  revalidatingEntries: number;
  byEndpoint: Record<string, number>;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  const cache = getSWRCache();
  const entries = Object.values(cache);
  const now = Date.now();

  let freshEntries = 0;
  let staleEntries = 0;
  let revalidatingEntries = 0;
  const byEndpoint: Record<string, number> = {};
  let oldest: number | null = null;
  let newest: number | null = null;

  for (const entry of entries) {
    const age = now - entry.timestamp;
    if (age <= SWR_CACHE_FRESH_TTL) {
      freshEntries++;
    } else {
      staleEntries++;
    }
    if (entry.revalidating) {
      revalidatingEntries++;
    }

    byEndpoint[entry.endpoint] = (byEndpoint[entry.endpoint] || 0) + 1;

    if (oldest === null || entry.timestamp < oldest) {
      oldest = entry.timestamp;
    }
    if (newest === null || entry.timestamp > newest) {
      newest = entry.timestamp;
    }
  }

  return {
    totalEntries: entries.length,
    freshEntries,
    staleEntries,
    revalidatingEntries,
    byEndpoint,
    oldestEntry: oldest,
    newestEntry: newest,
  };
}

// ============================================
// Pagination Cursor Cache Management (CACHE-003)
// ============================================

function getPaginationCursorCache(): PaginationCursorCache {
  try {
    return JSON.parse(localStorage.getItem(KEYS.PAGINATION_CURSOR_CACHE) || '{}');
  } catch {
    return {};
  }
}

function setPaginationCursorCache(cache: PaginationCursorCache): void {
  localStorage.setItem(KEYS.PAGINATION_CURSOR_CACHE, JSON.stringify(cache));
}

/**
 * Generate a cache key for pagination cursor storage.
 * The key includes page name and relevant parameters that define the view state.
 * @param pageName The page identifier (e.g., 'archive', 'timeline', 'search', 'blogs')
 * @param params Object with relevant parameters (blogName, query, sort, types, etc.)
 * @returns A unique cache key for this page state
 */
export function generatePaginationCursorKey(
  pageName: string,
  params: Record<string, string | number | undefined>
): string {
  const sortedKeys = Object.keys(params).sort();
  const parts: string[] = [pageName];
  for (const key of sortedKeys) {
    const value = params[key];
    if (value !== undefined && value !== '') {
      parts.push(`${key}:${value}`);
    }
  }
  return parts.join('|');
}

/**
 * Get cached pagination cursor for a page.
 * @param pageKey The cache key generated by generatePaginationCursorKey
 * @returns The cached pagination entry or undefined if not found/expired
 */
export function getCachedPaginationCursor(pageKey: string): PaginationCursorEntry | undefined {
  const cache = getPaginationCursorCache();
  const entry = cache[pageKey];

  if (!entry) {
    return undefined; // Cache miss
  }

  if (Date.now() > entry.timestamp + PAGINATION_CURSOR_CACHE_TTL) {
    return undefined; // Expired
  }

  return entry;
}

/**
 * Store pagination cursor and scroll position for a page.
 * @param pageKey The cache key
 * @param cursor The API pagination cursor (nextPageToken), or null if no more pages
 * @param scrollPosition Current window scroll position in pixels
 * @param itemCount Number of items currently loaded
 * @param exhausted Whether all pages have been loaded
 */
export function setCachedPaginationCursor(
  pageKey: string,
  cursor: string | null,
  scrollPosition: number,
  itemCount: number,
  exhausted: boolean
): void {
  const cache = getPaginationCursorCache();

  // Evict old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= MAX_PAGINATION_CURSOR_ENTRIES) {
    // Sort by timestamp and remove oldest half
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.floor(MAX_PAGINATION_CURSOR_ENTRIES / 2);
    for (let i = 0; i < toRemove; i++) {
      delete cache[entries[i][0]];
    }
  }

  cache[pageKey] = {
    cursor,
    scrollPosition,
    itemCount,
    timestamp: Date.now(),
    exhausted,
  };

  setPaginationCursorCache(cache);
}

/**
 * Invalidate pagination cursor cache for a specific page or all pages.
 * @param pageKey Optional - if provided, only invalidates that page's cache
 */
export function invalidatePaginationCursorCache(pageKey?: string): void {
  if (!pageKey) {
    // Clear entire cache
    localStorage.removeItem(KEYS.PAGINATION_CURSOR_CACHE);
    return;
  }

  // Only clear specific entry
  const cache = getPaginationCursorCache();
  if (cache[pageKey]) {
    delete cache[pageKey];
    setPaginationCursorCache(cache);
  }
}

/**
 * Clear all pagination cursor cache entries.
 */
export function clearPaginationCursorCache(): void {
  localStorage.removeItem(KEYS.PAGINATION_CURSOR_CACHE);
}

/**
 * Prune expired pagination cursor cache entries.
 */
export function prunePaginationCursorCache(): void {
  const cache = getPaginationCursorCache();
  const now = Date.now();
  let changed = false;

  for (const key of Object.keys(cache)) {
    if (now > cache[key].timestamp + PAGINATION_CURSOR_CACHE_TTL) {
      delete cache[key];
      changed = true;
    }
  }

  if (changed) {
    setPaginationCursorCache(cache);
  }
}

/**
 * Get pagination cursor cache statistics.
 */
export function getPaginationCursorCacheStats(): {
  totalEntries: number;
  byPage: Record<string, number>;
  oldestEntry: number | null;
  newestEntry: number | null;
  averageItemCount: number;
} {
  const cache = getPaginationCursorCache();
  const entries = Object.entries(cache);

  const byPage: Record<string, number> = {};
  let oldest: number | null = null;
  let newest: number | null = null;
  let totalItems = 0;

  for (const [key, entry] of entries) {
    // Extract page name from key (first part before |)
    const pageName = key.split('|')[0];
    byPage[pageName] = (byPage[pageName] || 0) + 1;

    totalItems += entry.itemCount;

    if (oldest === null || entry.timestamp < oldest) {
      oldest = entry.timestamp;
    }
    if (newest === null || entry.timestamp > newest) {
      newest = entry.timestamp;
    }
  }

  return {
    totalEntries: entries.length,
    byPage,
    oldestEntry: oldest,
    newestEntry: newest,
    averageItemCount: entries.length > 0 ? Math.round(totalItems / entries.length) : 0,
  };
}

// ============================================
// HTTP ETag/Last-Modified Cache Management (CACHE-005)
// ============================================

function getHttpCache(): HttpCache {
  try {
    return JSON.parse(localStorage.getItem(KEYS.HTTP_CACHE) || '{}');
  } catch {
    return {};
  }
}

function setHttpCache(cache: HttpCache): void {
  localStorage.setItem(KEYS.HTTP_CACHE, JSON.stringify(cache));
}

/**
 * Generate a cache key for HTTP conditional request caching.
 * @param endpoint The API endpoint
 * @param body The request body (will be JSON stringified)
 * @returns A unique cache key
 */
export function generateHttpCacheKey(endpoint: string, body: unknown): string {
  const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);
  return `http:${endpoint}:${bodyStr}`;
}

/**
 * HTTP cache result with validation headers.
 * - data: The cached response data
 * - etag: ETag header from last response (for If-None-Match)
 * - lastModified: Last-Modified header from last response (for If-Modified-Since)
 */
export interface HttpCacheResult<T> {
  data: T;
  etag: string | null;
  lastModified: string | null;
  cachedAt: number;
}

/**
 * Get cached response with HTTP validation headers.
 * Returns cached data along with ETag/Last-Modified for conditional requests.
 * @param cacheKey The cache key generated by generateHttpCacheKey
 * @returns The cached response with headers, or undefined if not found/expired
 */
export function getHttpCachedResponse<T>(cacheKey: string): HttpCacheResult<T> | undefined {
  const cache = getHttpCache();
  const entry = cache[cacheKey];

  if (!entry) {
    return undefined; // Cache miss
  }

  // Check if cache entry is too old (beyond max TTL)
  if (Date.now() > entry.timestamp + HTTP_CACHE_TTL) {
    return undefined; // Expired - don't use for conditional requests
  }

  return {
    data: entry.response as T,
    etag: entry.etag,
    lastModified: entry.lastModified,
    cachedAt: entry.timestamp,
  };
}

/**
 * Store response in HTTP cache with validation headers.
 * @param cacheKey The cache key
 * @param response The API response to cache
 * @param etag The ETag header from the response (or null if not present)
 * @param lastModified The Last-Modified header from the response (or null if not present)
 * @param endpoint The endpoint (for debugging)
 */
export function setHttpCachedResponse<T>(
  cacheKey: string,
  response: T,
  etag: string | null,
  lastModified: string | null,
  endpoint: string
): void {
  // Only cache if we have at least one validation header
  if (!etag && !lastModified) {
    return; // No validation headers = can't do conditional requests
  }

  const cache = getHttpCache();

  // Evict old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= MAX_HTTP_CACHE_ENTRIES) {
    // Sort by timestamp and remove oldest half
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.floor(MAX_HTTP_CACHE_ENTRIES / 2);
    for (let i = 0; i < toRemove; i++) {
      delete cache[entries[i][0]];
    }
  }

  cache[cacheKey] = {
    response,
    etag,
    lastModified,
    timestamp: Date.now(),
    endpoint,
  };

  setHttpCache(cache);
}

/**
 * Update timestamp for an existing HTTP cache entry (after 304 Not Modified).
 * This refreshes the cache TTL without changing the cached data.
 * @param cacheKey The cache key
 */
export function refreshHttpCacheTimestamp(cacheKey: string): void {
  const cache = getHttpCache();
  const entry = cache[cacheKey];

  if (entry) {
    entry.timestamp = Date.now();
    setHttpCache(cache);
  }
}

/**
 * Invalidate HTTP cache for a specific endpoint pattern.
 * @param pattern Optional - if provided, only invalidates cache entries matching that endpoint pattern
 */
export function invalidateHttpCache(pattern?: string): void {
  if (!pattern) {
    // Clear entire cache
    localStorage.removeItem(KEYS.HTTP_CACHE);
    return;
  }

  // Only clear entries matching the pattern
  const cache = getHttpCache();
  let changed = false;

  for (const key of Object.keys(cache)) {
    if (cache[key].endpoint.includes(pattern)) {
      delete cache[key];
      changed = true;
    }
  }

  if (changed) {
    setHttpCache(cache);
  }
}

/**
 * Clear all HTTP cache entries.
 */
export function clearHttpCache(): void {
  localStorage.removeItem(KEYS.HTTP_CACHE);
}

/**
 * Prune expired HTTP cache entries (beyond max TTL).
 */
export function pruneHttpCache(): void {
  const cache = getHttpCache();
  const now = Date.now();
  let changed = false;

  for (const key of Object.keys(cache)) {
    if (now > cache[key].timestamp + HTTP_CACHE_TTL) {
      delete cache[key];
      changed = true;
    }
  }

  if (changed) {
    setHttpCache(cache);
  }
}

/**
 * Get HTTP cache statistics.
 */
export function getHttpCacheStats(): {
  totalEntries: number;
  withEtag: number;
  withLastModified: number;
  byEndpoint: Record<string, number>;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  const cache = getHttpCache();
  const entries = Object.values(cache);

  let withEtag = 0;
  let withLastModified = 0;
  const byEndpoint: Record<string, number> = {};
  let oldest: number | null = null;
  let newest: number | null = null;

  for (const entry of entries) {
    if (entry.etag) withEtag++;
    if (entry.lastModified) withLastModified++;

    byEndpoint[entry.endpoint] = (byEndpoint[entry.endpoint] || 0) + 1;

    if (oldest === null || entry.timestamp < oldest) {
      oldest = entry.timestamp;
    }
    if (newest === null || entry.timestamp > newest) {
      newest = entry.timestamp;
    }
  }

  return {
    totalEntries: entries.length,
    withEtag,
    withLastModified,
    byEndpoint,
    oldestEntry: oldest,
    newestEntry: newest,
  };
}

// ============================================
// User Preferences Management
// ============================================

export function getPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(KEYS.PREFS);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new fields
      return { ...DEFAULT_PREFS, ...parsed };
    }
  } catch {
    // Invalid JSON, return defaults
  }
  return { ...DEFAULT_PREFS };
}

export function setPreferences(prefs: Partial<UserPreferences>): void {
  const current = getPreferences();
  const updated = { ...current, ...prefs };
  localStorage.setItem(KEYS.PREFS, JSON.stringify(updated));
}

export function getPagePreference<K extends keyof UserPreferences>(
  pageName: string,
  key: K
): UserPreferences[K] {
  const prefs = getPreferences();
  const pagePrefs = prefs.pagePrefs?.[pageName];

  if (pagePrefs && key in pagePrefs) {
    return (pagePrefs as Record<string, unknown>)[key] as UserPreferences[K];
  }

  return prefs[key];
}

export function setPagePreference<K extends keyof UserPreferences>(
  pageName: string,
  key: K,
  value: UserPreferences[K]
): void {
  const prefs = getPreferences();
  if (!prefs.pagePrefs) {
    prefs.pagePrefs = {};
  }
  if (!prefs.pagePrefs[pageName]) {
    prefs.pagePrefs[pageName] = {};
  }
  (prefs.pagePrefs[pageName] as Record<string, unknown>)[key] = value;
  setPreferences(prefs);
}

export function clearPreferences(): void {
  localStorage.removeItem(KEYS.PREFS);
}

// Convenience getters/setters for common preferences
export function getVariantPreference(pageName?: string): VariantSelection {
  if (pageName) {
    return getPagePreference(pageName, 'postVariant');
  }
  return getPreferences().postVariant;
}

export function setVariantPreference(variant: VariantSelection, pageName?: string): void {
  if (pageName) {
    setPagePreference(pageName, 'postVariant', variant);
  } else {
    setPreferences({ postVariant: variant });
  }
}

export function getTypePreference(pageName?: string): number[] {
  if (pageName) {
    return getPagePreference(pageName, 'postTypes');
  }
  return getPreferences().postTypes;
}

export function setTypePreference(types: number[], pageName?: string): void {
  if (pageName) {
    setPagePreference(pageName, 'postTypes', types);
  } else {
    setPreferences({ postTypes: types });
  }
}

export function getInfiniteScrollPreference(pageName?: string): boolean {
  if (pageName) {
    return getPagePreference(pageName, 'infiniteScroll');
  }
  return getPreferences().infiniteScroll;
}

export function setInfiniteScrollPreference(enabled: boolean, pageName?: string): void {
  if (pageName) {
    setPagePreference(pageName, 'infiniteScroll', enabled);
  } else {
    setPreferences({ infiniteScroll: enabled });
  }
}

// ============================================
// Clear All Storage
// ============================================

export function clearAllStorage(): void {
  Object.values(KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
}

// ============================================
// Storage Keys Export (for debugging)
// ============================================

export const STORAGE_KEYS = KEYS;

// ============================================
// Export/Import for debugging and backup
// ============================================

export interface StorageExport {
  version: number;
  exportedAt: string;
  data: Record<string, string>;
}

/**
 * Export all storage data for backup or debugging
 */
export function exportStorage(): StorageExport {
  const data: Record<string, string> = {};

  for (const key of Object.values(KEYS)) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      data[key] = value;
    }
  }

  return {
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/**
 * Import storage data from a backup
 * @param backup The backup data to import
 * @param merge If true, only imports missing keys. If false, overwrites all.
 */
export function importStorage(backup: StorageExport, merge = true): void {
  // Validate backup
  if (!backup || typeof backup !== 'object') {
    throw new Error('Invalid backup data');
  }

  if (!backup.data || typeof backup.data !== 'object') {
    throw new Error('Invalid backup data format');
  }

  // Only import known keys to prevent pollution
  const validKeys = new Set<string>(Object.values(KEYS));

  for (const [key, value] of Object.entries(backup.data)) {
    if (!validKeys.has(key)) {
      console.warn(`Skipping unknown key: ${key}`);
      continue;
    }

    if (merge && localStorage.getItem(key) !== null) {
      // Skip existing keys in merge mode
      continue;
    }

    localStorage.setItem(key, value);
  }

  // Run migrations if importing from older version
  if (backup.version < CURRENT_VERSION) {
    runMigrations(backup.version);
    setStorageVersion(CURRENT_VERSION);
  }
}

/**
 * Get storage usage statistics
 */
export function getStorageStats(): {
  totalKeys: number;
  usedBytes: number;
  keyStats: Record<string, number>;
} {
  const keyStats: Record<string, number> = {};
  let usedBytes = 0;

  for (const key of Object.values(KEYS)) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      const size = key.length + value.length;
      keyStats[key] = size;
      usedBytes += size;
    }
  }

  return {
    totalKeys: Object.keys(keyStats).length,
    usedBytes,
    keyStats,
  };
}
