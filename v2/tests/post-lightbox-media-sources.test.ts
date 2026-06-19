import { describe, expect, it } from 'vitest';
import { buildLightboxMediaSources } from '../src/services/lightbox-media-sources.js';
import type { ProcessedPost } from '../src/types/post.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function makePost(overrides: Partial<ProcessedPost> = {}): ProcessedPost {
  return {
    id: 1,
    type: 3,
    content: {},
    _media: { type: 'video', items: [] },
    ...overrides,
  } as ProcessedPost;
}

describe('buildLightboxMediaSources', () => {
  it('post-card dispatches explicit provenance with post-select', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/post-card.ts'), 'utf8');
    expect(src).toContain('EventNames.POST_SELECT');
    expect(src).toContain('const from: PostRouteSource = this.page === \'post\' ? \'direct\' : this.page;');
    expect(src).toContain('detail: { post: this.post, from },');
  });

  it('falls back to preview URL for deleted posts with dead file URLs', () => {
    const post = makePost({
      deletedAtUnix: 1710000000,
      content: { files: ['https://ocdn012.bdsmlr.com/uploads/videos/dead.mp4'] },
      _media: {
        type: 'video',
        url: 'https://ocdn012.bdsmlr.com/uploads/photos/still-preview.webp',
        videoUrl: 'https://ocdn012.bdsmlr.com/uploads/videos/dead.mp4',
        items: [
          {
            kind: 'VIDEO',
            original: { url: 'https://ocdn012.bdsmlr.com/uploads/videos/dead.mp4' },
            poster: { url: 'https://ocdn012.bdsmlr.com/uploads/photos/still-preview.webp' },
          },
        ],
      },
    });

    expect(buildLightboxMediaSources(post)).toEqual([
      {
        kind: 'image',
        src: 'https://ocdn012.bdsmlr.com/uploads/photos/still-preview.webp',
        forceImage: true,
      },
    ]);
  });

  it('uses mediaRepresentation ordering instead of legacy file order', () => {
    const post = makePost({
      type: 2,
      content: { files: ['https://legacy.example.com/ignored.jpg'] },
      _media: {
        type: 'image',
        items: [
          { kind: 'IMAGE', original: { url: 'https://ocdn012.bdsmlr.com/uploads/photos/a.jpg' } },
          { kind: 'IMAGE', original: { url: 'https://ocdn012.bdsmlr.com/uploads/photos/b.jpg' } },
        ],
      },
    });

    expect(buildLightboxMediaSources(post)).toEqual([
      { kind: 'image', src: 'https://ocdn012.bdsmlr.com/uploads/photos/a.jpg', forceImage: true },
      { kind: 'image', src: 'https://ocdn012.bdsmlr.com/uploads/photos/b.jpg', forceImage: true },
    ]);
  });

  it('preserves video poster role for non-deleted posts', () => {
    const post = makePost({
      content: { files: ['https://ocdn012.bdsmlr.com/uploads/videos/live.mp4'] },
      _media: {
        type: 'video',
        url: 'https://ocdn012.bdsmlr.com/uploads/photos/live-preview.webp',
        videoUrl: 'https://ocdn012.bdsmlr.com/uploads/videos/live.mp4',
        items: [
          {
            kind: 'VIDEO',
            original: { url: 'https://ocdn012.bdsmlr.com/uploads/videos/live.mp4' },
            poster: { url: 'https://ocdn012.bdsmlr.com/uploads/photos/live-preview.webp' },
          },
        ],
      },
    });

    expect(buildLightboxMediaSources(post)).toEqual([
      {
        kind: 'video',
        src: 'https://ocdn012.bdsmlr.com/uploads/videos/live.mp4',
        posterSrc: 'https://ocdn012.bdsmlr.com/uploads/photos/live-preview.webp',
      },
    ]);
  });
});
