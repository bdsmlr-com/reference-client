// Pagination
export interface Pagination {
  page_size?: number;
  page_token?: string;
}

export interface PageInfo {
  nextPageToken?: string;
}

// Enums - API expects integer values, not strings!
export type PostType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
// PostVariant: 0=UNSPECIFIED, 1=ORIGINAL, 2=REBLOG
export type PostVariant = 1 | 2;
// Order: 0 = UNSPECIFIED, 1 = ASC, 2 = DESC
export type Order = 0 | 1 | 2;

// Sort fields - API expects integer values!
// PostSortField: 0=UNSPECIFIED, 1=CREATED_AT, 2=LIKES_COUNT, 3=COMMENTS_COUNT, 4=REBLOGS_COUNT, 5=MENTIONS_COUNT, 6=NOTES_COUNT, 7=ID
export type PostSortField = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
// BlogSortField: 0=UNSPECIFIED, 1=ID, 2=FOLLOWERS_COUNT, 3=POSTS_COUNT, 4=NAME, 5=CREATED_AT
export type BlogSortField = 1 | 2 | 3 | 4 | 5;

// Content types
export interface PostContent {
  files?: string[];
  thumbnail?: string;
  html?: string;
  text?: string;
  title?: string;
  url?: string;
  quoteText?: string;
  quoteSource?: string;
}

// Core entities
export interface Post {
  id: number;
  blogId?: number;
  blogName?: string;
  type: PostType;
  content?: PostContent;
  tags?: string[];
  likesCount?: number;
  commentsCount?: number;
  reblogsCount?: number;
  mentionsCount?: number;
  notesCount?: number;
  createdAtUnix?: number;
  deletedAtUnix?: number;
  originPostId?: number;
  originBlogId?: number;
  originBlogName?: string;
  originDeletedAtUnix?: number;
  variant?: PostVariant;
}

export interface Blog {
  id: number;
  name?: string;
  title?: string;
  description?: string;
  ownerUserId?: number;
  followersCount?: number;
  postsCount?: number;
  avatarUrl?: string;
  coverUrl?: string;
  // Theme customization
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  headerImageUrl?: string;
}

export interface User {
  id: number;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface Activity {
  id: number;
  type?: string;
  postId?: number;
  blogId?: number;
  blogName?: string;
  userId?: number;
  comment?: string;
  createdAtUnix?: number;
}

export interface Like {
  id: number;
  postId?: number;
  userId?: number;
  blogId?: number;
  blogName?: string;
  createdAtUnix?: number;
}

export interface Comment {
  id: number;
  postId?: number;
  userId?: number;
  blogId?: number;
  blogName?: string;
  body?: string;
  createdAtUnix?: number;
}

export interface Reblog {
  id: number;
  postId?: number;
  blogId?: number;
  blogName?: string;
  createdAtUnix?: number;
}

// Request types
export interface SearchPostsByTagRequest {
  tag_name: string;
  page?: Pagination;
  sort_field?: PostSortField;
  order?: Order;
  post_types?: PostType[];
  blocked_blog_ids?: number[];
  blocked_user_ids?: number[];
  variants?: PostVariant[];
}

export interface ListBlogPostsRequest {
  blog_id: number;
  page?: Pagination;
  sort_field?: PostSortField;
  order?: Order;
  post_types?: PostType[];
  variants?: PostVariant[];
}

export interface ListBlogActivityRequest {
  blog_id: number;
  page?: Pagination;
  order?: Order;
}

export interface ResolveIdentifierRequest {
  post_id?: number;
  blog_id?: number;
  blog_name?: string;
  user_id?: number;
  user_name?: string;
}

export interface ListPostLikesRequest {
  post_id: number;
  page?: Pagination;
  order?: Order;
}

export interface ListPostCommentsRequest {
  post_id: number;
  page?: Pagination;
  order?: Order;
}

export interface ListPostReblogsRequest {
  post_id: number;
  page?: Pagination;
  order?: Order;
}

export interface SignUrlRequest {
  url: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// New API types for blogs search and server-side merge
export interface SearchBlogsRequest {
  query: string;
  page?: Pagination;
  sort_field?: BlogSortField;
  order?: Order;
}

export type FollowGraphDirection = 0 | 1 | 2 | 'followers' | 'following' | 'both';

export interface BlogFollowGraphRequest {
  blog_id: number;
  direction?: FollowGraphDirection;
  page_size?: number;
  page_token?: string;
}

export interface ListBlogsRecentActivityRequest {
  blog_ids: number[];
  post_types?: PostType[];
  variants?: PostVariant[];
  global_merge?: boolean;
  page?: Pagination;
  sort_field?: PostSortField;
  order?: Order;
  page_size?: number;
  /** Number of posts to retrieve per blog. Use 0 for merged feed (globalMerge=true). */
  limit_per_blog?: number;
}

export interface GetBlogRequest {
  blog_id?: number;
  blog_name?: string;
}

export interface FollowEdge {
  blogId: number;
  blogName?: string;
  userId?: number;
}

// Response types
export interface SearchPostsByTagResponse {
  posts?: Post[];
  page?: PageInfo;
  error?: string;
}

export interface ListBlogPostsResponse {
  posts?: Post[];
  page?: PageInfo;
  error?: string;
}

export interface ListBlogActivityResponse {
  activity?: Activity[];
  page?: PageInfo;
  error?: string;
}

export interface ResolveIdentifierResponse {
  postId?: number;
  blogId?: number;
  blogName?: string;
  userId?: number;
  userName?: string;
  error?: string;
}

export interface ListPostLikesResponse {
  likes?: Like[];
  page?: PageInfo;
  error?: string;
}

export interface ListPostCommentsResponse {
  comments?: Comment[];
  page?: PageInfo;
  error?: string;
}

export interface ListPostReblogsResponse {
  reblogs?: Reblog[];
  page?: PageInfo;
  error?: string;
}

export interface SignUrlResponse {
  url?: string;
  error?: string;
}

export interface LoginResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
}

// New response types
export interface SearchBlogsResponse {
  blogs?: Blog[];
  page?: PageInfo;
  error?: string;
}

export interface BlogFollowGraphResponse {
  blogId?: number;
  blogName?: string;
  followers?: FollowEdge[];
  following?: FollowEdge[];
  followersCount?: number;
  followingCount?: number;
  nextPageToken?: string;
  error?: string;
}

export interface ListBlogsRecentActivityResponse {
  posts?: Post[];
  page?: PageInfo;
  error?: string;
}

export interface GetBlogResponse {
  blog?: Blog;
  error?: string;
}
