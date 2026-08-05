import { afterEach, describe, expect, it, vi } from 'vitest';

import { maybeDeployInterstitial } from '../src/services/interstitial-bridge.js';

function stubInterstitialPage(pathname: string) {
  const deployInterstitial = vi.fn();
  const gtag = vi.fn();
  vi.stubGlobal('window', {
    location: {
      pathname,
      href: `https://example.invalid${pathname}`,
    },
  });
  vi.stubGlobal('deployInterstitial', deployInterstitial);
  vi.stubGlobal('gtag', gtag);
  return { deployInterstitial, gtag };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('interstitial bridge route policy', () => {
  it('treats related post routes as public when more-like-this is enabled', () => {
    const { deployInterstitial, gtag } = stubInterstitialPage('/post/552557503/related/for/you');

    maybeDeployInterstitial(false, { moreLikeThisOnPost: true });

    expect(deployInterstitial).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'interstitial_displayed', expect.any(Object));
  });

  it('suppresses the interstitial as login-only when more-like-this is disabled', () => {
    const { deployInterstitial, gtag } = stubInterstitialPage('/post/552557503/related/for/teas-and-denial');

    maybeDeployInterstitial(false, { moreLikeThisOnPost: false });

    expect(deployInterstitial).not.toHaveBeenCalled();
    expect(gtag).toHaveBeenCalledWith('event', 'interstitial_suppressed_login', expect.any(Object));
  });

  it('keeps canonical posts public and non-public routes suppressed', () => {
    const publicPage = stubInterstitialPage('/post/552557503');
    maybeDeployInterstitial(false);
    expect(publicPage.deployInterstitial).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
    const privatePage = stubInterstitialPage('/search');
    maybeDeployInterstitial(false, { moreLikeThisOnPost: true });
    expect(privatePage.deployInterstitial).not.toHaveBeenCalled();
    expect(privatePage.gtag).toHaveBeenCalledWith('event', 'interstitial_suppressed_login', expect.any(Object));
  });
});
