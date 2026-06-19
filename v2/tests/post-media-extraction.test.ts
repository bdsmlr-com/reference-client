import { describe, expect, it } from 'vitest';
import {
  extractMedia,
  getOrderedContentBlocks,
  type MediaInfo,
  type NormalizedContentBlock,
} from '../src/types/post.js';

function mediaUrls(media: MediaInfo): string[] {
  return (media.items || []).map((item) => item.original?.url || '');
}

function blockKinds(blocks: NormalizedContentBlock[]): string[] {
  return blocks.map((block) => block.kind);
}

describe('post media extraction', () => {
  it('uses mediaRepresentation for still image posts', () => {
    const media = extractMedia({
      id: 1,
      type: 2,
      body: 'Caption',
      content: {
        html: '<p>Caption</p>',
      },
      contentBlocks: [
        { htmlBlock: { html: '<p>Caption</p>' } },
        { mediaBlock: {} },
      ],
      mediaRepresentation: {
        kind: 'ORIGINAL',
        items: [
          {
            kind: 'IMAGE',
            original: { url: 'https://cdn.example.com/photo.jpg' },
            preview: { url: 'https://cdn.example.com/photo-preview.jpg' },
          },
        ],
      },
    } as any);

    expect(media.type).toBe('image');
    expect(media.url).toBe('https://cdn.example.com/photo.jpg');
    expect(media.previewUrl).toBe('https://cdn.example.com/photo-preview.jpg');
    expect(mediaUrls(media)).toEqual(['https://cdn.example.com/photo.jpg']);
  });

  it('prefers the first animated-video alternate while retaining original and poster roles', () => {
    const media = extractMedia({
      id: 2,
      type: 2,
      contentBlocks: [{ mediaBlock: {} }],
      mediaRepresentation: {
        kind: 'ANIMATED_VIDEO',
        items: [
          {
            kind: 'IMAGE',
            original: { url: 'https://cdn.example.com/foo.gif?e=1&t=2' },
            alternates: [
              { url: 'https://cdn.example.com/foo.mp4?e=1&t=2', mimeType: 'video/mp4' },
            ],
            preview: { url: 'https://cdn.example.com/foo-preview.webp' },
            poster: { url: 'https://media.example.com/foo-poster.webp' },
          },
        ],
      },
    } as any);

    expect(media.type).toBe('video');
    expect(media.videoUrl).toBe('https://cdn.example.com/foo.mp4?e=1&t=2');
    expect(media.originalUrl).toBe('https://cdn.example.com/foo.gif?e=1&t=2');
    expect(media.posterUrl).toBe('https://media.example.com/foo-poster.webp');
    expect(media.previewUrl).toBe('https://cdn.example.com/foo-preview.webp');
    expect(media.representationKind).toBe('ANIMATED_VIDEO');
  });

  it('falls back to the original image when animated-video alternates are absent', () => {
    const media = extractMedia({
      id: 3,
      type: 2,
      contentBlocks: [{ mediaBlock: {} }],
      mediaRepresentation: {
        kind: 'ANIMATED_VIDEO',
        items: [
          {
            kind: 'IMAGE',
            original: { url: 'https://cdn.example.com/foo.gif?e=1&t=2' },
          },
        ],
      },
    } as any);

    expect(media.type).toBe('image');
    expect(media.url).toBe('https://cdn.example.com/foo.gif?e=1&t=2');
    expect(media.videoUrl).toBeUndefined();
  });

  it('preserves media item order from the representation for galleries', () => {
    const media = extractMedia({
      id: 4,
      type: 2,
      contentBlocks: [{ mediaBlock: {} }],
      mediaRepresentation: {
        kind: 'ORIGINAL',
        items: [
          { kind: 'IMAGE', original: { url: 'https://cdn.example.com/a.jpg' } },
          { kind: 'IMAGE', original: { url: 'https://cdn.example.com/b.jpg' } },
          { kind: 'IMAGE', original: { url: 'https://cdn.example.com/c.jpg' } },
        ],
      },
    } as any);

    expect(mediaUrls(media)).toEqual([
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/b.jpg',
      'https://cdn.example.com/c.jpg',
    ]);
  });

  it('uses ordered contentBlocks as the authoritative body composition contract', () => {
    const blocks = getOrderedContentBlocks({
      id: 5,
      type: 2,
      content: {
        html: '<p>legacy body should not collapse ordered blocks</p>',
      },
      contentBlocks: [
        { htmlBlock: { html: '<p>Intro</p>' } },
        { mediaBlock: {} },
        { htmlBlock: { html: '<p>Outro</p>' } },
      ],
      mediaRepresentation: {
        kind: 'ORIGINAL',
        items: [{ kind: 'IMAGE', original: { url: 'https://cdn.example.com/demo.jpg' } }],
      },
    } as any);

    expect(blockKinds(blocks)).toEqual(['html', 'media', 'html']);
    expect(blocks[0]).toMatchObject({ kind: 'html', html: '<p>Intro</p>' });
    expect(blocks[1]).toMatchObject({ kind: 'media' });
    expect(blocks[2]).toMatchObject({ kind: 'html', html: '<p>Outro</p>' });
  });

  it('does not synthesize media items when mediaRepresentation is absent', () => {
    const media = extractMedia({
      id: 6,
      type: 2,
      content: {
        html: '<p>body without representation</p>',
      },
    } as any);

    expect(media.type).toBe('none');
    expect(media.url).toBeUndefined();
    expect(mediaUrls(media)).toEqual([]);
  });

  it('synthesizes ordered blocks from fallback text fields when contentBlocks are absent', () => {
    const blocks = getOrderedContentBlocks({
      id: 7,
      type: 1,
      body: 'Legacy body text',
      content: {
        html: '<p>Legacy body text</p>',
        text: 'Legacy body text',
      },
    } as any);

    expect(blocks).toEqual([{ kind: 'html', html: '<p>Legacy body text</p>' }]);
  });

  it('synthesizes a title text block when degraded payloads omit content blocks', () => {
    const blocks = getOrderedContentBlocks({
      id: 8,
      type: 3,
      body: '',
      content: {
        title: 'Messaging Infrastructure and Subscription Launch',
        html: null,
        text: null,
      },
      mediaRepresentation: {
        kind: 'NONE',
        items: [],
      },
    } as any);

    expect(blocks).toEqual([{ kind: 'text', text: 'Messaging Infrastructure and Subscription Launch' }]);
  });


  it('recognizes numeric media representation enums for native video posts', () => {
    const media = extractMedia({
      id: 870855951,
      type: 3,
      mediaRepresentation: {
        kind: 2,
        items: [
          {
            kind: 2,
            alternates: [],
            original: { url: 'https://ocdn012.bdsmlr.com/uploads/videos/demo.mp4', mimeType: 'video/mp4' },
            poster: null,
            preview: null,
          },
          {
            kind: 1,
            alternates: [],
            original: { url: 'https://ocdn012.bdsmlr.com/uploads/videos/demo.jpg', mimeType: 'image/jpeg' },
            poster: null,
            preview: null,
          },
        ],
      },
    } as any);

    expect(media.type).toBe('video');
    expect(media.videoUrl).toBe('https://ocdn012.bdsmlr.com/uploads/videos/demo.mp4');
    expect(media.url).toBe('https://ocdn012.bdsmlr.com/uploads/videos/demo.jpg');
    expect(media.representationKind).toBe('ORIGINAL');
  });

  it('recognizes numeric animated-video enums and uses the first mp4 alternate', () => {
    const media = extractMedia({
      id: 283656892,
      type: 2,
      contentBlocks: [{ mediaBlock: {} }],
      mediaRepresentation: {
        kind: 3,
        items: [
          {
            kind: 1,
            original: { url: 'https://ocdn012.bdsmlr.com/uploads/photos/demo.gif' },
            alternates: [
              { url: 'https://ocdn012.bdsmlr.com/uploads/photos/demo.mp4', mimeType: 'video/mp4' },
            ],
          },
        ],
      },
    } as any);

    expect(media.type).toBe('video');
    expect(media.videoUrl).toBe('https://ocdn012.bdsmlr.com/uploads/photos/demo.mp4');
    expect(media.url).toBe('https://ocdn012.bdsmlr.com/uploads/photos/demo.gif');
    expect(media.representationKind).toBe('ANIMATED_VIDEO');
  });

});
