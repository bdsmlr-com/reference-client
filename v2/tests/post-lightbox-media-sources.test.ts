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
    _media: { type: 'video' },
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
    // Pathological case: @ropebunnyinlace / 644805038 via @Tyrant-Den / 644970242
    const post = makePost({
      deletedAtUnix: 1710000000,
      content: { files: ['https://ocdn012.bdsmlr.com/uploads/videos/dead.mp4'] },
      _media: {
        type: 'video',
        url: 'https://ocdn012.bdsmlr.com/uploads/photos/still-preview.webp',
        videoUrl: 'https://ocdn012.bdsmlr.com/uploads/videos/dead.mp4',
      },
    });

    expect(buildLightboxMediaSources(post)).toEqual([
      'https://ocdn012.bdsmlr.com/uploads/photos/still-preview.webp',
    ]);
  });

  it('keeps file list for non-deleted posts', () => {
    const post = makePost({
      content: { files: ['https://ocdn012.bdsmlr.com/uploads/videos/live.mp4'] },
      _media: {
        type: 'video',
        url: 'https://ocdn012.bdsmlr.com/uploads/photos/live-preview.webp',
        videoUrl: 'https://ocdn012.bdsmlr.com/uploads/videos/live.mp4',
      },
    });

    expect(buildLightboxMediaSources(post)).toEqual([
      'https://ocdn012.bdsmlr.com/uploads/videos/live.mp4',
    ]);
  });
});
