// Pagination
export interface Pagination {
  page_size?: number;
  page_token?: string;
}

export interface PageInfo {
  nextPageToken?: string;
}

// Enums
export type PostType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PostVariant = 'ORIGINAL' | 'REBLOG';
export type Order = 0 | 1; // 0 = ASC, 1 = DESC

// Sort fields
export type PostSortField = 1 | 2 | 3 | 4 | 5 | 6; // CREATED_AT, LIKES_COUNT, COMMENTS_COUNT, REBLOGS_COUNT, MENTIONS_COUNT, NOTES_COUNT
export type BlogSortField = 'BLOG_SORT_FIELD_NAME' | 'ID' | 'FOLLOWERS_COUNT' | 'POSTS_COUNT' | 'CREATED_AT';

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
