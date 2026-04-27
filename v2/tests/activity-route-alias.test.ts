import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('activity route alias', () => {
  it('media config defines explicit link contexts', () => {
    const mediaConfigPath = join(process.cwd(), 'media-config.json');
    const mediaConfig = JSON.parse(readFileSync(mediaConfigPath, 'utf8'));
    const links = mediaConfig.links;

    expect(links).toBeDefined();
    expect(links.contexts).toBeDefined();
    expect(links.contexts.post_permalink).toBeDefined();
    expect(links.contexts.post_origin_blog).toBeDefined();
    expect(links.contexts.post_via_blog).toBeDefined();
  });

  it('app router exposes canonical activity and legacy alias routes', () => {
    const appRootSrc = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');

    expect(appRootSrc).toContain("{ path: '/activity/:blogname'");
    expect(appRootSrc).toContain("{ path: '/:blog/activity'");
    expect(appRootSrc).not.toContain("{ path: '/:blog/posts'");
  });

  it('shared nav targets activity path for the activity tab', () => {
    const navSrc = readFileSync(join(ROOT, 'components/shared-nav.ts'), 'utf8');
    const headerSrc = readFileSync(join(ROOT, 'components/blog-header.ts'), 'utf8');
    const resolverSrc = readFileSync(join(ROOT, 'services/blog-resolver.ts'), 'utf8');

    expect(navSrc).toContain("if (page === 'activity')");
    expect(navSrc).toContain("return buildPageUrl('activity', activeBlog);");
    expect(headerSrc).toContain("import { resolveLink } from '../services/link-resolver.js';");
    expect(headerSrc).toContain("resolveLink('blog_header_external_blog'");
    expect(resolverSrc).toContain("const BLOG_PAGES = ['search', 'feed', 'follower-feed', 'activity', 'archive', 'settings', 'social'];");
  });

  it('activity view treats newest as canonical and keeps URLs minimal', () => {
    const postsSrc = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');

    expect(postsSrc).not.toContain("const sort = getUrlParam('sort');");
    expect(postsSrc).toContain("this.sortValue = 'newest';");
    expect(postsSrc).toContain('sort_field: sortOption.field');
    expect(postsSrc).toContain('<activity-kind-pills');
    expect(postsSrc).not.toContain('<filter-bar');
    expect(postsSrc).toContain('activity_kinds: this.activityKinds');
    expect(postsSrc).toContain('TYPE_ENUM_TO_NAME');
    expect(postsSrc).not.toContain('VARIANT_ENUM_TO_NAME');
    expect(postsSrc).toContain('setUrlParams({');
    expect(postsSrc).not.toContain('sort: this.sortValue');
    expect(postsSrc).not.toContain('blog: this.blog');
  });

  it('activity kind pills include all + posts/reblogs/likes/comments in one row', () => {
    const pillsSrc = readFileSync(join(ROOT, 'components/activity-kind-pills.ts'), 'utf8');
    expect(pillsSrc).toContain('>All</button>');
    expect(pillsSrc).toContain("label: 'Posts'");
    expect(pillsSrc).toContain("label: 'Reblogs'");
    expect(pillsSrc).toContain("label: 'Likes'");
    expect(pillsSrc).toContain("label: 'Comments'");
  });
});
