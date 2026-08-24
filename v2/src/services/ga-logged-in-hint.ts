/**
 * Durable GA4 `logged_in` hint for the *next* page load's early gtag config.
 *
 * IMPORTANT: `v2/index.html` has a mandatory inline <head> snippet that:
 *   1. sets `globalThis.GA_LOGGED_IN_STORAGE_KEY`
 *   2. reads that localStorage key *before* `gtag('config')`
 * so the first automatic page_view is stamped.
 * Prefer `resolveGaLoggedInStorageKey()` over hardcoding; a .ts-only search will
 * not find the HTML reader.
 */
export const GA_LOGGED_IN_STORAGE_KEY = 'site_ga_logged_in';

export type GaLoggedInValue = 'true' | 'false';

/** Prefer the key published by index.html; fall back to the module constant. */
export function resolveGaLoggedInStorageKey(): string {
  try {
    const fromGlobal = (globalThis as { GA_LOGGED_IN_STORAGE_KEY?: unknown }).GA_LOGGED_IN_STORAGE_KEY;
    if (typeof fromGlobal === 'string' && fromGlobal) {
      return fromGlobal;
    }
  } catch {
    // ignore
  }
  return GA_LOGGED_IN_STORAGE_KEY;
}

/**
 * localStorage access can throw (privacy mode, extensions, blocked storage).
 * Never touch it outside try/catch — even `typeof localStorage` can throw.
 */
function safeLocalStorageGet(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/** Sync read for event payloads. Defaults to "false" when missing/unreadable. */
export function readGaLoggedInHint(): GaLoggedInValue {
  try {
    const value = safeLocalStorageGet(resolveGaLoggedInStorageKey());
    if (value === 'true' || value === 'false') return value;
  } catch {
    // Defensive: resolve/key path should not throw, but never break event sends.
  }
  return 'false';
}

/** Persist hint for the next cold boot; also refresh dataLayer when present. */
export function writeGaLoggedInHint(loggedIn: boolean): void {
  const value: GaLoggedInValue = loggedIn ? 'true' : 'false';
  safeLocalStorageSet(resolveGaLoggedInStorageKey(), value);
  try {
    const dataLayer = (globalThis as { dataLayer?: unknown[] }).dataLayer;
    if (Array.isArray(dataLayer)) {
      dataLayer.push({ logged_in: value });
    }
  } catch {
    // ignore
  }
}
