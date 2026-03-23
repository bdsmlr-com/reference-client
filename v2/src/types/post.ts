import type { Post, PostContent, PostType } from './api.js';

export interface MediaInfo {
  type: 'image' | 'video' | 'audio' | 'link' | 'text' | 'chat' | 'quote' | 'none';
  url?: string;
  videoUrl?: string;
  audioUrl?: string;
  linkUrl?: string;
  title?: string;
  text?: string;
  html?: string;
  quoteText?: string;
  quoteSource?: string;
}

export function extractMedia(post: Post): MediaInfo {
  const content: PostContent = post.content || {};
  const postType: PostType = post.type;
  
  const files = content.files || [];
  const file = files[0];
  const thumb = content.thumbnail;
  const html = content.html || '';
  const text = content.text || '';
  const title = content.title || '';
  const url = content.url || '';
  const quoteText = content.quoteText || '';
  const quoteSource = content.quoteSource || '';

  // Use the post.body (cleaned by backend) as a fallback for all types
  const preview = post.body || '';

  switch (postType) {
    case 1: // Text
      return { type: 'text', title, text: preview || text || html };
    case 2: // Image
      return { type: 'image', url: file, html: preview || html };
    case 3: // Video
      // Fallback: If no dedicated thumbnail, use the video file itself as the source
      // imgproxy can often extract a frame from the video.
      return { type: 'video', url: thumb || file, videoUrl: file, html: preview || html };
    case 4: // Audio
      return { type: 'audio', audioUrl: file, html: preview || html, text: preview || text };
    case 5: // Link
      return { type: 'link', url: thumb, linkUrl: url, title, html: preview || html, text: preview || text };
    case 6: // Chat
      return { type: 'chat', title, text: preview || text || html };
    case 7: // Quote
      return { type: 'quote', quoteText: quoteText || preview, quoteSource, html: preview || html };
    default:
      return { type: 'none' };
  }
}

export interface ProcessedPost extends Post {
  _media: MediaInfo;
  _reblog_variants?: { id: number; blogName?: string }[];
  _activityCreatedAtUnix?: number;
}

export type PresentationActionKind = 'permalink';

export interface PresentationAction {
  kind: PresentationActionKind;
  label: string;
  contextId: string;
}

export interface PostPresentationModel {
  showPermalink: boolean;
  showBlogChip: boolean;
  compactMetadata: boolean;
  actions: PresentationAction[];
  linkContexts: {
    permalink: string;
    originBlog: string;
    viaBlog: string;
  };
}

export interface ViewStats {
  found: number;
  deleted: number;
  dupes: number;
  notFound: number;
}

export const POST_TYPE_LABELS: Record<PostType, string> = {
  0: 'Unspecified',
  1: 'Text',
  2: 'Image',
  3: 'Video',
  4: 'Audio',
  5: 'Link',
  6: 'Chat',
  7: 'Quote',
};

export const POST_TYPE_ICONS: Record<PostType, string> = {
  0: '❓', // Unspecified
  1: '📝', // Text
  2: '🖼️', // Image
  3: '🎬', // Video
  4: '🔊', // Audio
  5: '🔗', // Link
  6: '💬', // Chat
  7: '📜', // Quote
};

export interface SortOption {
  value: string;
  label: string;
  field: number;
  order: number;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: 'newest', label: 'Newest', field: 1, order: 2 },
  { value: 'popular', label: 'Most popular', field: 6, order: 2 },
  { value: 'reblogged', label: 'Most reblogged', field: 4, order: 2 },
  { value: 'liked', label: 'Most liked', field: 2, order: 2 },
  { value: 'commented', label: 'Most commented', field: 3, order: 2 },
  { value: 'oldest', label: 'Oldest', field: 1, order: 1 },
  { value: 'unpopular', label: 'Least popular', field: 6, order: 1 },
];

/**
 * Strictly sanitizes a sort value from the URL.
 * Only allows known semantic names, defaults to 'newest' for anything else.
 */
export function normalizeSortValue(val: string | null | undefined): string {
  if (!val) return 'newest';
  return SORT_OPTIONS.some((o) => o.value === val) ? val : 'newest';
}
