import { trackEvent } from './google-analytics.js';
import {
  isAnonymousReadableRoute,
  type AnonymousRouteFeatureContext,
} from './route-access-policy.js';

/** sessionStorage: interstitial already shown this tab session (feature, not A/B). */
const INTERSTITIAL_SHOWN_KEY = 'interstitial_shown';

function isFeedForYouLanding(pathname: string): boolean {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/';
  return normalized === '/feed/for/you';
}

/** Arm assigned in v2/index.html (`globalThis.SITE_AB_IX`). Defaults to control. */
function getAbIxArm(): 'a' | 'b' {
  const arm = (globalThis as { SITE_AB_IX?: unknown }).SITE_AB_IX;
  return arm === 'b' ? 'b' : 'a';
}

function hasInterstitialShownThisSession(): boolean {
  try {
    return sessionStorage.getItem(INTERSTITIAL_SHOWN_KEY) === '1';
  } catch {
    return false;
  }
}

function markInterstitialShownThisSession(): void {
  try {
    sessionStorage.setItem(INTERSTITIAL_SHOWN_KEY, '1');
  } catch {
    // ignore
  }
}

export function maybeDeployInterstitial(
  authenticated: boolean,
  features: AnonymousRouteFeatureContext = {},
): void {
  if (authenticated) {
    return;
  }

  // Child tabunder pages include ?revealcontent=1; those should only
  // processParentTabunder() (handled by interstitial-tabunder.js), not show
  // the interstitial overlay again. Prefer a raw string check to avoid
  // edge-case parsing differences.
  if (String(window.location.href).includes('revealcontent') /* deliberately unstrict string check */) {
    return;
  }

  const pathname = window.location.pathname;
  const abIx = getAbIxArm();

  if (!isAnonymousReadableRoute(pathname, features)) {
    const eventName = isFeedForYouLanding(pathname)
      ? 'interstitial_suppressed_login_feed_landing'
      : 'interstitial_suppressed_login';
    // Only reached when authenticated === false (logged-out user on a
    // login-required route). trackEvent adds page_path / page_location.
    trackEvent(eventName);
    return;
  }

  /*
  // Keep interstitial deployment behind the local test gate unless
  // explicitly enabled.
  // const INTERSTITIAL_TEST_KEY = 'interstitial-test';
  // if (Number(localStorage.getItem(INTERSTITIAL_TEST_KEY)) != 1) {
  //   return;
  // }
  */

  // Arm b: at most one interstitial per tab session.
  if (abIx === 'b' && hasInterstitialShownThisSession()) {
    trackEvent('interstitial_suppressed_ab');
    return;
  }

  // Overengineered typescript amounting to: deployInterstitial()
  const deploy = (globalThis as { deployInterstitial?: () => void }).deployInterstitial;
  if (typeof deploy !== 'function') {
    console.warn('[interstitial] globalThis.deployInterstitial is not defined');
    return;
  }
  trackEvent('interstitial_displayed');
  markInterstitialShownThisSession();
  deploy();
}
