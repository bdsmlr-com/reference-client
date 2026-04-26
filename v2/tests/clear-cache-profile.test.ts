import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/pages/view-clear-cache.ts');

describe('view-clear-cache profile cleanup', () => {
  it('clears profile and stored blog identity during cache clear', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain('clearProfileState()');
    expect(src).toContain('clearStoredBlogName()');
  });

  it('uses the canonical storage clear path so search and response caches are wiped too', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("clearAllStorage()");
    expect(src).not.toContain('clearSearchCache()');
    expect(src).not.toContain('clearResponseCache()');
  });
});
