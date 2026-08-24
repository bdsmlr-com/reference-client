// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import {
  GA_LOGGED_IN_STORAGE_KEY,
  readGaLoggedInHint,
  resolveGaLoggedInStorageKey,
  writeGaLoggedInHint,
} from '../src/services/ga-logged-in-hint.js';

afterEach(() => {
  localStorage.removeItem(resolveGaLoggedInStorageKey());
  localStorage.removeItem(GA_LOGGED_IN_STORAGE_KEY);
  delete (globalThis as { GA_LOGGED_IN_STORAGE_KEY?: string }).GA_LOGGED_IN_STORAGE_KEY;
});

describe('ga logged_in hint', () => {
  it('defaults to false when unset', () => {
    expect(readGaLoggedInHint()).toBe('false');
  });

  it('prefers globalThis.GA_LOGGED_IN_STORAGE_KEY when set by index.html', () => {
    (globalThis as { GA_LOGGED_IN_STORAGE_KEY?: string }).GA_LOGGED_IN_STORAGE_KEY = 'site_ga_logged_in_test';
    expect(resolveGaLoggedInStorageKey()).toBe('site_ga_logged_in_test');
    writeGaLoggedInHint(true);
    expect(localStorage.getItem('site_ga_logged_in_test')).toBe('true');
  });

  it('round-trips true/false for the next boot reader', () => {
    writeGaLoggedInHint(true);
    expect(localStorage.getItem(resolveGaLoggedInStorageKey())).toBe('true');
    expect(readGaLoggedInHint()).toBe('true');

    writeGaLoggedInHint(false);
    expect(readGaLoggedInHint()).toBe('false');
  });

  it('ignores corrupt stored values', () => {
    localStorage.setItem(resolveGaLoggedInStorageKey(), 'yes');
    expect(readGaLoggedInHint()).toBe('false');
  });
});
