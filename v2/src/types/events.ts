/**
 * Typed CustomEvent definitions for component communication.
 *
 * Event Naming Convention:
 * - Click/selection events: `{entity}-click` or `{entity}-select` (internal)
 * - Change events: `{entity}-change`
 * - Action events: action name (e.g., `load-more`, `retry`, `close`)
 * - Navigation events: `navigate`
 *
 * Usage in Components:
 * ```typescript
 * // Dispatching
 * import type { PostSelectEvent, PostSelectDetail } from '../types/events.js';
 * this.dispatchEvent(new CustomEvent<PostSelectDetail>('post-select', { detail: { post } }));
 *
 * // Listening (in Lit templates)
 * @post-select=${this.handlePostSelect}
 * ```
 */

import type { ProcessedPost } from './post.js';
import type { Blog, PostType, PostVariant } from './api.js';

// ============================================================================
// Post Events
// ============================================================================

/**
 * Detail for post selection events.
 * Used by: post-card, post-feed-item (internal), post-grid, post-feed (bubbled)
 */
export interface PostSelectDetail {
  post: ProcessedPost;
}

/**
 * Internal event dispatched by post-card when clicked.
 * Caught by post-grid and re-emitted as post-click.
 */
export type PostSelectEvent = CustomEvent<PostSelectDetail>;

/**
 * Event dispatched by post-grid and post-feed when a post is clicked.
 * This is the public API that page scripts listen to.
 */
export type PostClickEvent = CustomEvent<PostSelectDetail>;

// ============================================================================
// Blog Events
// ============================================================================

/**
 * Detail for blog selection events.
 * Used by: blog-card
 */
export interface BlogClickDetail {
  blog: Blog;
}

/**
 * Event dispatched by blog-card when clicked.
 */
export type BlogClickEvent = CustomEvent<BlogClickDetail>;

// ============================================================================
// Filter Events
// ============================================================================

/**
 * Detail for type filter change events.
 * Used by: type-pills
 */
export interface TypesChangeDetail {
  types: PostType[];
}

/**
 * Event dispatched when post type filter selection changes.
 */
export type TypesChangeEvent = CustomEvent<TypesChangeDetail>;

/**
 * Detail for variant filter change events.
 * Used by: variant-pills
 */
export interface VariantChangeDetail {
  selection: 'all' | 'original' | 'reblog';
  variants: PostVariant[] | undefined;
}

/**
 * Event dispatched when variant filter selection changes.
 */
export type VariantChangeEvent = CustomEvent<VariantChangeDetail>;

// ============================================================================
// Sort Events
// ============================================================================

/**
 * Detail for sort change events.
 * Used by: sort-controls
 */
export interface SortChangeDetail {
  value: string;
}

/**
 * Event dispatched when sort selection changes.
 */
export type SortChangeEvent = CustomEvent<SortChangeDetail>;

// ============================================================================
// Load Footer Events
// ============================================================================

/**
 * Event dispatched when "Load More" button is clicked.
 * No detail payload.
 */
export type LoadMoreEvent = CustomEvent<void>;

/**
 * Detail for infinite scroll toggle events.
 * Used by: load-footer
 */
export interface InfiniteToggleDetail {
  enabled: boolean;
}

/**
 * Event dispatched when infinite scroll is toggled.
 */
export type InfiniteToggleEvent = CustomEvent<InfiniteToggleDetail>;

// ============================================================================
// Lightbox Events
// ============================================================================

/**
 * Detail for lightbox navigation events.
 * Used by: post-lightbox
 */
export interface LightboxNavigateDetail {
  direction: 'prev' | 'next';
  index: number;
}

/**
 * Event dispatched when navigating between posts in lightbox.
 */
export type LightboxNavigateEvent = CustomEvent<LightboxNavigateDetail>;

/**
 * Event dispatched when lightbox is closed.
 * No detail payload.
 */
export type LightboxCloseEvent = CustomEvent<void>;

// ============================================================================
// Error State Events
// ============================================================================

/**
 * Event dispatched when retry button is clicked.
 * No detail payload.
 */
export type RetryEvent = CustomEvent<void>;

// ============================================================================
// Event Name Constants
// ============================================================================

/**
 * Standardized event names for component communication.
 * Use these constants to ensure consistency across the codebase.
 */
export const EventNames = {
  // Post events
  POST_SELECT: 'post-select', // Internal: from post-card, post-feed-item
  POST_CLICK: 'post-click', // Public: from post-grid, post-feed

  // Blog events
  BLOG_CLICK: 'blog-click', // From blog-card

  // Filter events
  TYPES_CHANGE: 'types-change', // From type-pills
  VARIANT_CHANGE: 'variant-change', // From variant-pills
  SORT_CHANGE: 'sort-change', // From sort-controls

  // Load footer events
  LOAD_MORE: 'load-more', // From load-footer
  INFINITE_TOGGLE: 'infinite-toggle', // From load-footer

  // Lightbox events
  NAVIGATE: 'navigate', // From post-lightbox
  CLOSE: 'close', // From post-lightbox

  // Error state events
  RETRY: 'retry', // From error-state
} as const;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an event is a PostClickEvent.
 */
export function isPostClickEvent(event: Event): event is PostClickEvent {
  return event instanceof CustomEvent && 'post' in (event.detail || {});
}

/**
 * Type guard to check if an event is a BlogClickEvent.
 */
export function isBlogClickEvent(event: Event): event is BlogClickEvent {
  return event instanceof CustomEvent && 'blog' in (event.detail || {});
}

/**
 * Type guard to check if an event is a TypesChangeEvent.
 */
export function isTypesChangeEvent(event: Event): event is TypesChangeEvent {
  return event instanceof CustomEvent && 'types' in (event.detail || {});
}

/**
 * Type guard to check if an event is a VariantChangeEvent.
 */
export function isVariantChangeEvent(event: Event): event is VariantChangeEvent {
  return event instanceof CustomEvent && 'selection' in (event.detail || {});
}
