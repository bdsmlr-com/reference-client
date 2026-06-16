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
    expect(configSrc).toContain('reblog_composer?: boolean;');
    expect(configSrc).toContain("media_format_by_surface?: Partial<Record<MediaSurface, MediaSurfaceFormat>>;");
    expect(configSrc).toContain("VITE_MEDIA_FORMAT_LIGHTBOX");
    expect(configSrc).toContain('export const FEATURE_FLAGS');
    expect(mediaConfigSrc).toContain('\"reblog_composer\": false');
    expect(mediaConfigSrc).toContain('\"media_format_by_surface\"');
    expect(mediaConfigSrc).toContain('\"post-detail\": \"raw\"');
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
