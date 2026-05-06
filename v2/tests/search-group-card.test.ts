import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/components/search-group-card.ts');

describe('search group card', () => {
  it('navigates grouped cards to the origin post page instead of a search drilldown', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("window.location.href = `/post/${this.originPostId}`;");
    expect(src).not.toContain('search-group-click');
    expect(src).not.toContain('q=post:');
  });
});
