/**
 * Shared UI constants for consistent behavior across components
 */

/**
 * Maximum number of tags to display in post components.
 * Applies to both grid cards (post-card) and feed items (post-feed-item).
 * When exceeded, shows "+X more" indicator.
 */
export const MAX_VISIBLE_TAGS = 5;

/**
 * Responsive breakpoint pixel values for media queries.
 * Based on PRD specifications:
 * - Mobile: <480px (1 column)
 * - Tablet: 480-768px (2 columns)
 * - Desktop: >768px (4 columns)
 *
 * Additional breakpoints for extended layouts (e.g., home page grid):
 * - Large Desktop: >900px (3 columns)
 * - Extra Large: >1200px (4 columns)
 *
 * Usage in CSS-in-JS:
 * ```
 * @media (min-width: ${BREAKPOINTS.TABLET}px) { ... }
 * @media (max-width: ${BREAKPOINTS.MOBILE}px) { ... }
 * ```
 */
export const BREAKPOINTS = {
  /** Mobile breakpoint - below this is single column layout */
  MOBILE: 480,
  /** Tablet breakpoint - 2 column layout */
  TABLET: 768,
  /** Large desktop - used for extended grid layouts */
  LARGE_DESKTOP: 900,
  /** Extra large desktop - max width for some layouts */
  EXTRA_LARGE: 1200,
} as const;

/**
 * Media query strings for use in CSS-in-JS.
 * Pre-constructed for convenience and consistency.
 *
 * Usage in Lit CSS:
 * ```
 * @media ${unsafeCSS(MEDIA_QUERIES.MOBILE_ONLY)} { ... }
 * @media ${unsafeCSS(MEDIA_QUERIES.TABLET_UP)} { ... }
 * ```
 */
export const MEDIA_QUERIES = {
  /** Mobile only: max-width: 479px (below MOBILE breakpoint) */
  MOBILE_ONLY: `(max-width: ${BREAKPOINTS.MOBILE - 1}px)`,
  /** Tablet and up: min-width: 480px */
  TABLET_UP: `(min-width: ${BREAKPOINTS.MOBILE}px)`,
  /** Desktop and up: min-width: 768px */
  DESKTOP_UP: `(min-width: ${BREAKPOINTS.TABLET}px)`,
  /** Large desktop and up: min-width: 900px */
  LARGE_DESKTOP_UP: `(min-width: ${BREAKPOINTS.LARGE_DESKTOP}px)`,
  /** Extra large desktop and up: min-width: 1200px */
  EXTRA_LARGE_UP: `(min-width: ${BREAKPOINTS.EXTRA_LARGE}px)`,
  /** Mobile and tablet only: max-width: 767px (below TABLET breakpoint) */
  MOBILE_AND_TABLET: `(max-width: ${BREAKPOINTS.TABLET - 1}px)`,
} as const;

/**
 * Z-index scale for layered UI components.
 * Use these constants to ensure consistent stacking order and prevent conflicts.
 *
 * Scale:
 * - Base (0-10): Default content
 * - Sticky (50): Sticky navigation, headers
 * - Dropdown (100): Dropdowns, tooltips, popovers
 * - Modal (1000): Modal dialogs, lightboxes
 * - Modal controls (1001): Controls within modals (close buttons, nav)
 * - Toast (2000): Toast notifications
 */
export const Z_INDEX = {
  /** Base layer - default content */
  BASE: 0,
  /** Sticky elements - navigation, headers that stick on scroll */
  STICKY: 50,
  /** Dropdowns, tooltips, popovers */
  DROPDOWN: 100,
  /** Modal overlays and lightboxes */
  MODAL: 1000,
  /** Controls within modals (close button, navigation buttons) */
  MODAL_CONTROLS: 1001,
  /** Toast notifications that appear above everything */
  TOAST: 2000,
} as const;

/**
 * Request timing constants for progress indicators (TOUT-002).
 * Used to show users when requests are taking longer than expected.
 */
export const REQUEST_TIMING = {
  /** Time in ms after which a request is considered "slow" (3 seconds) */
  SLOW_THRESHOLD_MS: 3000,
  /** Interval in ms to update the elapsed time display */
  ELAPSED_UPDATE_INTERVAL_MS: 1000,
  /** Maximum time to show elapsed time before showing "still working..." */
  MAX_ELAPSED_DISPLAY_MS: 30000,
} as const;

/**
 * Standardized spacing scale for consistent padding and margins (UIC-021).
 * All values are in pixels. Use with template literals or unsafeCSS().
 *
 * Scale philosophy:
 * - XS (4px): Tight spacing for pill gaps, icon margins
 * - SM (8px): Compact spacing for mobile, dense UIs
 * - MD (12px): Standard small padding for cards, sections
 * - LG (16px): Default container padding, card content
 * - XL (24px): Comfortable spacing for larger elements
 * - XXL (40px): Large empty states, prominent sections
 *
 * Usage in Lit CSS:
 * ```
 * padding: ${SPACING.MD}px;
 * padding: ${SPACING.SM}px ${SPACING.MD}px;
 * gap: ${SPACING.XS}px;
 * ```
 */
export const SPACING = {
  /** 4px - Tight: pill gaps, icon margins, minimal spacing */
  XS: 4,
  /** 8px - Compact: mobile padding, dense layouts */
  SM: 8,
  /** 12px - Standard: small card padding, button padding */
  MD: 12,
  /** 16px - Default: container padding, card content */
  LG: 16,
  /** 24px - Comfortable: larger element padding */
  XL: 24,
  /** 40px - Large: empty states, prominent sections */
  XXL: 40,
} as const;

/**
 * Pill-specific spacing for consistent button/pill padding (UIC-021).
 * Uses SPACING scale values for horizontal and vertical padding.
 *
 * Desktop: 4px vertical, 10px horizontal (between SM and MD)
 * Mobile: 4px vertical, 8px horizontal (XS vertical, SM horizontal)
 *
 * Usage in Lit CSS:
 * ```
 * padding: ${PILL_SPACING.VERTICAL}px ${PILL_SPACING.HORIZONTAL}px;
 * @media (max-width: 479px) {
 *   padding: ${PILL_SPACING.VERTICAL}px ${PILL_SPACING.HORIZONTAL_MOBILE}px;
 * }
 * ```
 */
export const PILL_SPACING = {
  /** Vertical padding for pills (4px) */
  VERTICAL: SPACING.XS,
  /** Horizontal padding for pills on desktop (10px) */
  HORIZONTAL: 10,
  /** Horizontal padding for pills on mobile (8px) */
  HORIZONTAL_MOBILE: SPACING.SM,
} as const;

/**
 * Container-specific spacing for consistent page layouts (UIC-021).
 * Defines padding values for feed containers at different breakpoints.
 *
 * Usage in Lit CSS:
 * ```
 * padding: 0 ${CONTAINER_SPACING.HORIZONTAL}px;
 * @media (max-width: 479px) {
 *   padding: 0 ${CONTAINER_SPACING.HORIZONTAL_MOBILE}px;
 * }
 * ```
 */
export const CONTAINER_SPACING = {
  /** Horizontal padding for containers on desktop (16px) */
  HORIZONTAL: SPACING.LG,
  /** Horizontal padding for containers on mobile (8px) */
  HORIZONTAL_MOBILE: SPACING.SM,
} as const;

/**
 * Auto-retry timing constants for exponential backoff after errors (TOUT-001).
 * Used by error-state component to automatically retry failed requests.
 *
 * The retry sequence with these defaults:
 * - First retry: 5 seconds
 * - Second retry: 10 seconds
 * - Third retry: 20 seconds (capped at MAX)
 *
 * After max attempts, auto-retry stops and user must manually retry.
 */
export const AUTO_RETRY = {
  /** Initial delay before first auto-retry in milliseconds (5 seconds) */
  INITIAL_DELAY_MS: 5000,
  /** Multiplier for exponential backoff (2x each attempt) */
  BACKOFF_MULTIPLIER: 2,
  /** Maximum delay between retries in milliseconds (20 seconds) */
  MAX_DELAY_MS: 20000,
  /** Maximum number of auto-retry attempts before requiring manual intervention */
  MAX_ATTEMPTS: 3,
  /** Interval in ms to update the countdown display (1 second) */
  COUNTDOWN_INTERVAL_MS: 1000,
} as const;
