import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('search regression and tag visibility', () => {
  it('guards against stale async search responses overwriting newer query state', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain('private activeSearchToken = 0;');
    expect(src).toContain('private currentSearchSignature =');
    expect(src).toContain('const searchToken = ++this.activeSearchToken;');
    expect(src).toContain('if (searchToken !== this.activeSearchToken || signature !== this.currentSearchSignature)');
  });

  it('extracts fallback tags from body/html when API tags are missing', () => {
    const src = readFileSync(join(ROOT, 'types/post.ts'), 'utf8');

    expect(src).toContain('export function extractRenderableTags(post: Post): string[]');
    expect(src).toContain("const matches = text.match(/#(");
  });

  it('shows tag count on gallery/search cards and tag chips on detail views', () => {
    const gridSrc = readFileSync(join(ROOT, 'components/activity-grid.ts'), 'utf8');
    const detailSrc = readFileSync(join(ROOT, 'components/post-detail-content.ts'), 'utf8');

    expect(gridSrc).toContain('🏷️');
    expect(gridSrc).toContain('extractRenderableTags');
    expect(detailSrc).toContain('extractRenderableTags');
    expect(detailSrc).toContain('class="post-tags"');
  });
});
