/// <reference types="vite/client" />

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }

  // Standalone interstitial-tabunder.js
  var deployInterstitial: (() => void) | undefined;
  var tabunderBounceOut: (() => void) | undefined;
  var processParentTabunder: (() => void) | undefined;

  /** Set by v2/index.html before gtag config; used by ga-logged-in-hint.ts */
  var GA_LOGGED_IN_STORAGE_KEY: string | undefined;

  interface GlobalThis {
    deployInterstitial?: () => void;
    tabunderBounceOut?: () => void;
    processParentTabunder?: () => void;
    GA_LOGGED_IN_STORAGE_KEY?: string;
  }
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_AUTH_EMAIL: string;
  readonly VITE_AUTH_PASSWORD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
