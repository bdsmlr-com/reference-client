import { describe, it, expect } from 'vitest';
import * as mediaResolver from '../src/services/media-resolver.js';

const {
  resolveMediaUrl,
  resolvePostDetailMediaUrl,
  isAnimation,
  isNativeVideo,
  isNativeAudio,
} = mediaResolver;

describe('media resolver', () => {
  it('passes absolute origin URLs through unchanged for all render types', () => {
    const src = 'https://ocdn012.bdsmlr.com/uploads/demo.jpg?e=1&t=abc';
    const renderTypes = ['card', 'masonry', 'detail', 'poster', 'gallery-grid', 'gallery-masonry', 'feed', 'lightbox', 'post-detail', 'gutter'] as const;

    for (const renderType of renderTypes) {
      expect(resolveMediaUrl(src, renderType)).toBe(src);
      expect(resolvePostDetailMediaUrl(src)).toBe(src);
    }
  });

  it('normalizes legacy proxy-host URLs to direct origin fallback URLs in compat helpers', () => {
    const legacyProxyUrl =
      'https://imgproxy.i.bdsmlr.com/unsafe/g:sm/rs:fill:300:300/plain/s3://ocdn012.bdsmlr.com/uploads/demo.jpg?e=1&t=abc';

    expect((mediaResolver as any).toOriginFallbackUrl(legacyProxyUrl)).toBe(
      'https://ocdn012.bdsmlr.com/uploads/demo.jpg?e=1&t=abc',
    );
    expect((mediaResolver as any).toOriginFallbackUrl('/uploads/demo.jpg')).toBe(
      'https://ocdn012.bdsmlr.com/uploads/demo.jpg',
    );
  });

  it('does not synthesize proxy hosts for relative inputs', () => {
    expect(resolveMediaUrl('/uploads/demo.jpg', 'feed')).toBe('/uploads/demo.jpg');
    expect(resolveMediaUrl('uploads/demo.jpg', 'detail')).toBe('uploads/demo.jpg');
    expect(resolveMediaUrl('s3://ocdn012.bdsmlr.com/uploads/demo.jpg', 'lightbox')).toBe('s3://ocdn012.bdsmlr.com/uploads/demo.jpg');
  });

  it('keeps probeNextBucket inert', () => {
    expect((mediaResolver as any).probeNextBucket({} as HTMLElement)).toBe(false);
  });

  it('detects animations and native video/audio by path only', () => {
    expect(isAnimation('https://cdn.example.com/foo.gif?e=1')).toBe(true);
    expect(isAnimation('https://cdn.example.com/foo.webp')).toBe(true);
    expect(isAnimation('https://cdn.example.com/foo.jpg')).toBe(false);

    expect(isNativeVideo('https://cdn.example.com/foo.mp4')).toBe(true);
    expect(isNativeVideo('https://cdn.example.com/foo.mov')).toBe(true);
    expect(isNativeVideo('https://cdn.example.com/foo.gif')).toBe(false);

    expect(isNativeAudio('https://cdn.example.com/foo.mp3')).toBe(true);
    expect(isNativeAudio('https://cdn.example.com/foo.aac')).toBe(true);
    expect(isNativeAudio('https://cdn.example.com/foo.jpg')).toBe(false);
  });
});
