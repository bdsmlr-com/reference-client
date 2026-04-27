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
  });

  it('recommendation API forwards perspective blog name when provided', () => {
    const apiSrc = readFileSync(join(ROOT, 'services/recommendation-api.ts'), 'utf8');

    expect(apiSrc).toContain('perspectiveBlogName?: string');
    expect(apiSrc).toContain("params.set('perspective_blog_name', perspectiveBlogName);");
  });
});
