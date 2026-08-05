import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('build info', () => {
  it('uses the explicit staging unknown fallback when build metadata is absent', async () => {
    vi.stubEnv('VITE_BUILD_SHA', '');
    vi.resetModules();

    await expect(import('../src/services/build-info.js')).resolves.toMatchObject({
      UNKNOWN_BUILD_TAG: 'staging@unknown-unknown',
      BUILD_TAG: 'staging@unknown-unknown',
    });
  });

  it('uses injected build metadata when it is present', async () => {
    vi.stubEnv('VITE_BUILD_SHA', 'production@backend-frontend');
    vi.resetModules();

    const { BUILD_TAG } = await import('../src/services/build-info.js');

    expect(BUILD_TAG).toBe('production@backend-frontend');
  });

  it('exports the build tag with an explicit string type', () => {
    const src = readFileSync(join(process.cwd(), 'src/services/build-info.ts'), 'utf8');

    expect(src).toMatch(/export const BUILD_TAG:\s*string\s*=/);
  });

  it('is imported by shared nav instead of being declared locally', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/shared-nav.ts'), 'utf8');

    expect(src).toContain("import { BUILD_TAG } from '../services/build-info.js';");
    expect(src).not.toMatch(/const\s+BUILD_TAG\s*=/);
  });
});
