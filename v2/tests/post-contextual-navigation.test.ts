import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('post contextual navigation', () => {
  it('threads explicit from provenance into the post detail route', () => {
    const appRootSrc = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');
    const postViewSrc = readFileSync(join(ROOT, 'pages/view-post.ts'), 'utf8');

    expect(appRootSrc).toContain('buildPostHref(post.id, from)');
    expect(postViewSrc).toContain("@property({ type: String }) from = 'direct';");
    expect(appRootSrc).toContain(".from=${new URLSearchParams(window.location.search).get('from') || 'direct'}");
    expect(postViewSrc).toContain('<post-detail-content');
    expect(postViewSrc).toContain('.from=${this.from as PostRouteSource}');
  });

  it('uses contextual tag search links on the post page', () => {
    const detailSrc = readFileSync(join(ROOT, 'components/post-detail-content.ts'), 'utf8');
    const routeCtxSrc = readFileSync(join(ROOT, 'services/post-route-context.ts'), 'utf8');

    expect(detailSrc).toContain('buildContextualTagSearchHref');
    expect(detailSrc).toContain('buildScopedReblogDetailTagHref');
    expect(detailSrc).toContain("@property({ type: String }) from = 'direct';");
    expect(detailSrc).toContain('const href = buildContextualTagSearchHref(tag, p, this.from as PostRouteSource);');
    expect(detailSrc).toContain('.from=${this.from as PostRouteSource}');
    expect(routeCtxSrc).toContain('export function buildScopedReblogDetailTagHref(');
    expect(routeCtxSrc).toContain("return `${buildPageUrl('archive', normalizedBlog)}?q=${encodeURIComponent(tagExpr)}`;");
  });
});
