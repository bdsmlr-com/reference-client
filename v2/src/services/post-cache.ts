/**
 * Post Cache Service
 *
 * Caches post data from listBlogPosts() to reduce redundant API calls.
 * Posts are cached by blog ID with configurable TTL and LRU eviction.
 *
 * Cache Structure:
 * - Each blog's posts are stored under a cache key based on blog_id + filters
 * - Posts are stored as an array with pagination cursor
 * - Cache entries expire after TTL (default 5 minutes)
 */

import type { Post, ListBlogPostsRequest, ListBlogPostsResponse } from '../types/api.js';

// Storage key for post cache
const POST_CACHE_KEY = 'bdsmlr_post_cache';

// Cache configuration
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHED_BLOGS = 20; // Maximum number of blogs to cache
const MAX_POSTS_PER_BLOG = 200; // Maximum posts cached per blog

/**
 * Cache entry for a single blog's posts
 */
export interface PostCacheEntry {
  posts: Post[];
  nextPageToken?: string;
  exhausted: boolean; // No more pages available
  timestamp: number;
  requestHash: string; // Hash of request params (excluding pagination)
}

/**
 * Full post cache structure
 */
export interface PostCache {
  [blogId: string]: PostCacheEntry;
}

/**
 * Generate a hash key for request parameters (excluding pagination)
 * This ensures cache is invalidated when filters change
 */
function hashRequest(req: ListBlogPostsRequest): string {
  const normalized = {
    blog_id: req.blog_id,
    sort_field: req.sort_field ?? 1,
    order: req.order ?? 1,
    post_types: (req.post_types ?? []).sort(),
    variants: (req.variants ?? []).sort(),
  };
  return JSON.stringify(normalized);
}

/**
 * Get the full post cache from localStorage
 */
function getPostCache(): PostCache {
  try {
    const stored = localStorage.getItem(POST_CACHE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save the post cache to localStorage
 */
function setPostCache(cache: PostCache): void {
  try {
    localStorage.setItem(POST_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    // Storage quota exceeded - clear cache and retry
    console.warn('Post cache storage quota exceeded, clearing cache');
    clearPostCache();
  }
}

/**
 * Get cached posts for a blog
 * Returns undefined if cache miss or expired
 */
export function getCachedPosts(
  req: ListBlogPostsRequest,
  ttl: number = DEFAULT_CACHE_TTL
): PostCacheEntry | undefined {
  const cache = getPostCache();
  const blogKey = req.blog_id.toString();
  const entry = cache[blogKey];

  if (!entry) {
    return undefined; // Cache miss
  }

  // Check if request params match
  const requestHash = hashRequest(req);
  if (entry.requestHash !== requestHash) {
    return undefined; // Different filters - cache miss
  }

  // Check if expired
  if (Date.now() > entry.timestamp + ttl) {
    return undefined; // Expired
  }

  return entry;
}

/**
 * Cache posts for a blog
 * Handles pagination by appending new posts to existing cache
 */
export function setCachedPosts(
  req: ListBlogPostsRequest,
  response: ListBlogPostsResponse,
  isAppend: boolean = false
): void {
  const cache = getPostCache();
  const blogKey = req.blog_id.toString();
  const requestHash = hashRequest(req);

  // Get existing entry for appending
  const existing = cache[blogKey];
  let posts: Post[] = [];

  if (isAppend && existing && existing.requestHash === requestHash) {
    // Append mode - add new posts to existing
    posts = [...existing.posts, ...(response.posts ?? [])];
  } else {
    // New cache or different request - replace
    posts = response.posts ?? [];
  }

  // Limit posts per blog to prevent memory issues
  if (posts.length > MAX_POSTS_PER_BLOG) {
    posts = posts.slice(0, MAX_POSTS_PER_BLOG);
  }

  // Evict old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= MAX_CACHED_BLOGS && !cache[blogKey]) {
    // Sort by timestamp and remove oldest entries
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, Math.floor(MAX_CACHED_BLOGS / 4));
    for (const [id] of toRemove) {
      delete cache[id];
    }
  }

  cache[blogKey] = {
    posts,
    nextPageToken: response.page?.nextPageToken,
    exhausted: !response.page?.nextPageToken,
    timestamp: Date.now(),
    requestHash,
  };

  setPostCache(cache);
}

/**
 * Get the next page token for a cached blog
 * Returns undefined if not in cache
 */
export function getCachedNextPageToken(
  req: ListBlogPostsRequest
): string | undefined {
  const entry = getCachedPosts(req);
  return entry?.nextPageToken;
}

/**
 * Check if we've already loaded all posts for a blog
 */
export function isCacheExhausted(req: ListBlogPostsRequest): boolean {
  const entry = getCachedPosts(req);
  return entry?.exhausted ?? false;
}

/**
 * Get cached posts up to a specific count
 * Useful for pagination display without re-fetching
 */
export function getCachedPostsSlice(
  req: ListBlogPostsRequest,
  offset: number,
  limit: number
): Post[] | undefined {
  const entry = getCachedPosts(req);
  if (!entry) return undefined;
  return entry.posts.slice(offset, offset + limit);
}

/**
 * Invalidate cache for a specific blog
 */
export function invalidateBlogPostCache(blogId: number): void {
  const cache = getPostCache();
  delete cache[blogId.toString()];
  setPostCache(cache);
}

/**
 * Clear all cached posts
 */
export function clearPostCache(): void {
  localStorage.removeItem(POST_CACHE_KEY);
}

/**
 * Get cache statistics for debugging
 */
export function getPostCacheStats(): {
  cachedBlogs: number;
  totalPosts: number;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  const cache = getPostCache();
  const entries = Object.values(cache);

  if (entries.length === 0) {
    return {
      cachedBlogs: 0,
      totalPosts: 0,
      oldestEntry: null,
      newestEntry: null,
    };
  }

  const timestamps = entries.map((e) => e.timestamp);
  const totalPosts = entries.reduce((sum, e) => sum + e.posts.length, 0);

  return {
    cachedBlogs: entries.length,
    totalPosts,
    oldestEntry: Math.min(...timestamps),
    newestEntry: Math.max(...timestamps),
  };
}
