import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('post detail unification', () => {
  it('uses shared post-detail-content in both view-post and post-lightbox', () => {
    const lightboxSrc = readFileSync(join(ROOT, 'components/post-lightbox.ts'), 'utf8');
    const postViewSrc = readFileSync(join(ROOT, 'pages/view-post.ts'), 'utf8');
    const detailSrc = readFileSync(join(ROOT, 'components/post-detail-content.ts'), 'utf8');

    expect(lightboxSrc).toContain("import './post-detail-content.js';");
    expect(postViewSrc).toContain("import '../components/post-detail-content.js';");
    expect(detailSrc).toContain("import { toPresentationModel } from '../services/post-presentation.js';");
    expect(detailSrc).toContain("@property({ type: String }) surface: 'detail' | 'lightbox' = 'detail';");
    expect(detailSrc).toContain("const presentation = toPresentationModel(p, {");
    expect(detailSrc).toContain("const recommendationsMode = this.surface === 'lightbox' ? 'list' : 'grid';");
    expect(detailSrc).toContain("const engagementStandalone = this.surface !== 'lightbox';");
    expect(lightboxSrc).toContain('<post-detail-content');
    expect(lightboxSrc).toContain('surface="lightbox"');
    expect(postViewSrc).toContain('<post-detail-content');
    expect(postViewSrc).not.toContain('recommendationsMode=');
    expect(postViewSrc).not.toContain('engagementStandalone');
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
