import { trackEvent } from './google-analytics.js';
import {
  isAnonymousReadableRoute,
  type AnonymousRouteFeatureContext,
} from './route-access-policy.js';

function isFeedForYouLanding(pathname: string): boolean {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/';
  return normalized === '/feed/for/you';
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

  // Overengineered typescript amounting to: deployInterstitial()
  const deploy = (globalThis as { deployInterstitial?: () => void }).deployInterstitial;
  if (typeof deploy !== 'function') {
    console.warn('[interstitial] globalThis.deployInterstitial is not defined');
    return;
  }
  trackEvent('interstitial_displayed');
  deploy();
}
