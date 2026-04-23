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
});
