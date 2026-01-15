import {
  clearActivityBlogs,
  clearBlogAvatarCache,
  clearBlogCache,
  clearBlogIdCache,
  clearBlogSearchCache,
  clearFollowGraphCache,
  clearHttpCache,
  clearPaginationCursorCache,
  clearRecentActivityCache,
  clearResponseCache,
  clearSearchCache,
  clearSWRCache,
  clearToken,
} from '../services/storage.js';
import { clearPostCache } from '../services/post-cache.js';
import { clearBlogTheme } from '../services/blog-theme.js';
import { isDevMode } from '../services/blog-resolver.js';

function getRedirectUrl(): string {
  if (document.referrer) {
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin === window.location.origin) {
        return referrer.href;
      }
    } catch {
      // Ignore invalid referrer values.
    }
  }
  return isDevMode() ? 'home.html' : '/';
}

function clearCaches(): void {
  clearToken();
  clearActivityBlogs();
  clearBlogCache();
  clearBlogIdCache();
  clearBlogAvatarCache();
  clearBlogSearchCache();
  clearSearchCache();
  clearResponseCache();
  clearFollowGraphCache();
  clearRecentActivityCache();
  clearSWRCache();
  clearPaginationCursorCache();
  clearHttpCache();
  clearPostCache();
  clearBlogTheme();
}

clearCaches();
window.alert('Cache cleared. Returning to the previous page.');
window.location.href = getRedirectUrl();
