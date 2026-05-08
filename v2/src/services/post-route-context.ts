import type { ProcessedPost } from '../types/post.js';
import { buildPageUrl } from './blog-resolver.js';

export type PostRouteSource =
  | 'search'
  | 'archive'
  | 'activity'
  | 'feed'
  | 'follower-feed'
  | 'social'
  | 'direct';

function encodeQuery(query: string): string {
  return `/search?q=${encodeURIComponent(query)}`;
}

function quoteTokenIfNeeded(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '""';
  }
  if (/[\s"]/u.test(trimmed)) {
    return `"${trimmed.replace(/"/g, '\\"')}"`;
  }
  return trimmed;
}

function buildTagExpression(tag: string): string {
  return `tag:${quoteTokenIfNeeded(tag)}`;
}

function extractViaBlog(post: ProcessedPost): string | null {
  const blogName = `${post.blogName || ''}`.trim().replace(/^@+/, '');
  return blogName || null;
}

function extractOriginBlog(post: ProcessedPost): string | null {
  const originBlogName = `${post.originBlogName || ''}`.trim().replace(/^@+/, '');
  return originBlogName || null;
}

export function normalizePostSource(value: string | null | undefined): PostRouteSource {
  switch ((value || '').trim()) {
    case 'search':
    case 'archive':
    case 'activity':
    case 'feed':
    case 'follower-feed':
    case 'social':
      return value as PostRouteSource;
    default:
      return 'direct';
  }
}

export function inferPostSourceFromPath(pathname: string): PostRouteSource {
  if (pathname.startsWith('/search')) return 'search';
  if (pathname.startsWith('/archive') || pathname.endsWith('/archive')) return 'archive';
  if (pathname.startsWith('/activity') || pathname.endsWith('/activity')) return 'activity';
  if (pathname.startsWith('/follower-feed') || pathname.endsWith('/follower-feed')) return 'follower-feed';
  if (pathname.startsWith('/feed') || pathname.endsWith('/feed')) return 'feed';
  return 'direct';
}

export function buildPostHref(postId: number | string, from: PostRouteSource): string {
  const base = `/post/${postId}`;
  return from === 'direct' ? base : `${base}?from=${encodeURIComponent(from)}`;
}

export function buildContextualTagSearchHref(
  tag: string,
  post: ProcessedPost,
  from: PostRouteSource,
): string {
  const tagExpr = buildTagExpression(tag);
  const viaBlog = extractViaBlog(post);
  const originBlog = extractOriginBlog(post);

  if (from === 'archive' || from === 'activity') {
    return encodeQuery(viaBlog ? `${tagExpr} blog:${viaBlog}` : tagExpr);
  }

  if (from === 'feed' || from === 'follower-feed' || from === 'social') {
    if (viaBlog && originBlog && viaBlog !== originBlog) {
      return encodeQuery(`${tagExpr} (blog:${originBlog} | blog:${viaBlog})`);
    }
    if (originBlog || viaBlog) {
      return encodeQuery(`${tagExpr} blog:${originBlog || viaBlog}`);
    }
  }

  return encodeQuery(tagExpr);
}

export function buildScopedReblogDetailTagHref(
  tag: string,
  blogName: string | null | undefined,
  from: PostRouteSource,
): string {
  const tagExpr = buildTagExpression(tag);
  const normalizedBlog = `${blogName || ''}`.trim().replace(/^@+/, '');

  if (from === 'search' || !normalizedBlog) {
    return encodeQuery(tagExpr);
  }

  return `${buildPageUrl('archive', normalizedBlog)}?q=${encodeURIComponent(tagExpr)}`;
}
