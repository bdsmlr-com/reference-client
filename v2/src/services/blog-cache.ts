const CACHE_KEY = 'bdsmlr_blog_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const NOT_FOUND_TTL = 60 * 60 * 1000; // 1 hour for null entries
const MAX_ENTRIES = 500;

interface CacheEntry {
  blogId: number | null;
  timestamp: number;
}

interface BlogCache {
  [blogName: string]: CacheEntry;
}

function getCache(): BlogCache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setCache(cache: BlogCache): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function getCachedBlogId(blogName: string): number | null | undefined {
  const cache = getCache();
  const key = blogName.toLowerCase();
  const entry = cache[key];

  if (!entry) {
    return undefined; // Cache miss
  }

  const ttl = entry.blogId === null ? NOT_FOUND_TTL : CACHE_TTL;
  if (Date.now() > entry.timestamp + ttl) {
    return undefined; // Expired
  }

  return entry.blogId; // Cache hit (may be null for "not found")
}

export function setCachedBlogId(blogName: string, blogId: number | null): void {
  const cache = getCache();
  const key = blogName.toLowerCase();

  // Evict old entries if cache is too large
  const entries = Object.entries(cache);
  if (entries.length >= MAX_ENTRIES) {
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

  setCache(cache);
}

export function clearBlogCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
