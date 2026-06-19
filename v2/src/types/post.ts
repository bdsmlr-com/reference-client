import type { IdentityDecoration, Post, PostType } from './api.js';
import type { ResolvedLink } from '../services/link-resolver.js';

export type MediaRepresentationKind = 'UNSPECIFIED' | 'NONE' | 'ORIGINAL' | 'ANIMATED_VIDEO';
export type MediaItemKind = 'UNSPECIFIED' | 'IMAGE' | 'VIDEO' | 'AUDIO';

export interface MediaAsset {
  url: string;
  mimeType?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface MediaItem {
  kind: MediaItemKind;
  original?: MediaAsset;
  alternates?: MediaAsset[];
  preview?: MediaAsset;
  poster?: MediaAsset;
}

export interface MediaRepresentation {
  kind: MediaRepresentationKind;
  items: MediaItem[];
}

export interface TextContentBlock {
  kind: 'text';
  text: string;
}

export interface HtmlContentBlock {
  kind: 'html';
  html: string;
}

export interface MediaContentBlock {
  kind: 'media';
  items: MediaItem[];
}

export type NormalizedContentBlock = TextContentBlock | HtmlContentBlock | MediaContentBlock;

interface ApiTextBlock {
  text?: string;
}

interface ApiHtmlBlock {
  html?: string;
}

interface ApiMediaBlock {
  [key: string]: never;
}

interface ApiContentBlock {
  textBlock?: ApiTextBlock;
  htmlBlock?: ApiHtmlBlock;
  mediaBlock?: ApiMediaBlock;
}

interface PostWithContract extends Post {
  contentBlocks?: ApiContentBlock[];
  mediaRepresentation?: {
    kind?: string;
    items?: Array<{
      kind?: string | number;
      original?: Partial<MediaAsset>;
      alternates?: Array<Partial<MediaAsset>>;
      preview?: Partial<MediaAsset>;
      poster?: Partial<MediaAsset>;
    }>;
  };
}

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
  representationKind?: MediaRepresentationKind;
  items?: MediaItem[];
  contentBlocks?: NormalizedContentBlock[];
  originalUrl?: string;
  previewUrl?: string;
  posterUrl?: string;
}

const MEDIA_REPRESENTATION_KINDS = new Set<MediaRepresentationKind>(['UNSPECIFIED', 'NONE', 'ORIGINAL', 'ANIMATED_VIDEO']);
const MEDIA_ITEM_KINDS = new Set<MediaItemKind>(['UNSPECIFIED', 'IMAGE', 'VIDEO', 'AUDIO']);

function normalizeMediaRepresentationKind(kind: unknown): MediaRepresentationKind {
  if (typeof kind === 'string' && MEDIA_REPRESENTATION_KINDS.has(kind as MediaRepresentationKind)) {
    return kind as MediaRepresentationKind;
  }
  switch (kind) {
    case 1: return 'NONE';
    case 2: return 'ORIGINAL';
    case 3: return 'ANIMATED_VIDEO';
    default: return 'UNSPECIFIED';
  }
}

function normalizeMediaItemKind(kind: unknown): MediaItemKind {
  if (typeof kind === 'string' && MEDIA_ITEM_KINDS.has(kind as MediaItemKind)) {
    return kind as MediaItemKind;
  }
  switch (kind) {
    case 1: return 'IMAGE';
    case 2: return 'VIDEO';
    case 3: return 'AUDIO';
    default: return 'UNSPECIFIED';
  }
}

function normalizeMediaAsset(asset: Partial<MediaAsset> | undefined): MediaAsset | undefined {
  if (!asset?.url) return undefined;
  return {
    url: asset.url,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
  };
}

function normalizeMediaItems(post: PostWithContract): MediaItem[] {
  const contractItems = Array.isArray(post.mediaRepresentation?.items)
    ? post.mediaRepresentation?.items || []
    : [];

  return contractItems
    .map((item) => {
      const original = normalizeMediaAsset(item.original);
      if (!original) return null;
      return {
        kind: normalizeMediaItemKind(item.kind),
        original,
        alternates: (item.alternates || []).map((candidate) => normalizeMediaAsset(candidate)).filter(Boolean) as MediaAsset[],
        preview: normalizeMediaAsset(item.preview),
        poster: normalizeMediaAsset(item.poster),
      } satisfies MediaItem;
    })
    .filter(Boolean) as MediaItem[];
}


export function getOrderedContentBlocks(post: Post): NormalizedContentBlock[] {
  const contractPost = post as PostWithContract;
  const items = normalizeMediaItems(contractPost);
  const rawBlocks = Array.isArray(contractPost.contentBlocks) ? contractPost.contentBlocks : [];
  const content = post.content || {};

  if (rawBlocks.length === 0) {
    const normalizedFallback: NormalizedContentBlock[] = [];
    const html = typeof content.html === 'string' ? content.html.trim() : '';
    const text = typeof content.text === 'string' ? content.text.trim() : '';
    const body = typeof post.body === 'string' ? post.body.trim() : '';
    const title = typeof content.title === 'string' ? content.title.trim() : '';

    if (html) {
      normalizedFallback.push({ kind: 'html', html });
    } else if (text || body || title) {
      normalizedFallback.push({ kind: 'text', text: text || body || title });
    }

    if (items.length > 0) {
      normalizedFallback.push({ kind: 'media', items });
    }

    return normalizedFallback;
  }

  const normalized: NormalizedContentBlock[] = [];
  for (const block of rawBlocks) {
    if (block.htmlBlock?.html) {
      normalized.push({ kind: 'html', html: block.htmlBlock.html });
      continue;
    }
    if (block.textBlock?.text) {
      normalized.push({ kind: 'text', text: block.textBlock.text });
      continue;
    }
    if (block.mediaBlock !== undefined) {
      normalized.push({ kind: 'media', items });
    }
  }

  return normalized;
}

export function resolveMediaItemImageSource(item: MediaItem, surface: 'preview' | 'detail'): string {
  if (surface === 'preview') {
    return item.preview?.url || item.original?.url || '';
  }
  return item.original?.url || item.preview?.url || '';
}

export function resolveMediaItemVideoSource(item: MediaItem, representationKind?: MediaRepresentationKind): string {
  if (representationKind === 'ANIMATED_VIDEO') {
    return item.alternates?.[0]?.url || '';
  }
  return item.original?.url || item.alternates?.[0]?.url || '';
}

export function resolveMediaItemAudioSource(item: MediaItem): string {
  return item.original?.url || '';
}

export function resolveMediaItemPosterSource(item: MediaItem): string {
  return item.poster?.url || item.preview?.url || item.original?.url || '';
}

export interface RendererMediaSource {
  kind: 'image' | 'video' | 'audio';
  src: string;
  posterSrc?: string;
  alternateVideoSrc?: string;
  fallbackSrc?: string;
  forceImage?: boolean;
}

export function getMediaItems(media: MediaInfo | undefined): MediaItem[] {
  return media?.items || [];
}

export function getMediaItemCount(target: MediaInfo | Post | undefined): number {
  if (!target) return 0;
  if ('items' in target && Array.isArray((target as MediaInfo).items)) {
    return ((target as MediaInfo).items || []).length;
  }
  return getMediaItems(extractMedia(target as Post)).length;
}

export function describeMediaItemForSurface(
  item: MediaItem,
  representationKind: MediaRepresentationKind | undefined,
  surface: 'preview' | 'detail' | 'lightbox',
): RendererMediaSource | undefined {
  if (item.kind === 'AUDIO') {
    const src = resolveMediaItemAudioSource(item);
    return src ? { kind: 'audio', src } : undefined;
  }

  const alternateVideoSrc = item.kind === 'IMAGE' && representationKind === 'ANIMATED_VIDEO'
    ? resolveMediaItemVideoSource(item, representationKind)
    : '';

  if (item.kind === 'VIDEO') {
    const src = resolveMediaItemVideoSource(item, representationKind);
    if (!src) return undefined;
    return {
      kind: 'video',
      src,
      posterSrc: resolveMediaItemPosterSource(item) || undefined,
    };
  }

  const src = resolveMediaItemImageSource(item, surface === 'preview' ? 'preview' : 'detail');
  if (!src) return undefined;
  return {
    kind: 'image',
    src,
    posterSrc: alternateVideoSrc ? (resolveMediaItemPosterSource(item) || undefined) : undefined,
    alternateVideoSrc: alternateVideoSrc || undefined,
    fallbackSrc: alternateVideoSrc ? (item.original?.url || undefined) : undefined,
    forceImage: true,
  };
}

export function describePrimaryMediaForSurface(
  media: MediaInfo | undefined,
  surface: 'preview' | 'detail' | 'lightbox',
): RendererMediaSource | undefined {
  const item = getMediaItems(media)[0];
  if (item) {
    return describeMediaItemForSurface(item, media?.representationKind, surface);
  }

  if (!media) return undefined;
  if (media.type === 'audio' && media.audioUrl) {
    return { kind: 'audio', src: media.audioUrl };
  }
  if (media.type === 'video') {
    const src = media.videoUrl || media.url;
    if (!src) return undefined;
    return { kind: 'video', src, posterSrc: media.posterUrl || media.url };
  }
  if (media.url) {
    return { kind: 'image', src: media.url, forceImage: true };
  }
  return undefined;
}

export function extractMedia(post: Post): MediaInfo {
  const contractPost = post as PostWithContract;
  const content = post.content || {};
  const postType: PostType = post.type;
  const items = normalizeMediaItems(contractPost);
  const representationKind = normalizeMediaRepresentationKind(contractPost.mediaRepresentation?.kind);
  const contentBlocks = getOrderedContentBlocks(post);
  const html = content.html || '';
  const text = content.text || '';
  const title = content.title || '';
  const url = content.url || '';
  const quoteText = content.quoteText || '';
  const quoteSource = content.quoteSource || '';
  const preview = post.body || '';
  const firstItem = items[0];

  if (firstItem?.original?.url) {
    const baseInfo: Omit<MediaInfo, 'type'> = {
      title,
      text: preview || text,
      html: preview || html,
      representationKind,
      items,
      contentBlocks,
      originalUrl: firstItem.original.url,
      previewUrl: firstItem.preview?.url,
      posterUrl: firstItem.poster?.url,
    };

    if (representationKind === 'ANIMATED_VIDEO' && firstItem.kind === 'IMAGE') {
      const alternate = firstItem.alternates?.[0];
      if (alternate?.url) {
        return {
          ...baseInfo,
          type: 'video',
          url: firstItem.original.url,
          videoUrl: alternate.url,
        };
      }
      return {
        ...baseInfo,
        type: 'image',
        url: firstItem.original.url,
      };
    }

    if (firstItem.kind === 'VIDEO') {
      const companionImage = items.find((item, index) => index > 0 && item.kind === 'IMAGE' && item.original?.url);
      return {
        ...baseInfo,
        type: 'video',
        url: firstItem.poster?.url || firstItem.preview?.url || companionImage?.original?.url || firstItem.original.url,
        videoUrl: firstItem.original.url,
      };
    }

    if (firstItem.kind === 'AUDIO') {
      return {
        ...baseInfo,
        type: 'audio',
        audioUrl: firstItem.original.url,
      };
    }

    return {
      ...baseInfo,
      type: 'image',
      url: firstItem.original.url,
    };
  }

  switch (postType) {
    case 1:
      return { type: 'text', title, text: preview || text || html, html: preview || html, contentBlocks };
    case 5:
      return { type: 'link', linkUrl: url, title, html: preview || html, text: preview || text, contentBlocks };
    case 6:
      return { type: 'chat', title, text: preview || text || html, contentBlocks };
    case 7:
      return { type: 'quote', quoteText: quoteText || preview, quoteSource, html: preview || html, contentBlocks };
    default:
      return { type: 'none', title, text: preview || text, html: preview || html, contentBlocks };
  }
}

export function resolvePrimaryMediaUrl(media: MediaInfo | undefined): string {
  if (!media) return '';
  if (media.type === 'video') return media.videoUrl || media.url || '';
  if (media.type === 'audio') return media.audioUrl || media.url || '';
  return media.url || media.videoUrl || media.audioUrl || '';
}

export interface ProcessedPost extends Post {
  _media: MediaInfo;
  _reblog_variants?: { id: number; blogName?: string }[];
  _activityCreatedAtUnix?: number;
  _activityKindOverride?: 'post' | 'reblog' | 'like' | 'comment';
  _retrievalPolicy?: {
    imageVariant?: string;
    linkAllowed?: boolean;
    clickAction?: string;
    redactionMode?: string;
    overrideReason?: string;
    visibilityFraction?: number;
  };
}

export function extractRenderableTags(post: Post): string[] {
  if (post.tags && post.tags.length > 0) {
    return [...new Set(post.tags.filter(Boolean))];
  }

  const raw = `${post.body || ''} ${post.content?.html || ''}`;
  if (!raw.trim()) {
    return [];
  }

  const text = raw.replace(/<[^>]*>/g, ' ');
  const matches = text.match(/#([A-Za-z0-9][A-Za-z0-9_-]{0,63})/g) || [];
  const tags = matches.map((m) => m.slice(1).toLowerCase());
  return [...new Set(tags)];
}

export type PresentationSurface = 'card' | 'lightbox' | 'detail' | 'timeline';
export type PresentationPage = 'feed' | 'archive' | 'search' | 'activity' | 'post' | 'social';
export type PresentationActionKind = 'permalink' | 'like' | 'reblog' | 'comment' | 'engagementList';
export type PresentationActionOpenMode = 'toggle' | 'modal' | 'panel' | 'navigate';
export type PresentationActionChipMode = 'count' | 'none';

export interface PresentationContext {
  surface?: PresentationSurface;
  page?: PresentationPage;
  role?: 'primary' | 'cluster' | 'recommendation';
  interactionKind?: 'post' | 'reblog' | 'like' | 'comment';
  view?: string;
  env?: string;
}

export interface PresentationAction {
  kind: PresentationActionKind;
  label: string;
  contextId: string;
  visible: boolean;
  openMode: PresentationActionOpenMode;
  chipMode: PresentationActionChipMode;
  count?: number;
  icon?: string;
}

export interface PresentationActionSet {
  permalink: PresentationAction;
  like: PresentationAction;
  reblog: PresentationAction;
  comment: PresentationAction;
  engagementList: PresentationAction;
  some(predicate: (action: PresentationAction) => boolean): boolean;
  values(): PresentationAction[];
}

export interface PresentationIdentity {
  isReblog: boolean;
  isCanonicalCard: boolean;
  allowSelfSameDayLikeSuppression: boolean;
  postTypeIcon: string;
  permalink: ResolvedLink;
  legacyPostPermalink?: ResolvedLink | null;
  originPostPermalink?: ResolvedLink | null;
  originPostMissing?: boolean;
  originBlogGone?: boolean;
  viaPostPermalink?: ResolvedLink | null;
  originBlog?: ResolvedLink | null;
  viaBlog?: ResolvedLink | null;
  originBlogDecoration?: IdentityDecoration | null;
  viaBlogDecoration?: IdentityDecoration | null;
  originBlogLabel: string;
  viaBlogLabel: string;
  primaryBlogLabel: string;
  chipBlogLabel: string;
  summaryLine: string;
}

export type PresentationClickZone = 'card' | 'media';

export interface PresentationLayout {
  showBlogChip: boolean;
  compactMetadata: boolean;
  showTags: boolean;
  showRecommendations: boolean;
  clickZone: PresentationClickZone;
}

export interface MediaPresentationDescriptor extends MediaInfo {
  preset: string;
}

export interface PostPresentationModel {
  identity: PresentationIdentity;
  actions: PresentationActionSet;
  layout: PresentationLayout;
  media: MediaPresentationDescriptor;
  showPermalink: boolean;
  showBlogChip: boolean;
  compactMetadata: boolean;
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
  0: '❓',
  1: '📝',
  2: '🖼️',
  3: '🎬',
  4: '🔊',
  5: '🔗',
  6: '💬',
  7: '📜',
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

export function normalizeSortValue(val: string | null | undefined): string {
  if (!val) return 'newest';
  return SORT_OPTIONS.some((o) => o.value === val) ? val : 'newest';
}
