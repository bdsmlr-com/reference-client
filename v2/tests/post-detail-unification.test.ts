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
    expect(detailSrc).toContain('p.content?.html');
    expect(detailSrc).toContain('p.body');
    expect(detailSrc).toContain('p.content?.text');
    expect(detailSrc).toContain('p.content?.title');
  });
});
