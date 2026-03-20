import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toS3Scheme, resolveMediaUrl, isAnimation, BUCKET_LIST } from './media-resolver.js';
import { CONFIG } from '../config.js';

describe('Media Resolver', () => {
  beforeEach(() => {
    vi.resetModules();
    // Default to staging-like config
    CONFIG.imgproxyMode = 'unsafe';
    CONFIG.mediaProxyBase = 'https://imgproxy.i.bdsmlr.com';
  });

  describe('toS3Scheme', () => {
    it('should map a standard CDN URL to s3 scheme', () => {
      const [s3Url] = toS3Scheme('https://cdn101.bdsmlr.com/uploads/foo.jpg');
      expect(s3Url).toBe('s3://cdn101.bdsmlr.com/uploads/foo.jpg');
    });

    it('should normalize cdn012 to ocdn012', () => {
      const [s3Url] = toS3Scheme('https://cdn012.bdsmlr.com/uploads/foo.jpg');
      expect(s3Url).toBe('s3://ocdn012.bdsmlr.com/uploads/foo.jpg');
    });

    it('should unwrap an already-proxied URL', () => {
      const proxied = 'https://imgproxy.i.bdsmlr.com/unsafe/rs:fill:300:300/plain/s3://ocdn012.bdsmlr.com/uploads/foo.jpg?e=123&t=abc';
      const [s3Url] = toS3Scheme(proxied);
      expect(s3Url).toBe('s3://ocdn012.bdsmlr.com/uploads/foo.jpg');
    });

    it('should unwrap an ergonomic URL', () => {
      const ergonomic = 'https://media.i.bdsmlr.com/feed/ocdn012.bdsmlr.com/uploads/foo.jpg?e=123&t=abc';
      const [s3Url] = toS3Scheme(ergonomic);
      expect(s3Url).toBe('s3://ocdn012.bdsmlr.com/uploads/foo.jpg');
    });
  });

  describe('resolveMediaUrl', () => {
    it('should generate an unsafe URL in staging mode', () => {
      CONFIG.imgproxyMode = 'unsafe';
      const url = resolveMediaUrl('/uploads/foo.jpg', 'gallery-grid');
      expect(url).toContain('imgproxy.i.bdsmlr.com/unsafe/g:sm/rs:fill:300:300/plain/s3://ocdn012.bdsmlr.com/uploads/foo.jpg');
    });

    it('should generate a fixed (ergonomic) URL in production mode', () => {
      CONFIG.imgproxyMode = 'fixed';
      CONFIG.mediaProxyBase = 'https://media.bdsmlr.com';
      const url = resolveMediaUrl('/uploads/foo.jpg', 'lightbox');
      // Should map 'lightbox' render type to the 'lightbox' alias
      expect(url).toContain('media.bdsmlr.com/lightbox/s3://ocdn012.bdsmlr.com/uploads/foo.jpg');
    });

    it('should respect admin media_mode override', () => {
      // Mock URL search params
      const spy = vi.spyOn(URLSearchParams.prototype, 'get');
      spy.mockImplementation((key) => {
        if (key === 'admin') return 'true';
        if (key === 'media_mode') return 'origin';
        return null;
      });

      const url = resolveMediaUrl('https://cdn101.bdsmlr.com/uploads/foo.jpg', 'feed');
      expect(url).toBe('https://cdn101.bdsmlr.com/uploads/foo.jpg');
      
      spy.mockRestore();
    });
  });

  describe('isAnimation', () => {
    it('should detect gifs', () => {
      expect(isAnimation('/foo.gif')).toBe(true);
      expect(isAnimation('/foo.GIF')).toBe(true);
    });

    it('should detect webps', () => {
      expect(isAnimation('/foo.webp')).toBe(true);
    });

    it('should unwrapp and detect animations in proxied URLs', () => {
      const proxied = 'https://imgproxy.i.bdsmlr.com/unsafe/rs:fill:300:300/plain/s3://ocdn012.bdsmlr.com/foo.gif?e=123';
      expect(isAnimation(proxied)).toBe(true);
    });
  });
});
