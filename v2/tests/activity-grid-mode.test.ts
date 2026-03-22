import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('gallery mode wiring', () => {
  it('activity-grid supports explicit grid/masonry mode', () => {
    const src = readFileSync(join(ROOT, 'components/activity-grid.ts'), 'utf8');

    expect(src).toContain("@property({ type: String, reflect: true }) mode: 'grid' | 'masonry' = 'grid';");
    expect(src).toContain(":host([mode='masonry'])");
  });

  it('archive and search views pass persisted gallery mode into activity-grid', () => {
    const archiveSrc = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');
    const searchSrc = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(archiveSrc).toContain('.mode=${this.galleryMode}');
    expect(searchSrc).toContain('.mode=${this.galleryMode}');
    expect(archiveSrc).toContain("getGalleryMode()")
    expect(searchSrc).toContain("getGalleryMode()")
  });
});
