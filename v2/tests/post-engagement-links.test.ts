import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveLink } from '../src/services/link-resolver';

const FILE = join(process.cwd(), 'src/components/post-engagement.ts');

describe('post engagement links', () => {
  it('resolves legacy link contexts with _blank target by default', () => {
    const link = resolveLink('blog_header_external_blog', { blog: 'frenchdoctor' });
    expect(link.href).toBe('https://frenchdoctor.bdsmlr.com');
    expect(link.target).toBe('_blank');
    expect(link.isExternal).toBe(true);
  });

  it('resolves internal link contexts with _self target by default', () => {
    const link = resolveLink('post_permalink', { postId: '123' });
    expect(link.href).toBe('/post/123');
    expect(link.target).toBe('_self');
    expect(link.isExternal).toBe(false);
  });

  it('guards empty blog names and falls back to @unknown text', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("import { resolveLink } from '../services/link-resolver.js';");
    expect(src).toContain('private normalizeBlogName');
    expect(src).toContain('private renderBlogIdentity');
    expect(src).toContain("resolveLink('post_permalink'");
    expect(src).toContain("'post_origin_blog' | 'post_via_blog'");
    expect(src).toContain("'post_via_blog'");
    expect(src).toContain("const normalized = (blogName || '').trim();");
    expect(src).toContain("const label = normalized ? `@${normalized}` : '@unknown';");
    expect(src).not.toContain('href="/${p.originBlogName}/posts"');
    expect(src).not.toContain('href="/${p.blogName}/posts"');
  });

  it('links both origin and via post ids in reblog lightbox details', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("const originPostLink = resolveLink('post_permalink', { postId: p.originPostId as number });");
    expect(src).toContain("const viaPostLink = resolveLink('post_permalink', { postId: p.id });");
    expect(src).toContain('via ♻️ ${this.renderBlogIdentity(p.blogName)} /');
    expect(src).toContain('href=${viaPostLink.href}');
  });
});
