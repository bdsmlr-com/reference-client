/**
 * Blog name resolver abstraction layer.
 *
 * Current implementation: URL parameter (?blog=name)
 * Future implementation: Subdomain-based (name.site.com)
 */

export function getBlogName(): string {
  // Current: URL parameter
  const params = new URLSearchParams(window.location.search);
  return params.get('blog') || '';

  // Future: Subdomain-based
  // const subdomain = window.location.hostname.split('.')[0];
  // return subdomain !== 'www' && subdomain !== 'localhost' ? subdomain : '';
}

export function getUrlParam(key: string): string {
  const params = new URLSearchParams(window.location.search);
  return params.get(key) || '';
}

export function setUrlParams(params: Record<string, string>): void {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
  });
  window.history.replaceState({}, '', url.toString());
}
