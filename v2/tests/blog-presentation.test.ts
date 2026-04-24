import { describe, expect, it } from 'vitest';
import { buildBlogPresentation } from '../src/services/blog-presentation';
import type { Blog } from '../src/types/api';

function makeBlog(overrides: Partial<Blog> = {}): Blog {
  return {
    id: 42,
    name: 'aurora',
    title: 'Aurora City',
    followersCount: 1280,
    postsCount: 91,
    interests: {
      maledom: true,
      latex: true,
      other: false,
    },
    personals: {
      labels: {
        location: '  Berlin  ',
        motto: '  ',
        broken: 123,
      } as any,
    },
    privacy: {
      isPrivate: true,
      isPublic: false,
    },
    ...overrides,
  };
}

describe('buildBlogPresentation', () => {
  it('builds a public presentation without privacy chips', () => {
    const presentation = buildBlogPresentation(makeBlog(), 'public');

    expect(presentation.mode).toBe('public');
    expect(presentation.identity.blogLabel).toBe('@aurora');
    expect(presentation.privacy.summary).toBeNull();
    expect(presentation.chips).toEqual([
      { kind: 'interest', label: 'Male dom' },
      { kind: 'interest', label: 'Latex' },
      { kind: 'personal', label: 'location', value: 'Berlin' },
    ]);
    expect(presentation.privacy.chips).toEqual([]);
    expect(presentation.chips.some((chip) => chip.kind === 'privacy')).toBe(false);
    expect(presentation.stats).toBeNull();
  });

  it('builds a settings presentation with privacy summary and stats', () => {
    const publicPresentation = buildBlogPresentation(makeBlog(), 'public');
    const presentation = buildBlogPresentation(makeBlog(), 'settings');

    expect(presentation.mode).toBe('settings');
    expect(presentation.identity).toEqual(publicPresentation.identity);
    expect(presentation.stats).toEqual({
      followersCount: 1280,
      postsCount: 91,
    });
    expect(presentation.privacy.summary).toBe('Private blog');
    expect(presentation.privacy.chips).toEqual([
      { kind: 'privacy', label: 'Private', value: 'Enabled' },
    ]);
    expect(presentation.chips.some((chip) => chip.kind === 'privacy')).toBe(true);
    expect(presentation.chips).toEqual([
      { kind: 'interest', label: 'Male dom' },
      { kind: 'interest', label: 'Latex' },
      { kind: 'personal', label: 'location', value: 'Berlin' },
      { kind: 'privacy', label: 'Private', value: 'Enabled' },
    ]);
  });

  it('keeps the canonical handle separate from the title fallback', () => {
    const presentation = buildBlogPresentation(
      makeBlog({ name: '', title: 'Handleless Display Title' }),
      'public',
    );

    expect(presentation.identity.blogName).toBe('blog');
    expect(presentation.identity.blogLabel).toBe('@blog');
    expect(presentation.identity.title).toBe('Handleless Display Title');
    expect(presentation.identity.initial).toBe('B');
  });
});
