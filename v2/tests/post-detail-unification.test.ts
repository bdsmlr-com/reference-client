import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('post detail unification', () => {
  it('uses shared post-detail-content in the post route without lightbox wiring', () => {
    const postViewSrc = readFileSync(join(ROOT, 'pages/view-post.ts'), 'utf8');
    const detailSrc = readFileSync(join(ROOT, 'components/post-detail-content.ts'), 'utf8');
    const engagementSrc = readFileSync(join(ROOT, 'components/post-engagement.ts'), 'utf8');

    expect(postViewSrc).toContain("import '../components/post-detail-content.js';");
    expect(postViewSrc).not.toContain("import '../components/post-feed-item.js';");
    expect(detailSrc).toContain("import { toPresentationModel } from '../services/post-presentation.js';");
    expect(detailSrc).toContain("import { renderStructuredMicroBlogIdentity } from '../services/blog-identity-render.js';");
    expect(detailSrc).toContain("import './media-renderer.js';");
    expect(detailSrc).toContain("@property({ type: String }) surface: 'detail' | 'lightbox' = 'detail';");
    expect(detailSrc).toContain("const presentation = toPresentationModel(p, {");
    expect(detailSrc).toContain("const recommendationsMode = this.surface === 'lightbox' ? 'list' : 'grid';");
    expect(detailSrc).toContain("const engagementStandalone = false;");
    expect(postViewSrc).toContain('<post-detail-content');
    expect(postViewSrc).not.toContain('<post-feed-item');
    expect(postViewSrc).not.toContain('recommendationsMode=');
    expect(postViewSrc).not.toContain('engagementStandalone');
    expect(engagementSrc).not.toContain('<div class="lightbox-links">');
  });

  it('falls back to title-bearing text payloads when html/body are empty', () => {
    const detailSrc = readFileSync(join(ROOT, 'components/post-detail-content.ts'), 'utf8');

    expect(detailSrc).toContain('const bodyHtml =');
    expect(detailSrc).toContain('const titleText =');
    expect(detailSrc).toContain('p.title || p.content?.title');
    expect(detailSrc).toContain('class="post-title"');
    expect(detailSrc).toContain('p.content?.html');
    expect(detailSrc).toContain('p.body');
    expect(detailSrc).toContain('p.content?.text');
    expect(detailSrc).toContain('p.content?.title');
  });

  it('renders separate reblog and origin tag sections on RP detail pages', () => {
    const postViewSrc = readFileSync(join(ROOT, 'pages/view-post.ts'), 'utf8');
    const detailSrc = readFileSync(join(ROOT, 'components/post-detail-content.ts'), 'utf8');

    expect(postViewSrc).toContain('private originPost: ProcessedPost | null = null;');
    expect(postViewSrc).toContain('resp.post.originPostId');
    expect(postViewSrc).toContain('!resp.post.originPostMissing');
    expect(postViewSrc).toContain('const originResp = await apiClient.posts.get(originPostId);');
    expect(postViewSrc).toContain('} catch {');
    expect(postViewSrc).toContain('Keep the main post visible even when the linked origin no longer resolves.');
    expect(detailSrc).toContain("@property({ type: Object }) originPost: ProcessedPost | null = null;");
    expect(detailSrc).toContain('const reblogTags = extractRenderableTags(p);');
    expect(detailSrc).toContain('const originTags = this.originPost ? extractRenderableTags(this.originPost) : [];');
    expect(detailSrc).toContain("const viaBlogName = `${p.blogName || presentation.identity.viaBlogLabel || ''}`.trim().replace(/^@+/, '');");
    expect(detailSrc).toContain("const originBlogName = `${p.originBlogName || presentation.identity.originBlogLabel || ''}`.trim().replace(/^@+/, '');");
    expect(detailSrc).toContain("class=\"tag-section-label\">${viaBlogName || 'Reblogger'} tagged:</div>");
    expect(detailSrc).toContain("class=\"tag-section-label\">${originBlogName || 'Origin'} tagged:</div>");
  });
});


  it('uses the shared micro identity renderer for removed-origin strikethrough instead of a detail-only code path', () => {
    const cardSrc = readFileSync(join(ROOT, 'components/post-card.ts'), 'utf8');
    const detailSrc = readFileSync(join(ROOT, 'components/post-detail-content.ts'), 'utf8');
    const identityRenderSrc = readFileSync(join(ROOT, 'services/blog-identity-render.ts'), 'utf8');
    const identitySrc = readFileSync(join(ROOT, 'components/blog-identity.ts'), 'utf8');

    expect(cardSrc).toContain('presentation.identity.originBlogGone');
    expect(detailSrc).toContain('presentation.identity.originBlogGone');
    expect(detailSrc).toContain('renderStructuredMicroBlogIdentity({');
    expect(identityRenderSrc).toContain('strikethrough');
    expect(identitySrc).toContain('@property({ type: Boolean }) strikethrough = false;');
    expect(identitySrc).toContain('text-decoration: line-through;');
  });
