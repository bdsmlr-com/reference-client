import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('video media url preference', () => {
  it('exposes a shared helper that prefers videoUrl for video media', () => {
    const src = readFileSync(join(ROOT, 'types/post.ts'), 'utf8');

    expect(src).toContain('export function resolvePrimaryMediaUrl(media: MediaInfo | undefined): string');
    expect(src).toContain("if (media.type === 'video') return media.videoUrl || media.url || '';\n");
  });

  it('routes shared card-like surfaces through the shared primary media helper', () => {
    const files = [
      'components/post-card.ts',
      'components/activity-grid.ts',
      'components/search-group-card.ts',
      'components/blog-list.ts',
      'components/post-recommendations.ts',
    ];

    for (const rel of files) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      expect(src).toContain("resolvePrimaryMediaUrl(");
      expect(src).not.toContain('media.url || media.videoUrl || media.audioUrl');
      expect(src).not.toContain('h._media?.url || h._media?.videoUrl');
    }
  });
});
