import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('blog theme integration', () => {
  it('invalidates legacy cached blog theme entries missing avatar/background fields', () => {
    const src = readFileSync(join(ROOT, 'services/blog-theme.ts'), 'utf8');

    expect(src).toContain('BLOG_THEME_CACHE_VERSION');
    expect(src).toContain('entry.version !== BLOG_THEME_CACHE_VERSION');
    expect(src).toContain('hasBlogIdentityFields(entry.blog)');
  });

  it('applies blog background color directly instead of suppressing dark colors in light mode', () => {
    const src = readFileSync(join(ROOT, 'services/blog-theme.ts'), 'utf8');

    expect(src).toContain('result.background = blogBg;');
    expect(src).not.toContain('blogBgLuminance > 0.4');
    expect(src).not.toContain('blogBgLuminance < 0.4');
  });

  it('global page styles consume blog background and text variables', () => {
    const src = readFileSync(join(ROOT, 'styles/theme.ts'), 'utf8');

    expect(src).toContain('background: var(--blog-bg, var(--bg-primary));');
    expect(src).toContain('color: var(--blog-text, var(--text-primary));');
  });

  it('blog pages do not cover the custom blog background with default host backgrounds', () => {
    const archive = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');
    const activity = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');
    const feed = readFileSync(join(ROOT, 'pages/view-feed.ts'), 'utf8');
    const social = readFileSync(join(ROOT, 'pages/view-social.ts'), 'utf8');

    for (const src of [archive, activity, feed, social]) {
      expect(src).toContain('background: var(--blog-bg, var(--bg-primary));');
    }
  });

  it('fetches blog identity by name through the get-blog contract', () => {
    const src = readFileSync(join(ROOT, 'services/blog-theme.ts'), 'utf8');

    expect(src).toContain('apiClient.blogs.get({ blog_name: blogName })');
    expect(src).not.toContain('apiClient.identity.resolveNameToId(blogName)');
  });
});
