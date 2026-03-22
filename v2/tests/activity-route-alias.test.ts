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

  it('app router uses only /:blog/activity', () => {
    const appRootSrc = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');

    expect(appRootSrc).toContain("{ path: '/:blog/activity'");
    expect(appRootSrc).not.toContain("{ path: '/:blog/posts'");
  });

  it('shared nav targets activity path for the activity tab', () => {
    const navSrc = readFileSync(join(ROOT, 'components/shared-nav.ts'), 'utf8');
    const headerSrc = readFileSync(join(ROOT, 'components/blog-header.ts'), 'utf8');

    expect(navSrc).toContain("if (page === 'posts')");
    expect(navSrc).toContain("return resolveLink('nav_activity', { blog: blogName }).href;");
    expect(navSrc).toContain("import { resolveLink } from '../services/link-resolver.js';");
    expect(navSrc).toContain("resolveLink('nav_logo'");
    expect(headerSrc).toContain("import { resolveLink } from '../services/link-resolver.js';");
    expect(headerSrc).toContain("resolveLink('blog_header_external_blog'");
  });

  it('activity view normalizes sort and forces newest for interaction kinds', () => {
    const postsSrc = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');

    expect(postsSrc).toContain("const sort = getUrlParam('sort');");
    expect(postsSrc).toContain('this.sortValue = normalizeSortValue(sort);');
    expect(postsSrc).toContain("const hasInteractionKinds = this.activityKinds.includes('like') || this.activityKinds.includes('comment');");
    expect(postsSrc).toContain("if (hasInteractionKinds && this.sortValue !== 'newest')");
    expect(postsSrc).toContain("this.sortValue = 'newest';");
    expect(postsSrc).toContain('sort_field: sortOption.field');
    expect(postsSrc).toContain(".showSort=${!(this.activityKinds.includes('like') || this.activityKinds.includes('comment'))}");
    expect(postsSrc).toContain('activity_kinds: this.activityKinds');
    expect(postsSrc).toContain('TYPE_ENUM_TO_NAME');
    expect(postsSrc).not.toContain('VARIANT_ENUM_TO_NAME');
    expect(postsSrc).toContain('.showVariants=${false}');
    expect(postsSrc).not.toContain('@variant-change=${this.handleVariantChange}');
    expect(postsSrc).toContain('if (!isBlogInPath())');
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
