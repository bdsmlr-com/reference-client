import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('post related routes', () => {
  it('app router exposes seed-scoped related routes', () => {
    const appRootSrc = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');

    expect(appRootSrc).toContain("path: '/post/:postId/related'");
    expect(appRootSrc).toContain("path: '/post/:postId/related/for/you'");
    expect(appRootSrc).toContain("path: '/post/:postId/related/for/:blogname'");
    expect(appRootSrc).toContain("<view-post-related");
  });

  it('post detail recommendations expose a browse link to the first-class related page', () => {
    const detailSrc = readFileSync(join(ROOT, 'components/post-detail-content.ts'), 'utf8');
    const recommendationsSrc = readFileSync(join(ROOT, 'components/post-recommendations.ts'), 'utf8');

    expect(detailSrc).toContain('.showBrowseLink=${true}');
    expect(recommendationsSrc).toContain('href="/post/${id}/related"');
    expect(recommendationsSrc).toContain('@property({ type: String }) perspectiveBlogName = \'\'');
    expect(recommendationsSrc).toContain('@post-click=${this.handleGridPostClick}');
    expect(recommendationsSrc).toContain('window.location.href = buildPostHref(post.id, this.from);');
  });

  it('related page renders perspective tabs for default, you, and blog-scoped variants', () => {
    const pageSrc = readFileSync(join(ROOT, 'pages/view-post-related.ts'), 'utf8');

    expect(pageSrc).toContain("@property({ type: String }) title = 'More like this';");
    expect(pageSrc).toContain("label: 'for you'");
    expect(pageSrc).toContain('addPerspective(this.seedPost?.originBlogName);');
    expect(pageSrc).toContain('addPerspective(this.seedPost?.blogName);');
    expect(pageSrc).toContain('apiClient.posts.get(id)');
    expect(pageSrc).not.toContain('<result-group');
    expect(pageSrc).toContain(".mode=${'grid'}");
  });

  it('related page uses the first-class posts API instead of the rec proxy', () => {
    const recommendationsSrc = readFileSync(join(ROOT, 'components/post-recommendations.ts'), 'utf8');
    const apiSrc = readFileSync(join(ROOT, 'services/api.ts'), 'utf8');

    expect(recommendationsSrc).toContain('apiClient.posts.related({');
    expect(recommendationsSrc).not.toContain('recService.getSimilarPosts(');
    expect(apiSrc).toContain("'/v2/related-posts'");
  });
});
