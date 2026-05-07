import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/components/post-recommendations.ts');

describe('post recommendations presentation', () => {
  it('uses the shared post grid for in-page recommendation cards and hides unresolved names in the legacy list fallback', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("import './post-grid.js';");
    expect(src).toContain(".page=${'post'}");
    expect(src).toContain(".mode=${'grid'}");
    expect(src).not.toContain('presentation.identity.viaBlogLabel');
    expect(src).toContain("const blogLabel = `${h.blogName || h.originBlogName || ''}`.trim();");
  });
});
