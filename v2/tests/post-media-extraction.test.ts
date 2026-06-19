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
  it('uses mediaRepresentation for still image posts instead of legacy files', () => {
    const media = extractMedia({
      id: 1,
      type: 2,
      body: 'Caption',
      content: {
        html: '<p>Caption</p>',
        files: ['https://legacy.example.com/ignored.jpg'],
        thumbnail: 'https://legacy.example.com/ignored-thumb.jpg',
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
});
