import type { SearchPostsByTagResponse } from '../types/api.js';
import type { ProcessedPost } from '../types/post.js';

export interface RecResult {
  user_id?: string;
  blog_id?: string;
  content_id?: string;
  post_id?: number;
  post_owner?: string;
  similarity_score: number;
  total_likes?: number;
  _hydratedPost?: ProcessedPost;
}

export type SimilarPostsResponse = SearchPostsByTagResponse & {
  recommendations?: RecResult[];
  similar_posts?: RecResult[];
  count?: number;
  query_user_id?: string;
  query_post_id?: number;
};
