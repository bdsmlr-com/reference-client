// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractMedia } from '../src/types/post.js';
import { MEDIA_PLACEHOLDER_ASPECT_RATIO } from '../src/types/ui-constants.js';
import '../src/components/media-renderer.js';
import '../src/components/post-feed-item.js';
import '../src/components/post-detail-content.js';

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function makePost(overrides: Record<string, unknown> = {}): any {
  const post = {
    id: 42,
    blogId: 7,
    blogName: 'alpha',
    originBlogId: 7,
    originBlogName: 'alpha',
    originPostId: 42,
    createdAtUnix: 1718400000,
    updatedAtUnix: 1718400000,
    likesCount: 0,
    reblogsCount: 0,
    commentsCount: 0,
    tags: [],
    type: 2,
    variant: 1,
    body: '',
    title: '',
    content: {
      html: '',
      text: '',
    },
    contentBlocks: [{ mediaBlock: {} }],
    mediaRepresentation: {
      kind: 'ORIGINAL',
      items: [
        {
          kind: 'IMAGE',
          original: { url: 'https://cdn.example.com/post.jpg' },
        },
      ],
    },
  };
  const merged = { ...post, ...overrides };
  merged._media = extractMedia(merged);
  return merged;
}

describe('post media rendering contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders still-image feed media from the representation contract', async () => {
    const el = document.createElement('post-feed-item') as any;
    el.post = makePost();
    el.page = 'feed';
    document.body.appendChild(el);

    await flush();
    await el.updateComplete;

    const renderer = el.shadowRoot?.querySelector('media-renderer') as any;
    expect(renderer).toBeTruthy();
    expect(renderer.src).toBe('https://cdn.example.com/post.jpg');
    expect(renderer.alternateVideoSrc || '').toBe('');
  });

  it('reserves feed space with a placeholder aspect ratio until image dimensions are known', async () => {
    const renderer = document.createElement('media-renderer') as any;
    renderer.src = 'https://cdn.example.com/tall.jpg';
    renderer.type = 'masonry';
    document.body.appendChild(renderer);

    await flush();
    await renderer.updateComplete;

    expect(renderer.hasAttribute('reserve-space')).toBe(true);
    expect(renderer.hasAttribute('intrinsic-known')).toBe(false);
    expect(renderer.style.getPropertyValue('--media-aspect-ratio')).toBe(String(MEDIA_PLACEHOLDER_ASPECT_RATIO));

    const img = renderer.shadowRoot?.querySelector('img') as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 1200 });
    Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 400 });
    Object.defineProperty(img, 'complete', { configurable: true, value: true });
    img.dispatchEvent(new Event('load'));
    await renderer.updateComplete;

    expect(renderer.hasAttribute('intrinsic-known')).toBe(true);
    expect(renderer.style.getPropertyValue('--media-aspect-ratio')).toBe('3');
  });

  it('does not reserve space for square grid card surfaces', async () => {
    const renderer = document.createElement('media-renderer') as any;
    renderer.src = 'https://cdn.example.com/tile.jpg';
    renderer.type = 'card';
    document.body.appendChild(renderer);

    await flush();
    await renderer.updateComplete;

    expect(renderer.hasAttribute('reserve-space')).toBe(false);
    expect(renderer.style.getPropertyValue('--media-aspect-ratio')).toBe('');
  });

  it('renders original video items through the video renderer', async () => {
    const el = document.createElement('post-feed-item') as any;
    el.post = makePost({
      type: 3,
      mediaRepresentation: {
        kind: 'ORIGINAL',
        items: [
          {
            kind: 'VIDEO',
            original: { url: 'https://cdn.example.com/movie.mp4' },
            poster: { url: 'https://cdn.example.com/movie-poster.webp' },
          },
        ],
      },
    });
    el.page = 'feed';
    document.body.appendChild(el);

    await flush();
    await el.updateComplete;

    const renderer = el.shadowRoot?.querySelector('media-renderer') as any;
    expect(renderer.src).toBe('https://cdn.example.com/movie.mp4');
    expect(renderer.posterSrc).toBe('https://cdn.example.com/movie-poster.webp');
    expect(renderer.shadowRoot?.querySelector('video')).toBeTruthy();
  });

  it('renders original audio items through audio controls', async () => {
    const el = document.createElement('post-detail-content') as any;
    el.post = makePost({
      type: 4,
      mediaRepresentation: {
        kind: 'ORIGINAL',
        items: [
          {
            kind: 'AUDIO',
            original: { url: 'https://cdn.example.com/audio.mp3' },
          },
        ],
      },
    });
    document.body.appendChild(el);

    await flush();
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('audio')?.getAttribute('src')).toBe('https://cdn.example.com/audio.mp3');
  });

  it('renders ordered html/media/html blocks in feed cards', async () => {
    const el = document.createElement('post-feed-item') as any;
    el.post = makePost({
      contentBlocks: [
        { htmlBlock: { html: '<p>Intro</p>' } },
        { mediaBlock: {} },
        { htmlBlock: { html: '<p>Outro</p>' } },
      ],
      content: {
        html: '<p>legacy collapsed body</p>',
      },
      mediaRepresentation: {
        kind: 'ORIGINAL',
        items: [{ kind: 'IMAGE', original: { url: 'https://cdn.example.com/ordered.jpg' } }],
      },
    });
    el.page = 'feed';
    document.body.appendChild(el);

    await flush();
    await el.updateComplete;

    const blocks = Array.from(el.shadowRoot?.querySelectorAll('[data-content-block]') || []).map((node) =>
      node.getAttribute('data-content-block')
    );
    expect(blocks).toEqual(['html', 'media', 'html']);
    expect(el.shadowRoot?.querySelectorAll('media-renderer')).toHaveLength(1);
  });

  it('renders gallery media in representation order on the detail route', async () => {
    const el = document.createElement('post-detail-content') as any;
    el.post = makePost({
      contentBlocks: [{ mediaBlock: {} }],
      mediaRepresentation: {
        kind: 'ORIGINAL',
        items: [
          { kind: 'IMAGE', original: { url: 'https://cdn.example.com/a.jpg' } },
          { kind: 'IMAGE', original: { url: 'https://cdn.example.com/b.jpg' } },
        ],
      },
    });
    document.body.appendChild(el);

    await flush();
    await el.updateComplete;

    const sources = Array.from(el.shadowRoot?.querySelectorAll('media-renderer') || []).map((node: any) => node.src);
    expect(sources).toEqual([
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/b.jpg',
    ]);
  });

  it('uses the preferred animated-video alternate when alternateVideoSrc is set', async () => {
    const el = document.createElement('post-feed-item') as any;
    el.post = makePost({
      mediaRepresentation: {
        kind: 'ANIMATED_VIDEO',
        items: [
          {
            kind: 'IMAGE',
            original: { url: 'https://ocdn012.bdsmlr.com/uploads/photos/live.gif?e=1&t=2' },
            alternates: [{ url: 'https://ocdn012.bdsmlr.com/uploads/photos/live.mp4?e=1&t=2' }],
            poster: { url: 'https://media.bdsmlr.com/poster/live.webp' },
          },
        ],
      },
    });
    el.page = 'feed';
    document.body.appendChild(el);

    await flush();
    await el.updateComplete;
    await flush();
    await el.updateComplete;

    const renderer = el.shadowRoot?.querySelector('media-renderer') as any;
    expect(renderer).toBeTruthy();
    expect(renderer.alternateVideoSrc).toBe('https://ocdn012.bdsmlr.com/uploads/photos/live.mp4?e=1&t=2');
    expect(renderer.posterSrc).toBe('https://media.bdsmlr.com/poster/live.webp');
    const video = renderer.shadowRoot?.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('src') || '').toContain('live.mp4');
  });

  it('mounts alternate video immediately for direct media-renderer instances', async () => {
    const renderer = document.createElement('media-renderer') as any;
    renderer.src = 'https://ocdn012.bdsmlr.com/uploads/photos/cache.gif?e=1&t=1';
    renderer.alternateVideoSrc = 'https://ocdn012.bdsmlr.com/uploads/photos/cache.mp4?e=1&t=1';
    renderer.fallbackSrc = renderer.src;
    renderer.forceImage = true;
    renderer.type = 'feed';
    document.body.appendChild(renderer);

    await flush();
    await renderer.updateComplete;

    expect(renderer.shadowRoot?.querySelector('video')).toBeTruthy();
    expect(renderer.shadowRoot?.querySelector('img:not(.poster-frame)')).toBeNull();
  });

  it('falls back to the original image when alternate video fails to load', async () => {
    const renderer = document.createElement('media-renderer') as any;
    renderer.src = 'https://ocdn012.bdsmlr.com/uploads/photos/timeout.gif?e=1&t=1';
    renderer.alternateVideoSrc = 'https://ocdn012.bdsmlr.com/uploads/photos/timeout.mp4?e=1&t=1';
    renderer.fallbackSrc = renderer.src;
    renderer.forceImage = true;
    renderer.type = 'feed';
    document.body.appendChild(renderer);

    await flush();
    await renderer.updateComplete;

    const video = renderer.shadowRoot?.querySelector('video');
    expect(video).toBeTruthy();
    video?.dispatchEvent(new Event('error'));
    await renderer.updateComplete;

    expect(renderer.shadowRoot?.querySelector('video')).toBeNull();
    expect(renderer.shadowRoot?.querySelector('img')).toBeTruthy();
    expect(renderer.alternateFallbackReason).toBe('token-or-auth');
    expect(renderer.getAttribute('alternate-fallback-reason')).toBe('token-or-auth');
  });

  it('reuses cached animated alternate failure reasons across signed querystrings for the same canonical asset', async () => {
    const first = document.createElement('media-renderer') as any;
    first.src = 'https://ocdn012.bdsmlr.com/uploads/photos/cache.gif?e=1&t=1';
    first.alternateVideoSrc = 'https://ocdn012.bdsmlr.com/uploads/photos/cache.mp4?e=1&t=1';
    first.fallbackSrc = first.src;
    first.forceImage = true;
    first.type = 'feed';
    document.body.appendChild(first);

    await flush();
    await first.updateComplete;

    const firstVideo = first.shadowRoot?.querySelector('video');
    expect(firstVideo).toBeTruthy();
    firstVideo?.dispatchEvent(new Event('error'));
    await first.updateComplete;
    expect(first.alternateFallbackReason).toBe('token-or-auth');

    const second = document.createElement('media-renderer') as any;
    second.src = 'https://ocdn012.bdsmlr.com/uploads/photos/cache.gif?e=2&t=2';
    second.alternateVideoSrc = 'https://ocdn012.bdsmlr.com/uploads/photos/cache.mp4?e=2&t=2';
    second.fallbackSrc = second.src;
    second.forceImage = true;
    second.type = 'feed';
    document.body.appendChild(second);

    await flush();
    await second.updateComplete;

    expect(second.alternateFallbackReason).toBe('token-or-auth');
    expect(second.getAttribute('alternate-fallback-reason')).toBe('token-or-auth');
    expect(second.shadowRoot?.querySelector('video')).toBeNull();
    expect(second.shadowRoot?.querySelector('img')).toBeTruthy();
  });

  it('falls back to the original animated image when the preferred alternate is absent', async () => {
    const el = document.createElement('post-feed-item') as any;
    el.post = makePost({
      mediaRepresentation: {
        kind: 'ANIMATED_VIDEO',
        items: [
          {
            kind: 'IMAGE',
            original: { url: 'https://ocdn012.bdsmlr.com/uploads/photos/live.gif?e=1&t=2' },
          },
        ],
      },
    });
    el.page = 'feed';
    document.body.appendChild(el);

    await flush();
    await el.updateComplete;

    const renderer = el.shadowRoot?.querySelector('media-renderer') as any;
    expect(renderer).toBeTruthy();
    expect(renderer.src).toBe('https://ocdn012.bdsmlr.com/uploads/photos/live.gif?e=1&t=2');
    expect(renderer.alternateVideoSrc || '').toBe('');
    expect(renderer.shadowRoot?.querySelector('img')).toBeTruthy();
    expect(renderer.shadowRoot?.querySelector('video')).toBeNull();
  });
});
