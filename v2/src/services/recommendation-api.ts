/**
 * Service for interacting with the Collaborative Filtering Recommender API.
 * Maps underscore names to hyphen names for compatibility with main API.
 */

import { extractMedia, type ProcessedPost } from '../types/post.js';
import type { Post, SearchPostsByTagResponse } from '../types/api.js';
import { applyRetrievalPostPolicies, type RetrievalPostPolicyMap } from './retrieval-presentation.js';
import { getAuthUser } from '../state/auth-state.js';

export interface RecResult {
  user_id?: string;
  blog_id?: string;
  content_id?: string;
  post_id?: number;
  post_owner?: string;
  similarity_score: number;
  total_likes?: number;
}

export interface RecResponse {
  count: number;
  recommendations: RecResult[];
  similar_content?: RecResult[];
  similar_posts?: RecResult[];
  query_user_id?: string;
  query_post_id?: number;
}

export interface SimilarPostsResponse {
  posts?: Post[];
  postPolicies?: RetrievalPostPolicyMap;
  recommendations?: RecResult[];
  similar_posts?: RecResult[];
  count?: number;
  query_user_id?: string;
  query_post_id?: number;
}

const API_BASE = '/v2/api/recs';
const DEFAULT_PUBLIC_READ_RECS_BASE = 'https://api-prod.bdsmlr.com/v2/api/recs';
const PUBLIC_READ_RECS_BASE = ((import.meta as any).env?.VITE_PUBLIC_READ_RECS_BASE_URL || DEFAULT_PUBLIC_READ_RECS_BASE).replace(/\/$/, '');

function isApexRuntimeHost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'bdsmlr.com' || hostname === 'www.bdsmlr.com';
}

function shouldUseDirectPublicReadRecs(): boolean {
  if (!isApexRuntimeHost()) return false;
  if (getAuthUser()) return false;
  return true;
}

function resolveRecsBase(): string {
  if (shouldUseDirectPublicReadRecs()) {
    return PUBLIC_READ_RECS_BASE;
  }
  return API_BASE;
}

/**
 * Normalizes blog/user names from rec service (e.g. little_ways -> little-ways)
 */
function normalizeName(name: string | undefined): string {
  if (!name) return '';
  return name.replace(/_/g, '-');
}

export function materializeRecommendedPosts(
  response: Pick<SimilarPostsResponse, 'posts' | 'postPolicies'> | Pick<SearchPostsByTagResponse, 'posts' | 'postPolicies'>
): ProcessedPost[] {
  if (!Array.isArray(response.posts) || response.posts.length === 0) {
    return [];
  }

  const posts = response.posts.map((post) => {
    const processed = { ...post } as ProcessedPost;
    processed._media = extractMedia(processed);
    return processed;
  });

  return applyRetrievalPostPolicies(posts, response.postPolicies);
}

export const recService = {
  async getSimilarBlogs(blogName: string, limit = 10): Promise<RecResult[]> {
    const res = await fetch(`${resolveRecsBase()}/similar-content/${encodeURIComponent(blogName.replace(/-/g, '_'))}?limit=${limit}&exclude_self=true`);
    const data: RecResponse = await res.json();
    const items = data.similar_content || data.recommendations || [];
    return items.map(item => ({
      ...item,
      content_id: normalizeName(item.content_id)
    }));
  },

  async getRecommendedBlogsForUser(userId: string, limit = 10): Promise<RecResult[]> {
    const res = await fetch(`${resolveRecsBase()}/recommendations/content/${encodeURIComponent(userId)}?limit=${limit}`);
    const data: RecResponse = await res.json();
    const items = data.recommendations || [];
    return items.map(item => ({
      ...item,
      content_id: normalizeName(item.content_id)
    }));
  },

  async getSimilarPosts(
    postId: number,
    limit = 10,
    offset = 0,
    perspectiveBlogName?: string,
  ): Promise<SimilarPostsResponse> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      exclude_self: 'true',
    });
    if (perspectiveBlogName) {
      params.set('perspective_blog_name', perspectiveBlogName);
    }
    const res = await fetch(`${resolveRecsBase()}/similar-posts/${postId}?${params.toString()}`);
    const data: SimilarPostsResponse = await res.json();
    if (Array.isArray(data.posts) && data.posts.length > 0) {
      return data;
    }
    const items = data.similar_posts || data.recommendations || [];
    return {
      ...data,
      recommendations: items.map(item => ({
        ...item,
        post_owner: normalizeName(item.post_owner),
      })),
      similar_posts: items.map(item => ({
        ...item,
        post_owner: normalizeName(item.post_owner),
      })),
    };
  },

  async getRecommendedPostsForUser(userId: string, limit = 10, offset = 0): Promise<SimilarPostsResponse> {
    const res = await fetch(`${resolveRecsBase()}/recommendations/posts/${encodeURIComponent(userId)}?limit=${limit}&offset=${offset}`);
    const data: SimilarPostsResponse = await res.json();
    if (Array.isArray(data.posts)) {
      return data;
    }

    const items = data.recommendations || [];
    return {
      ...data,
      recommendations: items.map(item => ({
        ...item,
        post_owner: normalizeName(item.post_owner)
      })),
      similar_posts: (data.similar_posts || items).map(item => ({
        ...item,
        post_owner: normalizeName(item.post_owner)
      })),
    };
  }
};
