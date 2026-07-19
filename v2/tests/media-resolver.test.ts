import { describe, it, expect } from 'vitest';
import { resolveMediaUrl, isAnimation, isNativeVideo, isNativeAudio } from '../src/services/media-resolver.js';

describe('media resolver', () => {
  it('passes absolute URLs through unchanged', () => {
    const src = 'https://ocdn012.bdsmlr.com/uploads/demo.jpg?e=1&t=abc';
    expect(resolveMediaUrl(src, 'feed')).toBe(src);
    expect(resolveMediaUrl(src, 'post-detail')).toBe(src);
  });

  it('does not synthesize proxy hosts for relative inputs', () => {
    expect(resolveMediaUrl('/uploads/demo.jpg', 'feed')).toBe('/uploads/demo.jpg');
    expect(resolveMediaUrl('uploads/demo.jpg', 'detail')).toBe('uploads/demo.jpg');
    expect(resolveMediaUrl('s3://ocdn012.bdsmlr.com/uploads/demo.jpg', 'lightbox')).toBe('s3://ocdn012.bdsmlr.com/uploads/demo.jpg');
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
