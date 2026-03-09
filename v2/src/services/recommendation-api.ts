/**
 * Service for interacting with the Collaborative Filtering Recommender API.
 * Maps underscore names to hyphen names for compatibility with main API.
 */

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

const API_BASE = '/api/recs';

/**
 * Normalizes blog/user names from rec service (e.g. little_ways -> little-ways)
 */
function normalizeName(name: string | undefined): string {
  if (!name) return '';
  return name.replace(/_/g, '-');
}

export const recService = {
  async getSimilarBlogs(blogName: string, limit = 10): Promise<RecResult[]> {
    const res = await fetch(`${API_BASE}/similar-content/${encodeURIComponent(blogName.replace(/-/g, '_'))}?limit=${limit}&exclude_self=true`);
    const data: RecResponse = await res.json();
    const items = data.similar_content || data.recommendations || [];
    return items.map(item => ({
      ...item,
      content_id: normalizeName(item.content_id)
    }));
  },

  async getRecommendedBlogsForUser(userId: string, limit = 10): Promise<RecResult[]> {
    const res = await fetch(`${API_BASE}/recommendations/content/${encodeURIComponent(userId)}?limit=${limit}`);
    const data: RecResponse = await res.json();
    const items = data.recommendations || [];
    return items.map(item => ({
      ...item,
      content_id: normalizeName(item.content_id)
    }));
  },

  async getSimilarPosts(postId: number, limit = 10, offset = 0): Promise<RecResult[]> {
    const res = await fetch(`${API_BASE}/similar-posts/${postId}?limit=${limit}&offset=${offset}&exclude_self=true`);
    const data: RecResponse = await res.json();
    const items = data.similar_posts || data.recommendations || [];
    return items.map(item => ({
      ...item,
      post_owner: normalizeName(item.post_owner)
    }));
  },

  async getRecommendedPostsForUser(userId: string, limit = 10, offset = 0): Promise<RecResult[]> {
    const res = await fetch(`${API_BASE}/recommendations/posts/${encodeURIComponent(userId)}?limit=${limit}&offset=${offset}`);
    const data: RecResponse = await res.json();
    const items = data.recommendations || [];
    return items.map(item => ({
      ...item,
      post_owner: normalizeName(item.post_owner)
    }));
  }
};
