type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | undefined {
  const gtag = (globalThis as { gtag?: unknown }).gtag;
  return typeof gtag === 'function' ? (gtag as GtagFn) : undefined;
}

/**
 * Invoke gtag without ever throwing. Missing gtag or gtag errors are logged and ignored.
 */
export function callGtag(...args: unknown[]): boolean {
  try {
    const gtag = getGtag();
    if (!gtag) {
      console.warn('[google-analytics] globalThis.gtag is not defined; skipped gtag call', args[0]);
      return false;
    }

    gtag(...args);
    return true;
  } catch (error) {
    console.warn('[google-analytics] gtag call failed', args[0], error);
    return false;
  }
}

export function trackPageView(pagePath?: string): void {
  try {
    const path = pagePath ?? `${window.location.pathname}${window.location.search}`;

    callGtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.href,
    });
  } catch (error) {
    console.warn('[google-analytics] trackPageView failed', error);
  }
}

export type OutageEventParams = {
  /** UI surface that surfaced the issue (e.g. loading-spinner, skeleton-loader). */
  component?: string;
  /** Free-form context such as skeleton variant or loading message. */
  context?: string;
  error_code?: string;
  endpoint?: string;
};

/**
 * Track an unexpected outage/degradation signal in GA4.
 * Fires once per call; callers should dedupe at the source when needed.
 */
export function trackOutageEvent(
  eventName: string,
  params?: OutageEventParams
): boolean {
  return trackEvent(eventName, params);
}

function buildEventPayload(
  params?: Record<string, unknown>
): Record<string, unknown> {
  const location = typeof window !== 'undefined' ? window.location : undefined;
  const safeParams =
    params && typeof params === 'object' && !Array.isArray(params) ? params : undefined;
  return {
    page_path: location?.pathname,
    page_location: location?.href,
    ...safeParams,
  };
}

/**
 * Fire a GA4 event with standard page context.
 * Fire-and-forget: never throws (bad params, missing gtag, or gtag errors).
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>
): boolean {
  try {
    return callGtag('event', String(eventName || 'unknown_event'), buildEventPayload(params));
  } catch (error) {
    console.warn('[google-analytics] trackEvent failed', eventName, error);
    return false;
  }
}

/**
 * Same call signature as trackEvent, but console-only (no gtag).
 * Use while validating event wiring; search-replace testTrackEvent → trackEvent to go live.
 */
export function testTrackEvent(
  eventName: string,
  params?: Record<string, unknown>
): boolean {
  try {
    const name = String(eventName || 'unknown_event');
    console.log('[google-analytics:test]', name, buildEventPayload(params));
    return true;
  } catch (error) {
    console.warn('[google-analytics] testTrackEvent failed', eventName, error);
    return false;
  }
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
