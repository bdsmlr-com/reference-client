import { ACTIVE_ENV } from '../config.js';
import { callGtag } from './google-analytics.js';
import { isAnonymousReadableRoute } from './route-access-policy.js';

function isFeedForYouLanding(pathname: string): boolean {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/';
  return normalized === '/feed/for/you';
}

export function maybeDeployInterstitial(authenticated: boolean): void {
  if (authenticated) {
    return;
  }

  // Child tabunder pages include ?revealcontent=1; those should only
  // processParentTabunder() (handled by interstitial-tabunder.js), not show
  // the interstitial overlay again. Prefer a raw string check to avoid
  // edge-case parsing differences.
  if (String(window.location.href).includes('?revealcontent')) {
    return;
  }

  if (ACTIVE_ENV !== 'dev' && location.hostname !== 'localhost') {
    return;
  }

  const pathname = window.location.pathname;

  if (!isAnonymousReadableRoute(pathname)) {
    const eventName = isFeedForYouLanding(pathname)
      ? 'interstitial_suppressed_login_feed_landing'
      : 'interstitial_suppressed_login';
    // TODO (optional, GA admin): register page_path / page_location as event-scoped
    // custom dimensions in GA4 if ad-ops want to filter or break down by route in
    // Explorations; event names alone appear in standard Events reports without this.
    console.log('GGA',eventName);
    callGtag('event', eventName, {
      page_path: pathname,
      page_location: window.location.href,
    });
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
  deploy();
}
