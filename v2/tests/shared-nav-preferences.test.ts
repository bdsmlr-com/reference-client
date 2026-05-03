import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/components/shared-nav.ts');

describe('shared nav preferences', () => {
  it('surfaces a global infinite scroll preference in the profile menu', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain('Infinite scroll');
    expect(src).toContain('setInfiniteScrollPreference');
  });
});
