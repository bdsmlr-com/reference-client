import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toS3Scheme, resolveMediaUrl, isAnimation, isNativeVideo, toOriginFallbackUrl, probeNextBucket, resolvePostDetailMediaUrl } from '../src/services/media-resolver.js';
import { CONFIG, FEATURE_FLAGS } from '../src/config.js';
import { BUCKET_LIST } from '../src/services/media-resolver.js';

describe('Media Resolver', () => {
  class MockImageElement {
    src = '';
  }

  class MockVideoElement {
    src = '';
    load() {}
    play() { return Promise.resolve(); }
  }

  class MockSourceElement {
    src = '';
    parentElement: MockVideoElement | null = null;
  }

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('window', { location: { search: '' } });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal('HTMLImageElement', MockImageElement as any);
    vi.stubGlobal('HTMLVideoElement', MockVideoElement as any);
    vi.stubGlobal('HTMLSourceElement', MockSourceElement as any);
    // Default to staging-like config
    CONFIG.imgproxyMode = 'unsafe';
    CONFIG.mediaProxyBase = 'https://imgproxy.i.bdsmlr.com';
    FEATURE_FLAGS.media_format_by_surface = { 'post-detail': 'raw' };
  });

  it('supports staging fixed host media.i for alias URLs', () => {
    CONFIG.imgproxyMode = 'fixed';
    CONFIG.mediaProxyBase = 'https://media.i.bdsmlr.com';
    const url = resolveMediaUrl('/uploads/foo.jpg', 'feed');
    expect(url).toContain('media.i.bdsmlr.com/masonry/s3://ocdn012.bdsmlr.com/uploads/foo.jpg');
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

    it('should unwrap an ergonomic s3 URL', () => {
      const ergonomicS3 = 'https://media.i.bdsmlr.com/gutter/s3://ocdn012.bdsmlr.com/uploads/foo.gif?e=123&t=abc';
      const [s3Url] = toS3Scheme(ergonomicS3);
      expect(s3Url).toBe('s3://ocdn012.bdsmlr.com/uploads/foo.gif');
    });
  });

  describe('resolvePostDetailMediaUrl', () => {
    it('uses the raw alias for signed s3-backed detail media', () => {
      CONFIG.imgproxyMode = 'fixed';
      CONFIG.mediaProxyBase = 'https://media.i.bdsmlr.com';
      const src = 'https://ocdn012.bdsmlr.com/uploads/photos/2022/04/10603709/bdsmlr-10603709-T81lsQVXjf.jpg?e=1781533847&t=2EHzapbTks7Eo12VKQQU-mFAzx3J0WLTv-DEtah6DZQ';
      const url = resolvePostDetailMediaUrl(src);
      expect(url).toBe('https://media.i.bdsmlr.com/raw/s3://ocdn012.bdsmlr.com/uploads/photos/2022/04/10603709/bdsmlr-10603709-T81lsQVXjf.jpg?e=1781533847&t=2EHzapbTks7Eo12VKQQU-mFAzx3J0WLTv-DEtah6DZQ');
    });

    it('keeps non-detail resizing behavior separate from the raw detail helper', () => {
      CONFIG.imgproxyMode = 'fixed';
      CONFIG.mediaProxyBase = 'https://media.i.bdsmlr.com';
      const src = 'https://ocdn012.bdsmlr.com/uploads/photos/2022/04/10603709/bdsmlr-10603709-T81lsQVXjf.jpg?e=1781533847&t=2EHzapbTks7Eo12VKQQU-mFAzx3J0WLTv-DEtah6DZQ';
      expect(resolveMediaUrl(src, 'feed')).toContain('/masonry/s3://');
      expect(resolvePostDetailMediaUrl(src)).toContain('/raw/s3://');
    });
  });

  describe('resolveMediaUrl', () => {
    it('can force raw alias resolution for card surfaces via feature flag', () => {
      CONFIG.imgproxyMode = 'fixed';
      CONFIG.mediaProxyBase = 'https://media.bdsmlr.com';
      FEATURE_FLAGS.media_format_by_surface = { card: 'raw' };

      const url = resolveMediaUrl('/uploads/foo.jpg', 'card');

      expect(url).toBe('https://media.bdsmlr.com/raw/s3://ocdn012.bdsmlr.com/uploads/foo.jpg');
    });

    it('can force raw alias resolution for lightbox surfaces via feature flag', () => {
      CONFIG.imgproxyMode = 'fixed';
      CONFIG.mediaProxyBase = 'https://media.bdsmlr.com';
      FEATURE_FLAGS.media_format_by_surface = { lightbox: 'raw' };

      const url = resolveMediaUrl('/uploads/foo.jpg', 'lightbox');

      expect(url).toBe('https://media.bdsmlr.com/raw/s3://ocdn012.bdsmlr.com/uploads/foo.jpg');
    });

    it('keeps animated feed media as raw gif/webp when raw feed mode is enabled', () => {
      CONFIG.imgproxyMode = 'fixed';
      CONFIG.mediaProxyBase = 'https://media.bdsmlr.com';
      FEATURE_FLAGS.media_format_by_surface = { feed: 'raw' };
      const src = 'https://ocdn012.bdsmlr.com/uploads/foo.gif?e=123&t=abc';

      const url = resolveMediaUrl(src, 'feed');

      expect(url).toBe('https://media.bdsmlr.com/raw/s3://ocdn012.bdsmlr.com/uploads/foo.gif?e=123&t=abc');
      expect(url).not.toContain('format:mp4');
      expect(url).not.toContain('/masonry/s3://');
    });
    it('should generate an unsafe URL in staging mode', () => {
      CONFIG.imgproxyMode = 'unsafe';
      const url = resolveMediaUrl('/uploads/foo.jpg', 'gallery-grid');
      expect(url).toContain('imgproxy.i.bdsmlr.com/unsafe/g:sm/rs:fill:400:400/plain/s3://ocdn012.bdsmlr.com/uploads/foo.jpg');
    });

    it('should strip signature params for unsafe/imgproxy URLs', () => {
      CONFIG.imgproxyMode = 'unsafe';
      const src = 'https://ocdn012.bdsmlr.com/uploads/foo.jpg?e=123&t=abc&cb=999&x=1';
      const url = resolveMediaUrl(src, 'gallery-grid');
      expect(url).toContain('imgproxy.i.bdsmlr.com/unsafe/');
      expect(url).toContain('x=1');
      expect(url).not.toContain('e=123');
      expect(url).not.toContain('t=abc');
      expect(url).not.toContain('cb=999');
    });

    it('should bypass imgproxy for native mp4 URLs in unsafe mode', () => {
      CONFIG.imgproxyMode = 'unsafe';
      const src = 'https://ocdn012.bdsmlr.com/uploads/videos/2019/03/11363/bdsmlr-11363-JigAQ6osU0.mp4?e=123&t=abc&cb=999';
      const url = resolveMediaUrl(src, 'lightbox');
      expect(url).toBe(src);
      expect(url).not.toContain('imgproxy.i.bdsmlr.com/unsafe/');
    });

    it('should generate a fixed (ergonomic) URL in production mode', () => {
      CONFIG.imgproxyMode = 'fixed';
      CONFIG.mediaProxyBase = 'https://media.bdsmlr.com';
      const url = resolveMediaUrl('/uploads/foo.jpg', 'lightbox');
      // Should map lightbox-like detail surfaces to the canonical detail alias
      expect(url).toContain('media.bdsmlr.com/detail/s3://ocdn012.bdsmlr.com/uploads/foo.jpg');
    });

    it('keeps post-detail on the raw alias by default in fixed mode', () => {
      CONFIG.imgproxyMode = 'fixed';
      CONFIG.mediaProxyBase = 'https://media.bdsmlr.com';
      const url = resolveMediaUrl('/uploads/foo.jpg', 'post-detail');
      expect(url).toContain('media.bdsmlr.com/raw/s3://ocdn012.bdsmlr.com/uploads/foo.jpg');
    });

    it('should re-alias ergonomic s3 media URLs for lightbox', () => {
      CONFIG.imgproxyMode = 'fixed';
      CONFIG.mediaProxyBase = 'https://media.bdsmlr.com';
      const src = 'https://media.i.bdsmlr.com/gutter/s3://ocdn012.bdsmlr.com/uploads/foo.gif?e=123&t=abc';
      const url = resolveMediaUrl(src, 'lightbox');
      expect(url).toContain('media.bdsmlr.com/detail/s3://ocdn012.bdsmlr.com/uploads/foo.gif?e=123&t=abc');
    });

    it('should respect admin media_mode override', () => {
      // Mock URL search params
      const spy = vi.spyOn(URLSearchParams.prototype, 'get');
      spy.mockImplementation((key: string) => {
        if (key === 'media_mode') return 'origin';
        return null;
      });
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => 'true'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      });

      const url = resolveMediaUrl('https://cdn101.bdsmlr.com/uploads/foo.jpg', 'feed');
      expect(url).toBe('https://cdn101.bdsmlr.com/uploads/foo.jpg');
      
      spy.mockRestore();
    });

    it('preserves already-transformed pixelated proxy URLs instead of re-deriving a clear variant', () => {
      CONFIG.imgproxyMode = 'unsafe';
      const src = 'https://imgproxy.i.bdsmlr.com/unsafe/g:sm/rs:fit:600:0/pix:24/plain/s3://ocdn012.bdsmlr.com/uploads/foo.jpg';
      const url = resolveMediaUrl(src, 'gallery-grid');
      expect(url).toBe(src);
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

    it('should unwrap and detect animations in proxied URLs', () => {
      const proxied = 'https://imgproxy.i.bdsmlr.com/unsafe/rs:fill:300:300/plain/s3://ocdn012.bdsmlr.com/foo.gif?e=123';
      expect(isAnimation(proxied)).toBe(true);
    });
  });

  describe('isNativeVideo', () => {
    it('should detect native video extensions', () => {
      expect(isNativeVideo('/foo.mp4')).toBe(true);
      expect(isNativeVideo('/foo.MOV')).toBe(true);
      expect(isNativeVideo('/foo.webp')).toBe(false);
    });
  });

  describe('toOriginFallbackUrl', () => {
    it('should convert media proxy URL to direct origin URL preserving signature params', () => {
      const proxied = 'https://media.i.bdsmlr.com/fit:1200:0/ocdn012.bdsmlr.com/uploads/photos/2022/05/1004843/bdsmlr-1004843-KPLXZD8diD.gif?e=1774200450&t=BZ3y2EbrPv-1ftNvtr7IEcXx2hKksgeqaKipo2lMs5M&cb=1774114050';
      expect(toOriginFallbackUrl(proxied)).toBe(
        'https://ocdn012.bdsmlr.com/uploads/photos/2022/05/1004843/bdsmlr-1004843-KPLXZD8diD.gif?e=1774200450&t=BZ3y2EbrPv-1ftNvtr7IEcXx2hKksgeqaKipo2lMs5M&cb=1774114050'
      );
    });
  });

  describe('probeNextBucket', () => {
    it('should not include reblogme bucket in failover list', () => {
      expect(BUCKET_LIST).not.toContain('cdn002.reblogme.com');
    });

    it('should not probe ergonomic s3 URLs when the bucket list is intentionally single-host', () => {
      const img = new MockImageElement();
      img.src = 'https://media.i.bdsmlr.com/gutter/s3://ocdn012.bdsmlr.com/uploads/photos/2023/08/11289205/bdsmlr-11289205-s3pdSudIvT.gif?e=1774206957&t=hqHlN9H94QRTWcWH9XdFxd9tKxsKGaTjW6m6WYjTPzY&cb=1774120557';

      const didProbe = probeNextBucket(img as any);

      expect(didProbe).toBe(false);
      expect(img.src).toBe(
        'https://media.i.bdsmlr.com/gutter/s3://ocdn012.bdsmlr.com/uploads/photos/2023/08/11289205/bdsmlr-11289205-s3pdSudIvT.gif?e=1774206957&t=hqHlN9H94QRTWcWH9XdFxd9tKxsKGaTjW6m6WYjTPzY&cb=1774120557'
      );
    });

    it('should normalize unknown legacy buckets back to the canonical host', () => {
      const img = new MockImageElement();
      img.src = 'https://media.i.bdsmlr.com/gutter/s3://cdn013.bdsmlr.com/uploads/photos/2023/08/11289205/bdsmlr-11289205-s3pdSudIvT.gif?e=1&t=2';

      const didProbe = probeNextBucket(img as any);

      expect(didProbe).toBe(true);
      expect(img.src).toContain('ocdn012.bdsmlr.com');
    });
  });
});
