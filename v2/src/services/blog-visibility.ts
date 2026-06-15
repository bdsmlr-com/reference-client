import type { Blog } from "../types/api.js";

function decorationTokens(blog: Blog | null | undefined): Set<string> {
  return new Set((blog?.identityDecorations || []).map((decoration) => String(decoration?.token || '').trim()).filter(Boolean));
}

export function blogIsRestrictedForViewer(blog: Blog | null | undefined): boolean {
  return Boolean(blog?.privacy?.isPrivate) || decorationTokens(blog).has('restricted');
}

export function getRestrictedEmptyStateMessage(
  blog: Blog | null | undefined,
  surface: 'archive' | 'activity',
): string {
  void surface;
  if (!blogIsRestrictedForViewer(blog)) {
    return '';
  }
  return 'This blog is private.';
}
