const BLOG_ROUTE_RE = /^\/blog\/[^/]+\/?$/i;
const POST_ROUTE_RE = /^\/post\/\d+\/?$/;

export function isAnonymousReadableRoute(pathname: string): boolean {
  const normalizedPath = String(pathname || '').trim();
  if (!normalizedPath) {
    return false;
  }
  return BLOG_ROUTE_RE.test(normalizedPath) || POST_ROUTE_RE.test(normalizedPath);
}
