/**
 * Blog theming service.
 *
 * Fetches blog metadata and applies custom theme colors when visiting
 * a blog-specific page (subdomain or path-based routing).
 *
 * Theme colors override the default CSS variables when a blog has
 * custom theming configured.
 *
 * Uses chroma-js for color science operations to:
 * - Ensure WCAG AA/AAA contrast ratios
 * - Adapt blog accent colors for light/dark mode compatibility
 * - Generate complementary text colors when needed
 *
 * THEME-002: Enhanced to reconcile blog theme colors with user's
 * light/dark/system preference using established color science.
 */

import chroma from 'chroma-js';
import { getBlog } from './api.js';
import type { Blog } from '../types/api.js';

const BLOG_THEME_CACHE_KEY = 'bdsmlr_blog_theme_cache';
// Blog metadata (name, avatar, theme colors) rarely changes (CACHE-009)
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (was 30 minutes, increased per CACHE-009)

interface CachedBlogTheme {
  blog: Blog | null;
  timestamp: number;
}

interface BlogThemeCache {
  [blogName: string]: CachedBlogTheme;
}

/**
 * Get cached blog theme data
 */
function getCachedBlogTheme(blogName: string): Blog | null | undefined {
  try {
    const cache = JSON.parse(localStorage.getItem(BLOG_THEME_CACHE_KEY) || '{}') as BlogThemeCache;
    const key = blogName.toLowerCase();
    const entry = cache[key];

    if (!entry) return undefined; // Cache miss

    if (Date.now() > entry.timestamp + CACHE_TTL) {
      return undefined; // Expired
    }

    return entry.blog; // Cache hit (may be null if blog not found)
  } catch {
    return undefined;
  }
}

/**
 * Set cached blog theme data
 */
function setCachedBlogTheme(blogName: string, blog: Blog | null): void {
  try {
    const cache = JSON.parse(localStorage.getItem(BLOG_THEME_CACHE_KEY) || '{}') as BlogThemeCache;
    cache[blogName.toLowerCase()] = {
      blog,
      timestamp: Date.now(),
    };
    localStorage.setItem(BLOG_THEME_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Fetch blog metadata for theming
 */
export async function fetchBlogForTheming(blogName: string): Promise<Blog | null> {
  if (!blogName) return null;

  // Check cache first
  const cached = getCachedBlogTheme(blogName);
  if (cached !== undefined) {
    return cached;
  }

  // Fetch from API
  try {
    const response = await getBlog({ blog_name: blogName });
    const blog = response.blog || null;
    setCachedBlogTheme(blogName, blog);
    return blog;
  } catch {
    setCachedBlogTheme(blogName, null);
    return null;
  }
}

// ============================================================================
// Color Science Constants and Utilities (THEME-002)
// ============================================================================

// WCAG contrast ratio thresholds
const WCAG_AA_NORMAL = 4.5; // Normal text
const WCAG_AA_LARGE = 3.0; // Large text (18pt+ or 14pt bold)
// const WCAG_AAA_NORMAL = 7.0; // Enhanced accessibility (available for future use)

// Default background colors for light/dark themes (from theme.ts)
const LIGHT_BG = '#f8fafc';
const DARK_BG = '#0f172a';

// Default text colors for light/dark themes
const LIGHT_TEXT = '#0f172a';
const DARK_TEXT = '#e2e8f0';

/**
 * Check if a color is valid and parseable by chroma-js
 */
function isValidColor(color: string | undefined): boolean {
  if (!color) return false;
  try {
    chroma(color);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current theme mode from the document
 */
function getCurrentThemeMode(): 'light' | 'dark' {
  const dataTheme = document.documentElement.getAttribute('data-theme');
  if (dataTheme === 'light') return 'light';
  if (dataTheme === 'dark') return 'dark';

  // Fall back to system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

/**
 * Get the background color for the current theme mode
 */
function getThemeBackground(): string {
  return getCurrentThemeMode() === 'light' ? LIGHT_BG : DARK_BG;
}

/**
 * Get the text color for the current theme mode
 */
function getThemeTextColor(): string {
  return getCurrentThemeMode() === 'light' ? LIGHT_TEXT : DARK_TEXT;
}

/**
 * Calculate the WCAG contrast ratio between two colors.
 * Uses chroma-js for accurate luminance calculations.
 */
function getContrastRatio(color1: string, color2: string): number {
  try {
    return chroma.contrast(color1, color2);
  } catch {
    return 1; // Return minimum if calculation fails
  }
}

/**
 * Adapt an accent color to ensure sufficient contrast with the current theme background.
 * Preserves the hue while adjusting lightness for accessibility.
 *
 * @param accentColor - The blog's original accent color
 * @param targetContrast - Minimum contrast ratio (default: WCAG AA for large text)
 * @returns The adapted color as a hex string
 */
function adaptAccentForTheme(
  accentColor: string,
  targetContrast: number = WCAG_AA_LARGE
): string {
  const bg = getThemeBackground();
  const isLightMode = getCurrentThemeMode() === 'light';

  try {
    const accent = chroma(accentColor);
    const currentContrast = getContrastRatio(accentColor, bg);

    // If contrast is already sufficient, return original color
    if (currentContrast >= targetContrast) {
      return accentColor;
    }

    // Get the color in LCH space for perceptual uniformity
    // LCH: Lightness, Chroma, Hue - allows adjusting lightness while preserving hue
    const [l, c, h] = accent.lch();

    // Binary search for the optimal lightness that meets contrast requirements
    let minL = isLightMode ? 0 : l;
    let maxL = isLightMode ? l : 100;

    // In light mode, we need to darken; in dark mode, we need to lighten
    for (let i = 0; i < 20; i++) {
      const midL = (minL + maxL) / 2;
      const testColor = chroma.lch(midL, c, h).hex();
      const contrast = getContrastRatio(testColor, bg);

      if (contrast >= targetContrast) {
        // We found a valid contrast, try to get closer to original
        if (isLightMode) {
          minL = midL;
        } else {
          maxL = midL;
        }
      } else {
        // Need more contrast
        if (isLightMode) {
          maxL = midL;
        } else {
          minL = midL;
        }
      }
    }

    const resultL = (minL + maxL) / 2;
    return chroma.lch(resultL, c, h).hex();
  } catch {
    // If color manipulation fails, return original
    return accentColor;
  }
}

/**
 * Generate a hover state color for the accent.
 * In light mode: slightly darker
 * In dark mode: slightly lighter
 */
function generateHoverColor(accentColor: string): string {
  const isLightMode = getCurrentThemeMode() === 'light';

  try {
    const accent = chroma(accentColor);
    // Shift lightness by 10% in the appropriate direction
    const shift = isLightMode ? -0.1 : 0.1;
    const [l, c, h] = accent.lch();
    const newL = Math.max(0, Math.min(100, l + l * shift));
    return chroma.lch(newL, c, h).hex();
  } catch {
    return accentColor;
  }
}

/**
 * Determine appropriate text color for a given background color.
 * Ensures WCAG AA contrast ratio.
 */
function getTextColorForBackground(backgroundColor: string): string {
  try {
    const bg = chroma(backgroundColor);
    const whiteContrast = chroma.contrast(bg, 'white');
    const blackContrast = chroma.contrast(bg, 'black');

    // Use white text on dark backgrounds, black text on light backgrounds
    if (whiteContrast >= WCAG_AA_NORMAL) {
      return DARK_TEXT; // Light text for dark bg
    } else if (blackContrast >= WCAG_AA_NORMAL) {
      return LIGHT_TEXT; // Dark text for light bg
    }

    // If neither pure white nor black meets contrast, adjust
    // Use whichever has better contrast
    return whiteContrast > blackContrast ? DARK_TEXT : LIGHT_TEXT;
  } catch {
    return getThemeTextColor();
  }
}

/**
 * Adapt blog colors for the current theme mode.
 * Returns adapted colors that work well with the user's light/dark preference.
 */
interface AdaptedThemeColors {
  accent: string;
  accentHover: string;
  background: string | null;
  text: string | null;
}

function adaptBlogColorsForTheme(blog: Blog): AdaptedThemeColors {
  const result: AdaptedThemeColors = {
    accent: blog.accentColor || '',
    accentHover: '',
    background: null,
    text: null,
  };

  // Adapt accent color for current theme
  if (isValidColor(blog.accentColor)) {
    result.accent = adaptAccentForTheme(blog.accentColor!);
    result.accentHover = generateHoverColor(result.accent);
  }

  // Handle background color - only apply if it doesn't conflict with theme
  if (isValidColor(blog.backgroundColor)) {
    const blogBg = blog.backgroundColor!;
    const isLightMode = getCurrentThemeMode() === 'light';

    try {
      const blogBgLuminance = chroma(blogBg).luminance();

      // Only apply background if it's compatible with current theme
      // Light mode: prefer light backgrounds; Dark mode: prefer dark backgrounds
      if (isLightMode && blogBgLuminance > 0.4) {
        result.background = blogBg;
      } else if (!isLightMode && blogBgLuminance < 0.4) {
        result.background = blogBg;
      }
      // Otherwise, skip applying background to preserve theme compatibility
    } catch {
      // Skip invalid colors
    }
  }

  // Handle text color
  if (isValidColor(blog.textColor)) {
    const blogText = blog.textColor!;
    const bg = result.background || getThemeBackground();

    // Verify the text color has sufficient contrast with background
    if (getContrastRatio(blogText, bg) >= WCAG_AA_NORMAL) {
      result.text = blogText;
    } else {
      // Generate a text color that works with the background
      result.text = getTextColorForBackground(bg);
    }
  }

  return result;
}

/**
 * Apply blog-specific theme colors to CSS variables.
 * Colors are adapted for the current light/dark theme to ensure:
 * - WCAG AA contrast ratios
 * - Compatibility with user's theme preference
 * - Preserved hue/character of the blog's color scheme
 */
export function applyBlogTheme(blog: Blog | null): void {
  const root = document.documentElement;

  // Clear any previous blog theme
  root.style.removeProperty('--blog-accent');
  root.style.removeProperty('--blog-accent-hover');
  root.style.removeProperty('--blog-bg');
  root.style.removeProperty('--blog-text');
  root.style.removeProperty('--blog-header-image');
  root.style.removeProperty('--accent');
  root.style.removeProperty('--accent-hover');

  if (!blog) return;

  // Adapt colors for the current theme mode
  const adapted = adaptBlogColorsForTheme(blog);

  // Apply adapted accent color
  if (adapted.accent) {
    root.style.setProperty('--blog-accent', adapted.accent);
    root.style.setProperty('--blog-accent-hover', adapted.accentHover || adapted.accent);
    // Override the default accent with the adapted color
    root.style.setProperty('--accent', adapted.accent);
    root.style.setProperty('--accent-hover', adapted.accentHover || adapted.accent);
  }

  // Apply background color (only if theme-compatible)
  if (adapted.background) {
    root.style.setProperty('--blog-bg', adapted.background);
  }

  // Apply text color (only if contrast-verified)
  if (adapted.text) {
    root.style.setProperty('--blog-text', adapted.text);
  }

  // Store header image URL for components to use
  if (blog.headerImageUrl) {
    root.style.setProperty('--blog-header-image', `url(${blog.headerImageUrl})`);
  }
}

/**
 * Clear blog-specific theme colors
 */
export function clearBlogTheme(): void {
  applyBlogTheme(null);
}

/**
 * Get current blog theme state (for debugging/display)
 */
export function getBlogThemeInfo(): { hasCustomTheme: boolean; colors: Record<string, string> } {
  const root = document.documentElement;
  // Note: getComputedStyle could be used for reading inherited values but we're
  // reading direct property values from root.style instead
  const colors: Record<string, string> = {};
  const blogVars = ['--blog-accent', '--blog-accent-hover', '--blog-bg', '--blog-text'];

  let hasCustomTheme = false;
  for (const varName of blogVars) {
    const value = root.style.getPropertyValue(varName);
    if (value) {
      colors[varName] = value;
      hasCustomTheme = true;
    }
  }

  return { hasCustomTheme, colors };
}

// ============================================================================
// Theme Change Listener (THEME-002)
// ============================================================================

// Track the currently applied blog for re-adaptation on theme change
let currentBlog: Blog | null = null;

/**
 * Re-apply blog theme colors when the app theme changes.
 * This ensures colors are always adapted for the current light/dark mode.
 */
function handleThemeChange(): void {
  if (currentBlog) {
    applyBlogTheme(currentBlog);
  }
}

/**
 * Set up theme change listener.
 * Called automatically when initBlogTheme is used.
 */
let themeListenerInstalled = false;

function installThemeChangeListener(): void {
  if (themeListenerInstalled) return;

  // Listen for the custom 'theme-changed' event from theme.ts
  window.addEventListener('theme-changed', handleThemeChange);

  // Also watch for data-theme attribute changes on document
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        handleThemeChange();
        break;
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  themeListenerInstalled = true;
}

/**
 * Initialize blog theming for a page.
 * Call this from pages that have blog context (archive, timeline, social, etc.)
 *
 * Sets up automatic re-adaptation when user toggles light/dark theme.
 *
 * @param blogName - The current blog name
 * @returns The blog data (useful for displaying title, avatar, etc.)
 */
export async function initBlogTheme(blogName: string): Promise<Blog | null> {
  // Install listener on first use
  installThemeChangeListener();

  if (!blogName) {
    currentBlog = null;
    clearBlogTheme();
    return null;
  }

  const blog = await fetchBlogForTheming(blogName);
  currentBlog = blog;
  applyBlogTheme(blog);
  return blog;
}

// ============================================================================
// Debug/Testing Exports (THEME-002)
// ============================================================================

/**
 * Get the current theme mode (for debugging)
 */
export { getCurrentThemeMode };

/**
 * Test color adaptation without applying to DOM (for debugging)
 */
export function testColorAdaptation(accentColor: string): {
  original: string;
  adaptedLight: string;
  adaptedDark: string;
  contrastLight: number;
  contrastDark: number;
} {
  try {
    // Temporarily override theme detection for testing
    const savedTheme = document.documentElement.getAttribute('data-theme');

    document.documentElement.setAttribute('data-theme', 'light');
    const adaptedLight = adaptAccentForTheme(accentColor);

    document.documentElement.setAttribute('data-theme', 'dark');
    const adaptedDark = adaptAccentForTheme(accentColor);

    // Restore theme
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    return {
      original: accentColor,
      adaptedLight,
      adaptedDark,
      contrastLight: chroma.contrast(adaptedLight, LIGHT_BG),
      contrastDark: chroma.contrast(adaptedDark, DARK_BG),
    };
  } catch {
    return {
      original: accentColor,
      adaptedLight: accentColor,
      adaptedDark: accentColor,
      contrastLight: 1,
      contrastDark: 1,
    };
  }
}
