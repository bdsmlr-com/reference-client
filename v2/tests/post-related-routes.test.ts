// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('post related routes', () => {
  it('app router exposes seed-scoped related routes', () => {
    const appRootSrc = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');

    expect(appRootSrc).toContain("path: '/post/:postId/related'");
    expect(appRootSrc).toContain("path: '/post/:postId/related/for/you'");
    expect(appRootSrc).toContain("path: '/post/:postId/related/for/:blogname'");
    expect(appRootSrc).toContain('FEATURE_FLAGS.more_like_this_on_post === true');
    expect(appRootSrc).toContain("this.redirectLegacyRoute(`/post/${postId}`)");
  });

  it('post detail recommendations are hidden by the post feature flag by default', () => {
    const detailSrc = readFileSync(join(ROOT, 'components/post-detail-content.ts'), 'utf8');
    const presentationSrc = readFileSync(join(ROOT, 'services/post-presentation.ts'), 'utf8');
    const configSrc = readFileSync(join(ROOT, 'config.ts'), 'utf8');
    const mediaConfigSrc = readFileSync(join(process.cwd(), 'media-config.json'), 'utf8');

    expect(detailSrc).toContain('.showBrowseLink=${true}');
    expect(presentationSrc).toContain("showRecommendations: FEATURE_FLAGS.more_like_this_on_post === true && (ctx.page === 'post' || ctx.page === 'activity')");
    expect(configSrc).toContain('more_like_this_on_post?: boolean;');
    expect(configSrc).toContain("fetchImpl('/v2/runtime-config'");
    expect(configSrc).toContain('export interface RuntimeConfigPayload');
    expect(configSrc).toContain('export const FEATURE_FLAGS');
    expect(mediaConfigSrc).not.toContain('media_format_by_surface');
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
    expect(recommendationsSrc).not.toContain("from '../services/recommendation-api.js'");
    expect(apiSrc).toContain("'/v2/related-posts'");
  });

  it('passes the authoritative original perspective for a matching blog-scoped route', async () => {
    const { apiClient } = await import('../src/services/client.js');
    await import('../src/pages/view-post-related.js');
    vi.spyOn(apiClient.posts, 'get').mockResolvedValue({
      post: { id: 50, blogId: 10, blogName: 'origin' },
    } as any);
    const related = vi.spyOn(apiClient.posts, 'related').mockResolvedValue({ posts: [] } as any);
    vi.spyOn(apiClient.posts, 'relatedLegacy').mockResolvedValue({ posts: [] } as any);
    const element = document.createElement('view-post-related') as any;
    element.postId = '50';
    element.routePerspective = 'origin';
    document.body.append(element);

    await element.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(related).toHaveBeenCalledWith(expect.objectContaining({
      seed_post_id: 50,
      perspective_role: 'original',
      perspective_blog_id: 10,
      perspective_blog_name: 'origin',
    }), expect.any(Object));
  });
});
