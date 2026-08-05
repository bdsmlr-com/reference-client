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
    expect(src).toContain('<load-footer');
    expect(src).toContain('pageName="discover"');
    expect(src).toContain('apiClient.blogs.listRecommended');
    expect(src).toContain('Blogs you may like');
    expect(src).toContain('<blog-list .items=${this.recommendedBlogs}></blog-list>');
  });

  it('search teaser uses the dedicated v2 for-you endpoint instead of the recs facade', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain('apiClient.posts.forYou({');
    expect(src).not.toContain('getRecommendedPostsForUser(');
  });

  it('related page uses post-recommendations as the outer shell around recommendation results', () => {
    const src = readFileSync(join(ROOT, 'pages/view-post-related.ts'), 'utf8');

    expect(src).toContain('.title=${this.title}');
    expect(src).toContain(".mode=${'grid'}");
    expect(src).toContain('.perspective=${this.selectedPerspective}');
    expect(src).toContain('<post-recommendations');
    expect(src).toContain("@property({ type: String }) routePerspective = 'you';");
    expect(src).toContain("title = 'Related posts';");
    expect(src).toContain('role="tablist"');
    expect(src).toContain('role="tabpanel"');
    expect(src).toContain('buildRelatedPerspectiveTabs');
    expect(src).toContain('Perspectives for similar posts from @${this.originalBlogName}');
    expect(src).toContain('gap: 6px');
    expect(src).toContain('flex-wrap: wrap');
    expect(src).toContain('padding: 6px 14px');
    expect(src).toContain('border-radius: 4px');
    expect(src).toContain('background: var(--bg-panel)');
    expect(src).toContain('border: 1px solid var(--border)');
    expect(src).toContain('color: var(--text-muted)');
    expect(src).toContain('.perspective-tab.active');
    expect(src).toContain('background: var(--accent)');
    expect(src).toContain('.perspective-tab:focus-visible');
    expect(src).toContain('outline: 2px solid var(--accent)');
  });
});
