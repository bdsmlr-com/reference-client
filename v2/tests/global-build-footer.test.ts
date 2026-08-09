// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lit-labs/router', () => ({
  Router: class {
    outlet() {
      return null;
    }
  },
}));

vi.mock('../src/config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/config.js')>();
  return {
    ...original,
    ensureRuntimeConfigLoaded: vi.fn(() => new Promise<void>(() => {})),
  };
});

vi.mock('../src/services/render-contract.js', () => ({
  loadRenderContract: vi.fn(() => ({})),
}));

vi.mock('../src/services/render-contract-validator.js', () => ({
  validateRenderContract: vi.fn(() => ({ ok: true, errors: [] })),
}));

vi.mock('../src/services/google-analytics.js', () => ({
  initNavigationTracking: vi.fn(),
  testTrackEvent: vi.fn(() => true),
  trackEvent: vi.fn(() => true),
}));

vi.mock('../src/services/revive-analytics.js', () => ({
  initReviveAnalytics: vi.fn(),
}));

beforeEach(() => {
  window.history.replaceState({}, '', '/post/685173107');
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllEnvs();
});

describe('global build footer', () => {
  it('renders the fallback build identity after main on an anonymous-readable post route', async () => {
    vi.stubEnv('VITE_BUILD_SHA', '');
    vi.resetModules();
    await import('../src/app-root.js');

    const root = document.createElement('app-root') as any;
    root.runtimeConfigReady = true;
    root.checkingAuth = false;
    root.authenticated = false;
    root.contractErrors = [];
    document.body.appendChild(root);

    try {
      await root.updateComplete;

      const main = root.shadowRoot?.querySelector('main');
      const footer = root.shadowRoot?.querySelector('footer.build-footer');

      expect(main).toBeTruthy();
      expect(footer).toBeTruthy();
      expect(main?.nextElementSibling).toBe(footer);
      expect(footer?.textContent?.trim()).toBe('staging@unknown-unknown');
      expect(footer?.getAttribute('aria-label')).toBe('Build identity');
    } finally {
      root.remove();
    }
  });

  it('imports the shared build tag without duplicating its fallback', () => {
    const src = readFileSync(join(process.cwd(), 'src/app-root.ts'), 'utf8');

    expect(src).toContain("import { BUILD_TAG } from './services/build-info.js';");
    expect(src).not.toContain('staging@unknown-unknown');
  });
});
