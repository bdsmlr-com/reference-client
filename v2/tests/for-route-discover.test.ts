import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('for-you discover routes', () => {
  it('routes /for/you and /for/:blogname to discover with a blog perspective', () => {
    const src = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');
    const resolverSrc = readFileSync(join(ROOT, 'services/blog-resolver.ts'), 'utf8');

    expect(src).toContain("path: '/for/you'");
    expect(src).toContain("<view-discover .blog=${this.resolveRouteBlogName('you')}></view-discover>");
    expect(src).toContain("path: '/for/:blogname'");
    expect(src).toContain("<view-discover .blog=${this.resolveRouteBlogName(blogname || '')}></view-discover>");
    expect(src).toContain("else if (pathname.startsWith('/for/')) currentPage = 'blogs';");
    expect(resolverSrc).toContain("if (first === 'for') {");
    expect(resolverSrc).toContain("return { page: 'for', blogName: resolvePathBlogSegment(second) };");
  });

  it('uses the routed blog perspective instead of always falling back to the primary blog', () => {
    const src = readFileSync(join(ROOT, 'pages/view-discover.ts'), 'utf8');

    expect(src).toContain("@property({ type: String }) blog = '';");
    expect(src).toContain('const blogName = this.blog || getPrimaryBlogName() ||');
    expect(src).toContain('getRecommendedPostsForUser(');
    expect(src).toContain('ViewDiscover.PAGE_SIZE');
    expect(src).toContain('this.nextOffset');
    expect(src).toContain('const isPrimaryPerspective = !!subjectBlog && subjectBlog === primaryBlog;');
    expect(src).toContain("const title = isPrimaryPerspective ? 'For You' : `For @${subjectBlog}`;");
  });
});
