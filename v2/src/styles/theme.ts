import { css } from 'lit';
import { initStorage } from '../services/storage.js';

const THEME_KEY = 'bdsmlr_theme';

export type Theme = 'dark' | 'light';

export function getSystemTheme(): Theme {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  // Fall back to system preference
  return getSystemTheme();
}

export function setStoredTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function initTheme(): Theme {
  // Initialize storage (runs migrations if needed)
  initStorage();

  const theme = getStoredTheme();
  applyTheme(theme);

  // Start watching for system theme changes
  watchSystemTheme();

  return theme;
}

/**
 * Check if user has explicitly set a theme preference.
 * Returns true if user has manually selected dark/light, false if using system default.
 */
export function hasUserThemePreference(): boolean {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' || stored === 'dark';
}

/**
 * Clear user theme preference and revert to system default.
 */
export function clearUserThemePreference(): void {
  localStorage.removeItem(THEME_KEY);
  applyTheme(getSystemTheme());
}

/**
 * Watch for system theme preference changes and update theme in real-time.
 * Only applies if user hasn't explicitly set a theme preference.
 */
export function watchSystemTheme(): void {
  if (!window.matchMedia) return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');

  const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
    // Only auto-switch if user hasn't set an explicit preference
    if (!hasUserThemePreference()) {
      const newTheme: Theme = e.matches ? 'light' : 'dark';
      applyTheme(newTheme);

      // Dispatch a custom event so components can react if needed
      window.dispatchEvent(
        new CustomEvent('theme-changed', { detail: { theme: newTheme, source: 'system' } })
      );
    }
  };

  // Use addEventListener for modern browsers, addListener for older ones
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
  } else if (mediaQuery.addListener) {
    // Deprecated but needed for older Safari
    mediaQuery.addListener(handleChange);
  }
}

// Global CSS to inject into document head
// Note: Accent color unified to #0ea5e9 (sky-500) across both themes for consistency (UIC-018)
export const globalThemeCSS = `
  :root, [data-theme="dark"] {
    --bg-primary: #0f172a;
    --bg-panel: #0b1224;
    --bg-panel-alt: #1e293b;
    --border: #1f2937;
    --border-strong: #334155;
    --text-primary: #e2e8f0;
    --text-muted: #94a3b8;
    --accent: #0ea5e9;
    --accent-hover: #38bdf8;
    --success: #4ade80;
    --error: #f87171;
    --warning: #fbbf24;
  }

  [data-theme="light"] {
    --bg-primary: #f8fafc;
    --bg-panel: #ffffff;
    --bg-panel-alt: #e2e8f0;
    --border: #cbd5e1;
    --border-strong: #94a3b8;
    --text-primary: #0f172a;
    --text-muted: #64748b;
    --accent: #0ea5e9;
    --accent-hover: #0284c7;
    --success: #22c55e;
    --error: #ef4444;
    --warning: #f59e0b;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body {
    height: 100%;
  }

  body {
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: system-ui, -apple-system, sans-serif;
    line-height: 1.5;
  }

  a {
    color: var(--accent);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
`;

// Lit CSS for components
export const baseStyles = css`
  :host {
    display: block;
    font-family: system-ui, -apple-system, sans-serif;
    color: var(--text-primary);
  }

  button {
    cursor: pointer;
    border: none;
    font-family: inherit;
  }

  input, select, textarea {
    font-family: inherit;
  }
`;

// Inject global styles into document
export function injectGlobalStyles(): void {
  if (!document.getElementById('bdsmlr-theme-styles')) {
    const style = document.createElement('style');
    style.id = 'bdsmlr-theme-styles';
    style.textContent = globalThemeCSS;
    document.head.appendChild(style);
  }
}
