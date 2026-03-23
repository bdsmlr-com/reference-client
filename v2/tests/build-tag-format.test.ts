import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('build tag format', () => {
  it('build script exports FE and BE shas into VITE_BUILD_SHA', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    const build = pkg?.scripts?.build || '';

    expect(build).toContain('VITE_FE_SHA=');
    expect(build).toContain('VITE_BE_SHA=');
    expect(build).toContain('${VITE_BUILD_ENV}@${VITE_FE_SHA}/${VITE_BE_SHA}');
  });

  it('shared nav fallback uses env@unknown/unknown shape', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/shared-nav.ts'), 'utf8');
    expect(src).toContain("|| 'staging@unknown/unknown'");
  });
});

