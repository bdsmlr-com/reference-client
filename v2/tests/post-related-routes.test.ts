// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apiClient } from '../src/services/client.js';
import { clearAuthUser, setAuthUser } from '../src/state/auth-state.js';
import '../src/pages/view-post-related.js';

const ROOT = join(process.cwd(), 'src');

async function loadRoute(routePerspective: string, post: Record<string, unknown>) {
  vi.spyOn(apiClient.posts, 'get').mockResolvedValue({ post } as any);
  const related = vi.spyOn(apiClient.posts, 'related').mockResolvedValue({ posts: [] } as any);
  vi.spyOn(apiClient.posts, 'relatedLegacy').mockResolvedValue({ posts: [] } as any);
  const element = document.createElement('view-post-related') as any;
  element.postId = '50';
  element.routePerspective = routePerspective;
  document.body.append(element);
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
  return related;
}

afterEach(() => {
  document.body.replaceChildren();
  clearAuthUser();
  vi.restoreAllMocks();
});

describe('post related routes', () => {
  it('app router exposes seed-scoped related routes', () => {
    const appRootSrc = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');
    expect(appRootSrc).toContain("path: '/post/:postId/related'");
    expect(appRootSrc).toContain("path: '/post/:postId/related/for/you'");
    expect(appRootSrc).toContain("path: '/post/:postId/related/for/:blogname'");
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

  it('related page uses the first-class posts API instead of the rec proxy', () => {
    const recommendationsSrc = readFileSync(join(ROOT, 'components/post-recommendations.ts'), 'utf8');
    const apiSrc = readFileSync(join(ROOT, 'services/api.ts'), 'utf8');

    expect(recommendationsSrc).toContain('apiClient.posts.related({');
    expect(recommendationsSrc).not.toContain('recService.getSimilarPosts(');
    expect(recommendationsSrc).not.toContain("from '../services/recommendation-api.js'");
    expect(apiSrc).toContain("'/v2/related-posts'");
  });

  it('uses the strict viewer identity for the canonical for-you route', async () => {
    setAuthUser({ userId: 1, blogId: 30, activeBlogId: 30, activeBlogName: 'viewer-blog', blogs: [{ id: 30, name: 'viewer-blog' }] });
    const related = await loadRoute('you', {
      id: 50, originPostId: 40, originBlogId: 10, originBlogName: 'original-blog', blogId: 20, blogName: 'reblogger-blog',
    });
    expect(related).toHaveBeenCalledWith(expect.objectContaining({
      seed_post_id: 40, perspective_role: 'viewer', perspective_blog_id: 30, perspective_blog_name: 'viewer-blog',
    }), expect.any(Object));
    expect(related.mock.calls[0]?.[0]).not.toHaveProperty('displayedReblogPostId');
  });

  it('keeps an explicit original route original when a viewer is available', async () => {
    setAuthUser({ userId: 1, blogId: 30, activeBlogId: 30, activeBlogName: 'viewer-blog', blogs: [{ id: 30, name: 'viewer-blog' }] });
    const related = await loadRoute('original-blog', {
      id: 50, originPostId: 40, originBlogId: 10, originBlogName: 'original-blog', blogId: 20, blogName: 'reblogger-blog',
    });
    expect(related).toHaveBeenCalledWith(expect.objectContaining({
      seed_post_id: 40, perspective_role: 'original', perspective_blog_id: 10, perspective_blog_name: 'original-blog',
    }), expect.any(Object));
    expect(related.mock.calls[0]?.[0]).not.toHaveProperty('displayedReblogPostId');
  });

  it('keeps an explicit reblogger route reblogger when a viewer is available', async () => {
    setAuthUser({ userId: 1, blogId: 30, activeBlogId: 30, activeBlogName: 'viewer-blog', blogs: [{ id: 30, name: 'viewer-blog' }] });
    const related = await loadRoute('reblogger-blog', {
      id: 50, originPostId: 40, originBlogId: 10, originBlogName: 'original-blog', blogId: 20, blogName: 'reblogger-blog',
    });
    expect(related).toHaveBeenCalledWith(expect.objectContaining({
      seed_post_id: 40, perspective_role: 'reblogger', perspective_blog_id: 20, perspective_blog_name: 'reblogger-blog', displayedReblogPostId: 50,
    }), expect.any(Object));
  });

  it('treats a materialized original as original when its origin post id is its own id', async () => {
    const related = await loadRoute('you', {
      id: 50, originPostId: 50, originBlogId: 10, originBlogName: 'original-blog', blogId: 10, blogName: 'original-blog',
    });

    expect(related).toHaveBeenCalledWith(expect.objectContaining({
      seed_post_id: 50, perspective_role: 'original', perspective_blog_id: 10, perspective_blog_name: 'original-blog',
    }), expect.any(Object));
    expect(related.mock.calls[0]?.[0]).not.toHaveProperty('displayedReblogPostId');
    expect(document.querySelector('view-post-related')?.shadowRoot?.textContent).not.toContain('Reblogger');
  });
});
