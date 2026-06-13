type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | undefined {
  const gtag = (globalThis as { gtag?: unknown }).gtag;
  return typeof gtag === 'function' ? (gtag as GtagFn) : undefined;
}

export function callGtag(...args: unknown[]): boolean {
  const gtag = getGtag();
  if (!gtag) {
    console.warn('[google-analytics] globalThis.gtag is not defined; skipped gtag call', args[0]);
    return false;
  }

  gtag(...args);
  return true;
}

export function trackPageView(pagePath?: string): void {
  const path = pagePath ?? `${window.location.pathname}${window.location.search}`;

  callGtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
  });
}

let navigationTrackingInitialized = false;

export function initNavigationTracking(): void {
  if (navigationTrackingInitialized || typeof window === 'undefined') {
    return;
  }
  navigationTrackingInitialized = true;

  const notifyNavigation = () => trackPageView();

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = (...args) => {
    originalPushState(...args);
    notifyNavigation();
  };

  history.replaceState = (...args) => {
    originalReplaceState(...args);
    notifyNavigation();
  };

  window.addEventListener('popstate', notifyNavigation);
}
