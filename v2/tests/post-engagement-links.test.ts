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

    expect(src).toContain("import { resolveLink, type ResolvedLink } from '../services/link-resolver.js';");
    expect(src).toContain("import { toPresentationModel } from '../services/post-presentation.js';");
    expect(src).toContain('private normalizeBlogName');
    expect(src).toContain('private renderBlogIdentity');
    expect(src).toContain('private renderResolvedBlogIdentity');
    expect(src).toContain('private renderIdentityLabel');
    expect(src).toContain('const presentation = toPresentationModel');
    expect(src).not.toContain('POST_TYPE_ICONS[p.type as PostType] ||');
    expect(src).toContain("resolveLink('post_permalink'");
    expect(src).toContain("const normalized = (blogName || '').trim();");
    expect(src).toContain("const label = normalized ? `@${normalized}` : '@unknown';");
    expect(src).not.toContain('href="/${p.originBlogName}/posts"');
    expect(src).not.toContain('href="/${p.blogName}/posts"');
    expect(src).toContain('presentation.identity.viaBlogDecoration');
    expect(src).toContain('presentation.identity.originBlogDecoration');
  });

  it('links both origin and via post ids in reblog lightbox details', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("const originPostLink = presentation.identity.originPostPermalink || resolveLink('post_permalink', { postId: p.originPostId as number });");
    expect(src).toContain("const viaPostLink = presentation.identity.viaPostPermalink || presentation.identity.permalink;");
    expect(src).toContain('via ♻️ ${this.renderResolvedBlogIdentity(presentation.identity.viaBlog, presentation.identity.viaBlogLabel, presentation.identity.viaBlogDecoration)} /');
    expect(src).toContain('${typeIcon} ${this.renderResolvedBlogIdentity(presentation.identity.originBlog, presentation.identity.originBlogLabel, presentation.identity.originBlogDecoration)} /');
    expect(src).toContain('href=${viaPostLink.href}');
  });

  it('keeps ordinary post metadata linked via the primary blog identity', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain('this.renderResolvedBlogIdentity(presentation.identity.viaBlog || presentation.identity.originBlog, presentation.identity.primaryBlogLabel, presentation.identity.viaBlogDecoration || presentation.identity.originBlogDecoration)');
  });
});
