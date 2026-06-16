import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveLink } from '../src/services/link-resolver.js';

describe('legacy post link', () => {
  it('adds a legacy post permalink context', () => {
    const legacy = resolveLink('post_legacy_permalink', { blog: 'NonNudeCuties', postId: 484255891 });
    expect(legacy.href).toBe('https://NonNudeCuties.bdsmlr.com/post/484255891');
    expect(legacy.target).toBe('_blank');
    expect(legacy.icon).toBe('🗿↗');
  });

  it('renders the legacy permalink in post detail identity chrome', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/post-detail-content.ts'), 'utf8');
    expect(src).toContain('legacyPostPermalink');
    expect(src).toContain("'🗿↗'");
  });
});
