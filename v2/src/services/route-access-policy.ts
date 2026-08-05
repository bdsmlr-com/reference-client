const BLOG_ROUTE_RE = /^\/blog\/[^/]+\/?$/i;
const POST_ROUTE_RE = /^\/post\/\d+\/?$/;
const RELATED_POST_ROUTE_RE = /^\/post\/\d+\/related(?:\/for\/[^/]+)?\/?$/i;

export interface AnonymousRouteFeatureContext {
  moreLikeThisOnPost?: boolean;
}

export function isRelatedPostRoute(pathname: string): boolean {
  return RELATED_POST_ROUTE_RE.test(String(pathname || '').trim());
}

export function isAnonymousReadableRoute(
  pathname: string,
  features: AnonymousRouteFeatureContext = {},
): boolean {
  const normalizedPath = String(pathname || '').trim();
  if (!normalizedPath) {
    return false;
  }
  return BLOG_ROUTE_RE.test(normalizedPath)
    || POST_ROUTE_RE.test(normalizedPath)
    || (features.moreLikeThisOnPost === true && isRelatedPostRoute(normalizedPath));
}
