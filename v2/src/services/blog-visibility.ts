import { isLoggedIn } from "./profile.js";
import type { Blog } from "../types/api.js";

function decorationTokens(blog: Blog | null | undefined): Set<string> {
  return new Set((blog?.identityDecorations || []).map((decoration) => String(decoration?.token || '').trim()).filter(Boolean));
}

function blogIsFollowerGatedForViewer(blog: Blog | null | undefined): boolean {
  return decorationTokens(blog).has('restricted');
}

export function blogIsRestrictedForViewer(blog: Blog | null | undefined): boolean {
  return Boolean(blog?.privacy?.isPrivate) || blogIsFollowerGatedForViewer(blog);
}

export function getRestrictedEmptyStateMessage(
  blog: Blog | null | undefined,
  surface: 'archive' | 'activity',
): string {
  if (!blogIsRestrictedForViewer(blog)) {
    return '';
  }
  if (!isLoggedIn()) {
    return 'This blog is private.';
  }
  if (blogIsFollowerGatedForViewer(blog)) {
    if (surface === 'activity') {
      return 'This blog is follower-only. Follow and get approved to view this activity.';
    }
    return 'This blog is follower-only. Follow and get approved to browse these posts.';
  }
  return 'This blog is private.';
}
