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

  interface GlobalThis {
    deployInterstitial?: () => void;
    tabunderBounceOut?: () => void;
    processParentTabunder?: () => void;
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
