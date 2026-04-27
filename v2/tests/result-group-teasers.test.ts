import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('result-group teaser consumers', () => {
  it('discover uses result-group as the teaser shell for for-you recommendations', () => {
    const src = readFileSync(join(ROOT, 'pages/view-discover.ts'), 'utf8');

    expect(src).toContain('<result-group');
    expect(src).toContain('.title=${title}');
    expect(src).toContain('.description=${description}');
    expect(src).toContain("const targetHref = subjectBlog ? buildPageUrl('for', subjectBlog) : '';");
    expect(src).toContain("window.location.pathname === targetHref ? '' : targetHref");
    expect(src).toContain(".actionLabel=${'See more'}");
    expect(src).toContain(".mode=${this.galleryMode}");
  });

  it('related page uses result-group as the outer shell around recommendation results', () => {
    const src = readFileSync(join(ROOT, 'pages/view-post-related.ts'), 'utf8');

    expect(src).toContain('<result-group');
    expect(src).toContain('?bare=${true}');
    expect(src).toContain('.title=${this.title}');
    expect(src).toContain(".mode=${'list'}");
    expect(src).toContain('.tab.active');
  });
});
