// Pagination
export interface Pagination {
  page_size?: number;
  page_token?: string;
}

export interface PageInfo {
  nextPageToken?: string;
}

// Enums - API expects integer values, not strings!
export type PostType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
// PostVariant: 0=UNSPECIFIED, 1=ORIGINAL, 2=REBLOG
export type PostVariant = 0 | 1 | 2;
// Order: 0 = UNSPECIFIED, 1 = ASC, 2 = DESC
export type Order = 0 | 1 | 2;

// Sort fields - API expects integer values!
// PostSortField: 0=UNSPECIFIED, 1=CREATED_AT, 2=LIKES_COUNT, 3=COMMENTS_COUNT, 4=REBLOGS_COUNT, 5=MENTIONS_COUNT, 6=NOTES_COUNT, 7=ID
export type PostSortField = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
// BlogSortField: 0=UNSPECIFIED, 1=ID, 2=FOLLOWERS_COUNT, 3=POSTS_COUNT, 4=NAME, 5=CREATED_AT
export type BlogSortField = 0 | 1 | 2 | 3 | 4 | 5;

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

export interface ReblogVariant {
  id: number;
  blogName?: string;
}

export interface IdentityDecoration {
  kind?: string;
  token?: string;
  label?: string;
  icon?: string;
  priority?: number;
  visibility?: string[];
  source?: string;
}

// Core entities
export interface Post {
  id: number;
  blogId?: number;
  blogName?: string;
  type: PostType;
  title?: string;
  body?: string;
  content?: PostContent;
  tags?: string[];
  likesCount?: number;
  commentsCount?: number;
  reblogsCount?: number;
  mentionsCount?: number;
  notesCount?: number;
  originPostId?: number;
  originBlogId?: number;
  originBlogName?: string;
  createdAtUnix?: number;
  updatedAtUnix?: number;
  deletedAtUnix?: number;
  originDeletedAtUnix?: number;
  variant?: PostVariant;
  reblog_variants?: ReblogVariant[];
  blogIdentityDecorations?: IdentityDecoration[];
  originBlogIdentityDecorations?: IdentityDecoration[];
  originPostMissing?: boolean;
}

export interface InteractionCluster {
  label?: string;
  interactions?: Post[];
}

export interface TimelineItem {
  type: 0 | 1 | 2; // UNSPECIFIED, POST, CLUSTER
  post?: Post;
  cluster?: InteractionCluster;
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
  interests?: BlogPublicInterests;
  personals?: BlogPublicPersonals;
  privacy?: BlogPrivacy;
  identityDecorations?: IdentityDecoration[];
}

export interface BlogPublicInterests {
  maledom?: boolean;
  femdom?: boolean;
  lesbian?: boolean;
  gay?: boolean;
  sissy?: boolean;
  latex?: boolean;
  gifs?: boolean;
  extreme?: boolean;
  vanilla?: boolean;
  vintage?: boolean;
  art?: boolean;
  funny?: boolean;
  hentai?: boolean;
  journal?: boolean;
  quotes?: boolean;
  cartoon?: boolean;
  other?: boolean;
}

export interface BlogPublicPersonals {
  labels?: Record<string, string>;
}

export interface BlogPrivacy {
  isPrivate?: boolean;
  isPublic?: boolean;
}

export interface User {
  id: number;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface Like {
  id: number;
  postId?: number;
  userId?: number;
  blogId?: number;
  blogName?: string;
  createdAtUnix?: number;
}

export interface LikeState {
  liked: boolean;
  likesCount?: number;
}

export interface PostLikeState {
  postId: number;
  liked: boolean;
}

export interface PostReblogState {
  postId: number;
  actorReblogCount: number;
}

export interface SignedActorAssertion {
  token: string;
}

export interface WriteError {
  code?: string;
  message?: string;
}

export interface LikePostRequest {
  actor?: SignedActorAssertion;
  actingBlogId?: number;
  postId: number;
}

export interface LikePostResponse {
  ok?: boolean;
  action?: string;
  postId?: number;
  actingBlogId?: number;
  state?: LikeState;
  error?: WriteError;
}

export interface UnlikePostRequest {
  actor?: SignedActorAssertion;
  actingBlogId?: number;
  postId: number;
}

export interface UnlikePostResponse {
  ok?: boolean;
  action?: string;
  postId?: number;
  actingBlogId?: number;
  state?: LikeState;
  error?: WriteError;
}

export interface ReblogPostRequest {
  actor?: SignedActorAssertion;
  actingBlogId?: number;
  postId: number;
  comment?: string;
  keepComments?: boolean;
  tags?: string[];
}

export interface ReblogPostResponse {
  ok?: boolean;
  action?: string;
  postId?: number;
  actingBlogId?: number;
  createdReblogPostId?: number;
  error?: WriteError;
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

export interface CommentPostRequest {
  actor?: SignedActorAssertion;
  actingBlogId?: number;
  postId: number;
  comment: string;
}

export interface CommentPostResponse {
  ok?: boolean;
  action?: string;
  postId?: number;
  actingBlogId?: number;
  error?: WriteError;
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
  perspective_blog_name?: string;
  facetMode?: 'off' | 'boost' | 'suppress' | 'require' | 'custom';
  viewerInterestMatchWeight?: number;
  viewerPersonalMatchWeight?: number;
  viewerInterestMissWeight?: number;
  viewerPersonalMissWeight?: number;
  seedInterestMatchWeight?: number;
  seedPersonalMatchWeight?: number;
  seedInterestMissWeight?: number;
  seedPersonalMissWeight?: number;
}

export interface ListBlogPostsRequest {
  blog_id: number;
  page?: Pagination;
  sort_field?: PostSortField;
  order?: Order;
  post_types?: PostType[];
  variants?: PostVariant[];
  activity_kinds?: Array<'post' | 'reblog' | 'like' | 'comment'>;
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

export interface BatchGetLikeStatesRequest {
  postIds: number[];
  actingBlogId: number;
}

export interface BatchGetLikeStatesResponse {
  states?: PostLikeState[];
}

export interface BatchGetReblogStatesRequest {
  postIds: number[];
  actingBlogId: number;
}

export interface BatchGetReblogStatesResponse {
  states?: PostReblogState[];
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

export interface GetPostRequest {
  post_id: number;
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
  sessionId?: string;
  pageNumber?: number;
  pageSize?: number;
  totalVisibleSoFar?: number;
  searchStatus?: 'warming' | 'ready' | 'exhausted' | 'failed' | string;
  hasMore?: boolean;
  timelineItems?: TimelineItem[];
  error?: string;
}

export interface ListBlogPostsResponse {
  posts?: Post[];
  page?: PageInfo;
  timelineItems?: TimelineItem[];
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

export interface GetPostResponse {
  post?: Post;
  error?: string;
}

export interface BatchGetPostsRequest {
  post_ids: number[];
}

export interface BatchGetPostsResponse {
  posts?: Post[];
  error?: string;
}
