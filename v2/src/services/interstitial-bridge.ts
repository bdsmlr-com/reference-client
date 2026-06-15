const INTERSTITIAL_TEST_KEY = 'interstitial-test';

export function maybeDeployInterstitial(authenticated: boolean): void {
  if (authenticated || localStorage.getItem(INTERSTITIAL_TEST_KEY) != 1) {
    return;
  }

  const deploy = (globalThis as { deployInterstitial?: () => void }).deployInterstitial;
  if (typeof deploy !== 'function') {
    console.warn('[interstitial] globalThis.deployInterstitial is not defined');
    return;
  }

  deploy();
}
