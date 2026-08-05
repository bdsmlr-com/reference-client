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

  it('activity grid still shows the blog chip on post-context recommendation cards', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/activity-grid.ts'), 'utf8');

    expect(src).toContain("this.page === 'post'");
  });

  it('uses an explicit state pane and labels the inline route action Explore perspectives', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("kind: 'loading'");
    expect(src).toContain("kind: 'unavailable'");
    expect(src).toContain("kind: 'temporary-failure'");
    expect(src).toContain('Explore perspectives');
    expect(src).not.toContain('Count: 0');
  });
});
