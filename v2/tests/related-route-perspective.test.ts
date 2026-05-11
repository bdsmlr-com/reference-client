import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('related route perspective', () => {
  it('redirects the bare related route to the canonical for-you route', () => {
    const src = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');

    expect(src).toContain("path: '/post/:postId/related'");
    expect(src).toContain("this.redirectLegacyRoute(`/post/${postId}/related/for/you`)");
    expect(src).toContain("path: '/post/:postId/related/for/you'");
    expect(src).toContain(".routePerspective=${'you'}");
    expect(src).toContain("title=${'More like this'}");
  });

  it('keeps the explicit related perspective route shareable and route-driven', () => {
    const src = readFileSync(join(ROOT, 'pages/view-post-related.ts'), 'utf8');

    expect(src).toContain("@property({ type: String }) routePerspective = 'you';");
    expect(src).toContain("title = 'More like this';");
    expect(src).toContain('private get currentPerspective(): string {');
    expect(src).toContain('private get perspectiveNavItems(): Array<{ href: string; label: string; active: boolean }> {');
    expect(src).toContain('class="perspective-nav"');
    expect(src).toContain('class="perspective-link');
    expect(src).toContain('for you');
    expect(src).toContain('aria-current=${item.active ?');
    expect(src).toContain('.perspectiveBlogName=${this.perspectiveBlogName}');
    expect(src).not.toContain('getPrimaryBlogName()');
    expect(src).not.toContain('seedPost');
    expect(src).not.toContain('.tab.active');
  });
});
