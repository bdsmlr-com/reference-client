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
});

describe('blog list media descriptor flow', () => {
  it('uses the richer surface media descriptor instead of the flattened primary-url helper', () => {
    const src = readFileSync(join(ROOT, 'components/blog-list.ts'), 'utf8');

    expect(src).toContain("describePrimaryMediaForSurface(media, 'preview')");
    expect(src).toContain('.posterSrc=${mediaSource?.posterSrc}');
    expect(src).toContain('.alternateVideoSrc=${mediaSource?.alternateVideoSrc}');
    expect(src).toContain('.fallbackSrc=${mediaSource?.fallbackSrc}');
    expect(src).toContain('.forceImage=${mediaSource?.forceImage ?? false}');
    expect(src).not.toContain('resolvePrimaryMediaUrl(media)');
  });
});

describe('search group card media descriptor flow', () => {
  it('uses the richer surface media descriptor instead of the flattened primary-url helper', () => {
    const src = readFileSync(join(ROOT, 'components/search-group-card.ts'), 'utf8');

    expect(src).toContain("describePrimaryMediaForSurface(media, 'preview')");
    expect(src).toContain('.posterSrc=${mediaSource?.posterSrc}');
    expect(src).toContain('.alternateVideoSrc=${mediaSource?.alternateVideoSrc}');
    expect(src).toContain('.fallbackSrc=${mediaSource?.fallbackSrc}');
    expect(src).toContain('.forceImage=${mediaSource?.forceImage ?? false}');
    expect(src).not.toContain('resolvePrimaryMediaUrl(media)');
  });
});
