import type { RelatedPerspectiveRole } from '../types/api.js';

export interface RelatedPerspective {
  role: RelatedPerspectiveRole;
  blogName: string;
  blogId?: number;
  fallbackApplied?: boolean;
}

export interface RelatedPerspectiveSet {
  authenticated: boolean;
  viewer?: RelatedPerspective;
  original: RelatedPerspective;
  reblogger?: RelatedPerspective;
  isReblog: boolean;
}

export type RelatedPerspectiveTab = RelatedPerspective;

function canonicalBlogName(perspective: RelatedPerspective): string {
  return perspective.blogName.trim();
}

function normalizedBlogName(perspective: RelatedPerspective): string {
  return canonicalBlogName(perspective).toLowerCase();
}

function isUsable(perspective: RelatedPerspective | undefined): perspective is RelatedPerspective {
  return Boolean(perspective && normalizedBlogName(perspective));
}

function hasPositiveBlogId(perspective: RelatedPerspective): perspective is RelatedPerspective & {
  blogId: number;
} {
  return Number.isFinite(perspective.blogId) && perspective.blogId! > 0;
}

export function selectDefaultRelatedPerspective(
  input: RelatedPerspectiveSet,
): RelatedPerspective | undefined {
  if (input.authenticated) {
    return isUsable(input.viewer) ? input.viewer : undefined;
  }

  if (!input.authenticated && input.isReblog) {
    if (isUsable(input.reblogger)) {
      return input.reblogger;
    }
    return { ...input.original, fallbackApplied: true };
  }

  return input.original;
}

export function buildRelatedPerspectiveTabs(
  input: RelatedPerspectiveSet,
): RelatedPerspectiveTab[] {
  const candidates = [
    input.authenticated ? input.viewer : undefined,
    input.original,
    input.isReblog ? input.reblogger : undefined,
  ];
  const seen = new Set<string>();

  return candidates.filter((perspective): perspective is RelatedPerspective => {
    if (!isUsable(perspective)) {
      return false;
    }

    const key = hasPositiveBlogId(perspective)
      ? `id:${perspective.blogId}`
      : `name:${normalizedBlogName(perspective)}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function relatedPerspectiveLabel(perspective: RelatedPerspective): string {
  const roleLabel: Record<RelatedPerspectiveRole, string> = {
    viewer: 'Your perspective',
    original: 'Original blog',
    reblogger: 'Reblogger',
  };

  return `${roleLabel[perspective.role]} (@${canonicalBlogName(perspective)})`;
}

export function relatedPerspectiveHref(
  seedPostId: number,
  perspective: RelatedPerspective,
): string {
  const base = `/post/${seedPostId}/related`;
  if (perspective.role === 'viewer') {
    return `${base}/for/you`;
  }

  return `${base}/for/${encodeURIComponent(canonicalBlogName(perspective))}`;
}
