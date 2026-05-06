import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/pages/view-search.ts');

describe('search query guide', () => {
  it('replaces the old boolean hint with an expandable syntax guide and example links', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain('Search syntax');
    expect(src).toContain('target="_blank"');
    expect(src).toContain('post:43110814');
    expect(src).toContain('blog:');
    expect(src).toContain('tag:"best served hot"');
    expect(src).toContain('media:image');
    expect(src).toContain('when:2024-12');
    expect(src).not.toContain('Boolean: <code>tag1 tag2</code> = AND');
  });
});
