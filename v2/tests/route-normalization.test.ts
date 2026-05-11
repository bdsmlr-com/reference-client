import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPageUrl, getBlogNameFromPath, getPageFromPath } from '../src/services/blog-resolver.js';

const ROOT = join(process.cwd(), 'src');

describe('route normalization', () => {
  const getItem = vi.fn();

  beforeEach(() => {
    getItem.mockReset();
    vi.stubGlobal('window', {
      location: {
        pathname: '/',
        search: '',
        hostname: 'localhost',
        protocol: 'https:',
        href: 'https://localhost/',
        origin: 'https://localhost',
      },
      history: {
        replaceState: vi.fn(),
      },
    });
    vi.stubGlobal('localStorage', {
      getItem,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it('parses canonical and legacy FE routes into normalized page and blog names', () => {
    getItem.mockReturnValue('alice');

    const cases: Array<[string, string, string]> = [
      ['/search', 'search', ''],
      ['/search/for/you', 'search', 'alice'],
      ['/search/for/sam', 'search', 'sam'],
      ['/for-you', 'for', ''],
      ['/for-you/', 'for', ''],
      ['/for/you', 'for', 'alice'],
      ['/for/sam', 'for', 'sam'],
      ['/feed/for/you', 'feed', 'alice'],
      ['/feed/for/sam', 'feed', 'sam'],
      ['/follower-feed/you', 'follower-feed', 'alice'],
      ['/follower-feed/sam', 'follower-feed', 'sam'],
      ['/activity/you', 'activity', 'alice'],
      ['/activity/sam', 'activity', 'sam'],
      ['/archive/you', 'archive', 'alice'],
      ['/archive/sam', 'archive', 'sam'],
      ['/settings/you', 'settings', 'alice'],
      ['/settings/sam', 'settings', 'sam'],
      ['/social', 'social', ''],
      ['/social/', 'social', ''],
      ['/social/you', 'social', 'alice'],
      ['/social/sam', 'social', 'sam'],
      ['/social/you/followers', 'social', 'alice'],
      ['/social/you/following', 'social', 'alice'],
      ['/social/you/siblings', 'social', 'alice'],
      ['/social/sam/followers', 'social', 'sam'],
      ['/social/sam/following', 'social', 'sam'],
      ['/social/sam/siblings', 'social', 'sam'],
      ['/sam/archive', 'archive', 'sam'],
      ['/sam/activity', 'activity', 'sam'],
      ['/sam/feed', 'feed', 'sam'],
      ['/sam/social', 'social', 'sam'],
    ];

    for (const [pathname, page, blog] of cases) {
      vi.stubGlobal('window', {
        location: {
          pathname,
          search: '',
          hostname: 'localhost',
          protocol: 'https:',
          href: `https://localhost${pathname}`,
          origin: 'https://localhost',
        },
        history: {
          replaceState: vi.fn(),
        },
      });

      expect(getPageFromPath()).toBe(page);
      expect(getBlogNameFromPath()).toBe(blog);
    }
  });

  it('builds canonical routes with you as the reserved alias for the current blog', () => {
    getItem.mockReturnValue('alice');

    expect(buildPageUrl('search')).toBe('/search');
    expect(buildPageUrl('search', 'alice')).toBe('/search/for/you');
    expect(buildPageUrl('search', 'sam')).toBe('/search/for/sam');
    expect(buildPageUrl('for', 'alice')).toBe('/for/you');
    expect(buildPageUrl('for', 'sam')).toBe('/for/sam');
    expect(buildPageUrl('feed', 'alice')).toBe('/feed/for/you');
    expect(buildPageUrl('feed', 'sam')).toBe('/feed/for/sam');
    expect(buildPageUrl('follower-feed', 'alice')).toBe('/follower-feed/you');
    expect(buildPageUrl('follower-feed', 'sam')).toBe('/follower-feed/sam');
    expect(buildPageUrl('activity', 'alice')).toBe('/activity/you');
    expect(buildPageUrl('activity', 'sam')).toBe('/activity/sam');
    expect(buildPageUrl('archive', 'alice')).toBe('/archive/you');
    expect(buildPageUrl('archive', 'sam')).toBe('/archive/sam');
    expect(buildPageUrl('settings', 'alice')).toBe('/settings/you');
    expect(buildPageUrl('settings', 'sam')).toBe('/settings/sam');
  });

  it('normalizes legacy page aliases onto the new route grammar', () => {
    getItem.mockReturnValue('alice');

    expect(buildPageUrl('posts', 'alice')).toBe('/activity/you');
    expect(buildPageUrl('timeline', 'sam')).toBe('/activity/sam');
    expect(buildPageUrl('social', 'alice')).toBe('/social');
    expect(buildPageUrl('social', 'sam')).toBe('/social/sam');
  });

  it('documents the canonical and legacy router aliases in app-root', () => {
    const appRootSrc = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');

    expect(appRootSrc).toContain("path: '/search'");
    expect(appRootSrc).toContain("path: '/search/for/you'");
    expect(appRootSrc).toContain("path: '/search/for/:blogname'");
    expect(appRootSrc).toContain("path: '/for-you'");
    expect(appRootSrc).toContain("path: '/for-you/'");
    expect(appRootSrc).toContain("path: '/feed/for/you'");
    expect(appRootSrc).toContain("path: '/feed/for/:blogname'");
    expect(appRootSrc).toContain("path: '/follower-feed/you'");
    expect(appRootSrc).toContain("path: '/follower-feed/:blogname'");
    expect(appRootSrc).toContain("path: '/activity/you'");
    expect(appRootSrc).toContain("path: '/activity/:blogname'");
    expect(appRootSrc).toContain("path: '/archive/you'");
    expect(appRootSrc).toContain("path: '/archive/:blogname'");
    expect(appRootSrc).toContain("path: '/settings/:blogname'");
    expect(appRootSrc).toContain("path: '/social'");
    expect(appRootSrc).toContain("path: '/social/'");
    expect(appRootSrc).toContain("path: '/social/you'");
    expect(appRootSrc).toContain("path: '/social/:blogname'");
    expect(appRootSrc).toContain("path: '/social/you/followers'");
    expect(appRootSrc).toContain("path: '/social/you/following'");
    expect(appRootSrc).toContain("path: '/social/you/siblings'");
    expect(appRootSrc).toContain("path: '/social/:blogname/followers'");
    expect(appRootSrc).toContain("path: '/social/:blogname/following'");
    expect(appRootSrc).toContain("path: '/social/:blogname/siblings'");
    expect(appRootSrc).toContain("path: '/:blog/archive'");
    expect(appRootSrc).toContain("path: '/:blog/activity'");
    expect(appRootSrc).toContain("path: '/:blog/feed'");
    expect(appRootSrc).toContain("path: '/:blog/social'");
    expect(appRootSrc).toContain("path: '/follower-feed/:blogname'");
    expect(appRootSrc).toContain("<view-feed .blog=${this.resolveRouteBlogName(blogname || '')} .mode=${'followers'}></view-feed>");
  });
});
