/**
 * Shared API Client Instance
 *
 * This module exports a pre-configured ApiClient instance for use across all page scripts.
 * The client uses environment variables for configuration and provides a clean import path.
 *
 * Usage:
 * ```typescript
 * import { apiClient } from '../services/client.js';
 *
 * // Access namespaced APIs
 * const posts = await apiClient.posts.list({ blog_id: 123 });
 * const blogs = await apiClient.blogs.search({ query: 'art' });
 * const graph = await apiClient.followGraph.getCached({ blog_id: 123, direction: 1 });
 *
 * // Identity resolution
 * const blogId = await apiClient.identity.resolveNameToId('kinkyoffice');
 *
 * // Media operations
 * const exists = await apiClient.media.checkImageExists(url);
 * ```
 *
 * @module services/client
 */

import { defaultApiClient } from './api.js';

/**
 * Pre-configured API client instance.
 *
 * Provides access to all API namespaces:
 * - `apiClient.posts` - Post listing and search operations
 * - `apiClient.blogs` - Blog search and metadata operations
 * - `apiClient.followGraph` - Follow graph operations (followers/following)
 * - `apiClient.recentActivity` - Merged feed from multiple blogs
 * - `apiClient.engagement` - Post likes, comments, and reblogs
 * - `apiClient.media` - URL signing and image validation
 * - `apiClient.identity` - Blog name/ID resolution
 *
 * Each namespace supports multiple caching strategies:
 * - Basic (no caching)
 * - Cached (TTL-based caching)
 * - SWR (stale-while-revalidate)
 * - WithFallback (stale data fallback on errors)
 * - WithPartialRecovery (partial response recovery for timeouts)
 */
export const apiClient = defaultApiClient;

// Re-export the ApiClient class for cases where custom configuration is needed
export { ApiClient } from './api.js';
export type { ApiClientConfig } from './api.js';
