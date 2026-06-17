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
    expect(src).toContain("href: 'https://bdsmlr.com/dashboard'");
    expect(src).toContain("{ name: 'post', label: 'Post ↗', icon: 'fa-solid fa-file-pen'");
    expect(src).toContain('href="https://bdsmlr.com/queuev2" target="_blank" rel="noreferrer noopener"');
    expect(src).toContain("{ name: 'chat', label: 'Chat ↗', icon: 'fa-solid fa-comments'");
    expect(src).toContain("{ name: 'messages', label: 'Messages ↗', icon: 'fa-solid fa-inbox'");
    expect(src).toContain("target=${page.newTab ? '_blank' : nothing}");
    expect(src).toContain("rel=${page.newTab ? 'noreferrer noopener' : nothing}");
    expect(src).toContain('Queue ↗');
    expect(src.match(/Queue ↗/g)?.length).toBe(2);
    expect(src).not.toContain('href="/dashboard" target="_blank" rel="noreferrer noopener">Post ↗</a>');
    expect(src).toContain('href="/settings/you"');
    expect(src.indexOf('Queue ↗')).toBeLessThan(src.indexOf('Settings'));
  });
});
