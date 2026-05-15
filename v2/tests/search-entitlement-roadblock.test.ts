import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/pages/view-search.ts');

describe('search entitlement roadblock', () => {
  it('intercepts blocked search results and opens the local roadblock modal instead of bubbling navigation', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain('if (this.isEntitlementRoadblock(post)) {');
    expect(src).toContain('this.roadblockPost = post;');
    expect(src).toContain('return;');
    expect(src).toContain("post.authorization?.navigation === 'denied'");
    expect(src).toContain('return post.id == null;');
  });

  it('renders feed-specific roadblock copy for deeper search dithering', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain('Search preview limited');
    expect(src).toContain('Deeper search is dithered for this blog');
    expect(src).toContain('search-depth browsing limit');
    expect(src).toContain('without pixelation and unlock direct navigation again');
  });
});
