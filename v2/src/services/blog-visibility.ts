import type { Blog } from "../types/api.js";

function decorationTokens(blog: Blog | null | undefined): Set<string> {
  return new Set((blog?.identityDecorations || []).map((decoration) => String(decoration?.token || '').trim()).filter(Boolean));
}

export function blogIsRestrictedForViewer(blog: Blog | null | undefined): boolean {
  return decorationTokens(blog).has('restricted');
}

export function getRestrictedEmptyStateMessage(
  blog: Blog | null | undefined,
  surface: 'archive' | 'activity',
): string {
  if (!blogIsRestrictedForViewer(blog)) {
    return '';
  }
  if (surface === 'archive') {
    return 'This archive is follower-only. Follow and get approved to browse these posts.';
  }
  return 'This activity is follower-only. Follow and get approved to view it.';
}
