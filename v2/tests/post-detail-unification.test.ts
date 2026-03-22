import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('post detail unification', () => {
  it('uses shared post-detail-content in both view-post and post-lightbox', () => {
    const lightboxSrc = readFileSync(join(ROOT, 'components/post-lightbox.ts'), 'utf8');
    const postViewSrc = readFileSync(join(ROOT, 'pages/view-post.ts'), 'utf8');

    expect(lightboxSrc).toContain("import './post-detail-content.js';");
    expect(postViewSrc).toContain("import '../components/post-detail-content.js';");
    expect(lightboxSrc).toContain('<post-detail-content');
    expect(postViewSrc).toContain('<post-detail-content');
  });
});
