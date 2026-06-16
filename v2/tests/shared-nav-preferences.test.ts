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
    expect(src).not.toContain("buildPageUrl('follower-feed'");
    expect(src).toContain("buildPageUrl('for'");
    expect(src).toContain('href="/dashboard" target="_blank" rel="noreferrer noopener"');
    expect(src).toContain('Post ↗');
    expect(src).toContain('href="https://bdsmlr.com/queuev2" target="_blank" rel="noreferrer noopener"');
    expect(src).toContain('Queue ↗');
    expect(src.match(/Queue ↗/g)?.length).toBe(2);
    expect(src).toContain('href="/settings/you"');
    expect(src.indexOf('Post ↗')).toBeLessThan(src.indexOf('Queue ↗'));
    expect(src.indexOf('Queue ↗')).toBeLessThan(src.indexOf('Settings'));
  });
});
