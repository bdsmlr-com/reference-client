import { getBlog } from './api.js';
import type { IdentityDecoration } from '../types/api.js';

export interface HydratedBlogMeta {
  id?: number;
  name?: string;
  title?: string;
  description?: string;
  avatarUrl?: string | null;
  identityDecorations?: IdentityDecoration[];
}

const BLOG_META_CACHE_TTL = 10 * 60 * 1000;

const hydratedBlogMetaByIdCache = new Map<number, { value: HydratedBlogMeta | null; timestamp: number }>();
const hydratedBlogMetaByNameCache = new Map<string, { value: HydratedBlogMeta | null; timestamp: number }>();
const hydratedBlogMetaByIdInflight = new Map<number, Promise<HydratedBlogMeta | null>>();
const hydratedBlogMetaByNameInflight = new Map<string, Promise<HydratedBlogMeta | null>>();

function normalizeBlogName(blogName: string): string {
  return blogName.trim().replace(/^@+/, '').toLowerCase();
}

function getFreshValue<T>(
  cache: Map<T, { value: HydratedBlogMeta | null; timestamp: number }>,
  key: T,
): HydratedBlogMeta | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.timestamp + BLOG_META_CACHE_TTL) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setHydratedBlogMeta(
  value: HydratedBlogMeta | null,
  options: { blogId?: number | null; blogName?: string | null },
): void {
  const timestamp = Date.now();
  const normalizedName = options.blogName ? normalizeBlogName(options.blogName) : '';
  if (options.blogId) {
    hydratedBlogMetaByIdCache.set(options.blogId, { value, timestamp });
  }
  if (normalizedName) {
    hydratedBlogMetaByNameCache.set(normalizedName, { value, timestamp });
  }
  if (value) {
    if (value.id) {
      hydratedBlogMetaByIdCache.set(value.id, { value, timestamp });
    }
    if (value.name) {
      hydratedBlogMetaByNameCache.set(normalizeBlogName(value.name), { value, timestamp });
    }
  }
}

function toHydratedBlogMeta(blog: Record<string, any> | undefined): HydratedBlogMeta | null {
  if (!blog) return null;
  return {
    id: typeof blog.id === 'number' ? blog.id : undefined,
    name: blog.name || undefined,
    title: blog.title || undefined,
    description: blog.description || undefined,
    avatarUrl: blog.avatarUrl || blog.avatar_url || null,
    identityDecorations: blog.identityDecorations || [],
  };
}

export async function fetchHydratedBlogMetaById(blogId: number): Promise<HydratedBlogMeta | null> {
  const cached = getFreshValue(hydratedBlogMetaByIdCache, blogId);
  if (cached !== undefined) return cached;

  const inflight = hydratedBlogMetaByIdInflight.get(blogId);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const response = await getBlog({ blog_id: blogId });
      const value = toHydratedBlogMeta(response.blog as Record<string, any> | undefined);
      setHydratedBlogMeta(value, { blogId, blogName: value?.name ?? null });
      return value;
    } catch {
      setHydratedBlogMeta(null, { blogId });
      return null;
    } finally {
      hydratedBlogMetaByIdInflight.delete(blogId);
    }
  })();

  hydratedBlogMetaByIdInflight.set(blogId, promise);
  return promise;
}

export async function fetchHydratedBlogMetaByName(blogName: string): Promise<HydratedBlogMeta | null> {
  const normalizedName = normalizeBlogName(blogName);
  if (!normalizedName) return null;

  const cached = getFreshValue(hydratedBlogMetaByNameCache, normalizedName);
  if (cached !== undefined) return cached;

  const inflight = hydratedBlogMetaByNameInflight.get(normalizedName);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const response = await getBlog({ blog_name: normalizedName });
      const value = toHydratedBlogMeta(response.blog as Record<string, any> | undefined);
      setHydratedBlogMeta(value, { blogName: normalizedName, blogId: value?.id ?? null });
      return value;
    } catch {
      setHydratedBlogMeta(null, { blogName: normalizedName });
      return null;
    } finally {
      hydratedBlogMetaByNameInflight.delete(normalizedName);
    }
  })();

  hydratedBlogMetaByNameInflight.set(normalizedName, promise);
  return promise;
}
