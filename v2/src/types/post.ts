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

  switch (postType) {
    case 1: // Text
      return { type: 'text', title, text: text || html };
    case 2: // Image
      return { type: 'image', url: file, html };
    case 3: // Video
      return { type: 'video', url: thumb, videoUrl: file, html };
    case 4: // Audio
      return { type: 'audio', audioUrl: file, html, text };
    case 5: // Link
      return { type: 'link', url: thumb, linkUrl: url, title, html, text };
    case 6: // Chat
      return { type: 'chat', title, text: text || html };
    case 7: // Quote
      return { type: 'quote', quoteText, quoteSource, html };
    default:
      return { type: 'none' };
  }
}

export interface ProcessedPost extends Post {
  _media: MediaInfo;
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
