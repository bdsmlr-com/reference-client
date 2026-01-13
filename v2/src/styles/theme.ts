import { css } from 'lit';

const THEME_KEY = 'bdsmlr_theme';

export type Theme = 'dark' | 'light';

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return 'dark';
}

export function setStoredTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function initTheme(): Theme {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

// Global CSS to inject into document head
export const globalThemeCSS = `
  :root, [data-theme="dark"] {
    --bg-primary: #0f172a;
    --bg-panel: #0b1224;
    --bg-panel-alt: #1e293b;
    --border: #1f2937;
    --border-strong: #334155;
    --text-primary: #e2e8f0;
    --text-muted: #94a3b8;
    --accent: #38bdf8;
    --accent-hover: #0ea5e9;
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
