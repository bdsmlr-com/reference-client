const INTERSTITIAL_TEST_KEY = 'interstitial-test';

export function maybeDeployInterstitial(authenticated: boolean): void {
  if (authenticated) {
    return;
  }

  // Child tabunder pages include ?revealcontent=1; those should only
  // processParentTabunder() (handled by interstitial-tabunder.js), not show
  // the interstitial overlay again.
  // Prefer a raw string check to avoid any edge-case parsing differences.
  if (String(window.location.href).includes('?revealcontent')) {
    return;
  }
  /*
  // Uncomment this block to unlaunch/re-gate interstitials.
  if (Number(localStorage.getItem(INTERSTITIAL_TEST_KEY)) != 1) {
    return;
  }*/

  // Overengineered typescript amounting to: deployInterstitial()
  const deploy = (globalThis as { deployInterstitial?: () => void }).deployInterstitial;
  if (typeof deploy !== 'function') {
    console.warn('[interstitial] globalThis.deployInterstitial is not defined');
    return;
  }
  deploy();
}
