/**
 * Blog name resolver abstraction layer.
 *
 * Supports multiple routing modes:
 * 1. Subdomain-based (production): blogname.bdsmlr.com
 * 2. Path-based routing: /:blogname/:page/
 * 3. Query param: ?blog=name (backwards compatibility)
 * 4. localStorage persistence
 *
 * Priority: Subdomain > URL path > URL param > localStorage
 */

const BLOG_STATE_KEY = 'bdsmlr_current_blog';

// Domains where subdomain routing is enabled
// Add production domain(s) here when deploying
const SUBDOMAIN_ENABLED_DOMAINS = ['bdsmlr.com', 'bdsmlr.localhost'];

// Subdomains that are NOT blog names (reserved)
const RESERVED_SUBDOMAINS = ['www', 'api', 'cdn', 'static', 'admin', 'app'];

// Pages that support path-based blog routing
const BLOG_PAGES = ['archive', 'posts', 'feed', 'social', 'masquerade', 'timeline', 'following'];

// Reserved page routes that are NOT blog names
const RESERVED_PAGE_ROUTES = [
  'home',
  'search',
  'blogs',
  'activity',
  'feed',
  'posts',
  'following',
  'timeline',
  'clear-cache',
];

/**
 * Check if the current user is in admin mode.
 * Set via ?admin=true query param or localStorage 'bdsmlr_admin' flag.
 */
export function isAdminMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') === 'true') {
    localStorage.setItem('bdsmlr_admin', 'true');
    return true;
  }
  return localStorage.getItem('bdsmlr_admin') === 'true';
}

/**
 * Check if a string is a reserved page route (not a valid blog name).
 */
export function isReservedPageRoute(name: string): boolean {
  return RESERVED_PAGE_ROUTES.includes(name.toLowerCase());
}

/**
 * Check if the current hostname is a subdomain-enabled domain.
 * Returns true if we're on a domain that supports subdomain blog routing.
 */
export function isSubdomainEnabledDomain(): boolean {
  const hostname = window.location.hostname.toLowerCase();

  // Disable subdomain routing on API/staging hosts; use path-based routing instead.
  if (hostname.startsWith('api-') || hostname.startsWith('api.')) {
    return false;
  }

  // Check if hostname ends with any of the enabled domains
  return SUBDOMAIN_ENABLED_DOMAINS.some((domain) => {
    // Exact match (e.g., bdsmlr.com)
    if (hostname === domain) {
      return true;
    }
    // Subdomain match (e.g., blogname.bdsmlr.com)
    if (hostname.endsWith('.' + domain)) {
      return true;
    }
    return false;
  });
}

/**
 * Check if we're currently in subdomain mode.
 * Returns true if the hostname contains a blog name as subdomain.
 */
export function isSubdomainMode(): boolean {
  const blogName = getBlogNameFromSubdomain();
  return blogName !== '';
}

/**
 * Extract blog name from subdomain.
 * Returns the blog name if we're on a subdomain like blogname.bdsmlr.com,
 * or empty string if not applicable.
 *
 * Examples:
 *   kinkyoffice.bdsmlr.com -> 'kinkyoffice'
 *   www.bdsmlr.com -> '' (reserved subdomain)
 *   bdsmlr.com -> '' (no subdomain)
 *   localhost:5173 -> '' (not a subdomain-enabled domain)
 *   api-staging.bdsmlr.com -> '' (subdomain routing disabled for api-* hosts)
 */
export function getBlogNameFromSubdomain(): string {
  // First check if subdomain routing is enabled for this domain
  // This handles special hosts like api-staging where we want path-based routing
  if (!isSubdomainEnabledDomain()) {
    return '';
  }

  const hostname = window.location.hostname.toLowerCase();

  // Find which enabled domain we're on
  const enabledDomain = SUBDOMAIN_ENABLED_DOMAINS.find((domain) => {
    return hostname === domain || hostname.endsWith('.' + domain);
  });

  if (!enabledDomain) {
    // Not on a subdomain-enabled domain
    return '';
  }

  // Check if hostname has a subdomain
  if (hostname === enabledDomain) {
    // No subdomain (e.g., bdsmlr.com)
    return '';
  }

  // Extract subdomain: "blogname.bdsmlr.com" -> "blogname"
  const subdomain = hostname.slice(0, -(enabledDomain.length + 1));

  // Check for nested subdomains (e.g., foo.bar.bdsmlr.com)
  // We only support single-level subdomains for blog names
  if (subdomain.includes('.')) {
    return '';
  }

  // Check if it's a reserved subdomain
  if (RESERVED_SUBDOMAINS.includes(subdomain)) {
    return '';
  }

  return subdomain;
}

/**
 * Extract blog name from URL path.
 * Supports patterns like:
 *   /:blogname/timeline/ -> blogname
 *   /:blogname/archive/ -> blogname
 *   /:blogname/ -> blogname (defaults to archive)
 *
 * Returns empty string if not a path-based blog URL.
 */
export function getBlogNameFromPath(): string {
  const pathname = window.location.pathname;

  // Match /:blogname/:page pattern or /:blogname/
  // Skip if starts with /src/pages (dev mode) or ends with .html
  if (pathname.includes('/src/pages/') || pathname.endsWith('.html')) {
    return '';
  }

  // Remove leading slash and split
  const parts = pathname.slice(1).split('/').filter(Boolean);

  if (parts.length === 0) {
    return '';
  }

  // First part is blog name, second is page (optional)
  const potentialBlog = parts[0];
  const potentialPage = parts[1] || '';

  // Check if first part is a reserved page route (not a blog name)
  // e.g., /home/, /search/, /blogs/, /activity/
  if (RESERVED_PAGE_ROUTES.includes(potentialBlog)) {
    return '';
  }

  // Validate that this looks like a blog route:
  // - If second part is a known page, first is the blog name
  // - If only one part, could be a blog name (default to archive)
  if (BLOG_PAGES.includes(potentialPage) || (parts.length === 1 && potentialBlog)) {
    return potentialBlog;
  }

  return '';
}

/**
 * Get current page name from URL path.
 * Returns 'archive' as default for /:blogname/ routes and subdomain root.
 */
export function getPageFromPath(): string {
  const pathname = window.location.pathname;

  // Dev mode or direct HTML access
  if (pathname.includes('/src/pages/') || pathname.endsWith('.html')) {
    const match = pathname.match(/\/([^\/]+)\.html/);
    return match ? match[1] : 'home';
  }

  const parts = pathname.slice(1).split('/').filter(Boolean);

  // In subdomain mode, path structure is simpler: /:page/ (no blog in path)
  if (isSubdomainMode()) {
    if (parts.length === 0) {
      return 'archive'; // Root of subdomain defaults to archive
    }
    if (parts.length >= 1 && BLOG_PAGES.includes(parts[0])) {
      return parts[0];
    }
    // Could be a non-blog page like /search/
    if (parts.length >= 1) {
      return parts[0];
    }
    return 'archive';
  }

  // Path-based routing: /:blogname/:page/
  if (parts.length >= 2 && BLOG_PAGES.includes(parts[1])) {
    return parts[1];
  }

  // Default to archive for /:blogname/ routes
  if (parts.length === 1) {
    return 'archive';
  }

  return 'home';
}

/**
 * Get the current blog name from URL context only.
 * Priority: Subdomain > URL path > URL param > localStorage
 *
 * IMPORTANT: This function does NOT save to localStorage. The primary blog
 * should only be set via explicit user action (e.g., on home.html).
 * Navigation to view other blogs should not override the user's primary blog.
 * See SOC-017 for details.
 */
export function getBlogName(): string {
  // Try subdomain-based routing first (production)
  const subdomainBlog = getBlogNameFromSubdomain();
  if (subdomainBlog) {
    return subdomainBlog;
  }

  // Try path-based routing
  const pathBlog = getBlogNameFromPath();
  if (pathBlog) {
    return pathBlog;
  }

  // Fall back to URL parameter for backwards compatibility
  const params = new URLSearchParams(window.location.search);
  const urlBlog = params.get('blog');

  if (urlBlog) {
    return urlBlog;
  }

  // Fall back to localStorage
  return getStoredBlogName();
}

/**
 * Get blog name from localStorage only.
 * This is the user's "primary" blog - the one they set on the home page.
 */
export function getStoredBlogName(): string {
  return localStorage.getItem(BLOG_STATE_KEY) || '';
}

/**
 * Alias for getStoredBlogName for semantic clarity.
 * Returns the user's primary/pinned blog from localStorage.
 * Use this for nav links that should point to the user's blog, not the viewed blog.
 */
export function getPrimaryBlogName(): string {
  return getStoredBlogName();
}

/**
 * Get the blog currently being viewed from URL context.
 * Priority: Subdomain > URL path > URL param
 * Does NOT fall back to localStorage.
 */
export function getViewedBlogName(): string {
  // Try subdomain-based routing first (production)
  const subdomainBlog = getBlogNameFromSubdomain();
  if (subdomainBlog) {
    return subdomainBlog;
  }

  // Try path-based routing
  const pathBlog = getBlogNameFromPath();
  if (pathBlog) {
    return pathBlog;
  }

  // Fall back to URL parameter
  const params = new URLSearchParams(window.location.search);
  return params.get('blog') || '';
}

/**
 * Save blog name to localStorage.
 * Reserved page routes (home, search, blogs, etc.) are NOT stored.
 */
export function setStoredBlogName(blogName: string): void {
  // Don't store reserved page routes as blog names (HOME-005 fix)
  if (blogName && !RESERVED_PAGE_ROUTES.includes(blogName.toLowerCase())) {
    localStorage.setItem(BLOG_STATE_KEY, blogName);
  } else if (!blogName) {
    localStorage.removeItem(BLOG_STATE_KEY);
  }
  // If blogName is a reserved route, silently ignore (don't store, don't clear existing)
}

/**
 * Clear stored blog name
 */
export function clearStoredBlogName(): void {
  localStorage.removeItem(BLOG_STATE_KEY);
}

export function getUrlParam(key: string): string {
  const params = new URLSearchParams(window.location.search);
  return params.get(key) || '';
}

/**
 * Check if the blog name is already present in the URL path.
 * Used to avoid adding redundant ?blog= query params.
 *
 * Returns true if:
 * - We're in subdomain mode (blog is in hostname)
 * - Blog name is in the URL path (path-based routing)
 */
export function isBlogInPath(): boolean {
  // Check subdomain mode first
  if (getBlogNameFromSubdomain()) {
    return true;
  }
  // Check path-based routing
  return getBlogNameFromPath() !== '';
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

/**
 * Check if we're in development mode.
 * In the new SPA, we always use path-based routing.
 */
export function isDevMode(): boolean {
  return false;
}

/**
 * Build URL for a page, using the appropriate routing strategy:
 * - Subdomain mode: blogname.bdsmlr.com
 * - Path mode: /:blogname/:page
 *
 * @param page - The page name (e.g., 'posts', 'archive')
 * @param blogName - Optional blog name for blog-specific pages
 * @param queryParams - Additional query parameters
 */
export function buildPageUrl(
  page: string,
  blogName?: string,
  queryParams?: Record<string, string>
): string {
  let url: string;

  if (isSubdomainMode()) {
    // Subdomain mode: blogname.bdsmlr.com
    const currentBlog = getBlogNameFromSubdomain();

    if (blogName && BLOG_PAGES.includes(page) && blogName !== currentBlog) {
      // Different blog: need full subdomain URL
      url = buildSubdomainUrl(blogName, page, queryParams);
      return url; // buildSubdomainUrl already handles query params
    } else {
      // Same blog or non-blog page: relative path
      url = `/${page}`;
    }
  } else {
    // Production path-based routing: /:blogname/:page
    if (blogName && BLOG_PAGES.includes(page)) {
      url = `/${blogName}/${page}`;
    } else {
      // Non-blog pages: /:page
      url = `/${page}`;
    }
  }

  // Append query params if any
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  return url;
}

/**
 * Build a full URL for a blog's subdomain.
 * Used when navigating to a different blog in subdomain mode.
 *
 * @param blogName - The blog name to build URL for
 * @param page - The page name (defaults to archive)
 * @param queryParams - Additional query parameters
 */
export function buildSubdomainUrl(
  blogName: string,
  page: string = 'archive',
  queryParams?: Record<string, string>
): string {
  // Find the base domain from current hostname
  const hostname = window.location.hostname.toLowerCase();
  const enabledDomain = SUBDOMAIN_ENABLED_DOMAINS.find((domain) => {
    return hostname === domain || hostname.endsWith('.' + domain);
  });

  // Use the first enabled domain as fallback
  const baseDomain = enabledDomain || SUBDOMAIN_ENABLED_DOMAINS[0];
  const protocol = window.location.protocol;

  // Build subdomain URL
  let url = `${protocol}//${blogName}.${baseDomain}`;

  // Add page path - always include page name for URL consistency (URL-003 fix)
  url += `/${page}/`;

  // Append query params if any
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  return url;
}

/**
 * Build URL for navigating to a blog's page.
 */
export function buildBlogPageUrl(blogName: string, page: string = 'archive'): string {
  return buildPageUrl(page, blogName);
}

/**
 * Default post types (all types selected).
 * Used to determine if types param should be included in URL.
 */
export const DEFAULT_POST_TYPES = [1, 2, 3, 4, 5, 6, 7];

/**
 * Check if the given types array matches the default (all types selected).
 * Used to avoid adding redundant ?types=1,2,3,4,5,6,7 to URLs.
 * Types are persisted via localStorage preferences, so URL param is only
 * needed when user has customized their selection (URL-002 fix).
 */
export function isDefaultTypes(types: number[]): boolean {
  if (types.length !== DEFAULT_POST_TYPES.length) {
    return false;
  }
  // Check if arrays contain same elements (order-independent)
  const sorted = [...types].sort((a, b) => a - b);
  return sorted.every((val, idx) => val === DEFAULT_POST_TYPES[idx]);
}
