import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('affinity tag cloud', () => {
  it('offers radio-style interaction and horizon chip groups', () => {
    const src = readFileSync(join(ROOT, 'components/affinity-tag-cloud.ts'), 'utf8');

    expect(src).toContain("@property({ type: String }) interactionMode: 'both' | 'likes' | 'reblogs' = 'both';");
    expect(src).toContain("@property({ type: String }) horizon: 'recent' | 'all' = 'recent';");
    expect(src).toContain("this.renderChipGroup('Interaction'");
    expect(src).toContain("this.renderChipGroup('Window'");
    expect(src).toContain("['both', 'likes', 'reblogs']");
    expect(src).toContain("['recent', 'all']");
    expect(src).toContain('role="radiogroup"');
    expect(src).toContain('aria-checked=${selected}');
  });
});
