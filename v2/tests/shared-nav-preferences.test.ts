import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/components/shared-nav.ts');

describe('shared nav preferences', () => {
  it('removes route preference controls from the profile menu in favor of settings', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).not.toContain('Infinite scroll');
    expect(src).not.toContain('Gallery view');
    expect(src).not.toContain('Archive default sort');
    expect(src).not.toContain('Search default sort');
    expect(src).not.toContain("buildPageUrl('feed'");
    expect(src).not.toContain("buildPageUrl('follower-feed'");
    expect(src).toContain("buildPageUrl('for'");
    expect(src).toContain('href="/settings/you"');
  });
});
