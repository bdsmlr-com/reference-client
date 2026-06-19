// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractMedia } from '../src/types/post.js';
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
      files: ['https://legacy.example.com/ignored.jpg'],
      thumbnail: 'https://legacy.example.com/ignored-thumb.jpg',
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

  it('uses the preferred animated-video alternate when the probe succeeds', async () => {
    const loadSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'load')
      .mockImplementation(function mockLoad(this: HTMLMediaElement) {
        queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata')));
      });

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
    expect(renderer.shadowRoot?.querySelector('video')).toBeTruthy();
    expect(loadSpy).toHaveBeenCalled();
  });

  it('reuses animated alternate probe cache across signed querystrings for the same canonical asset', async () => {
    const loadSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'load')
      .mockImplementation(function mockLoad(this: HTMLMediaElement) {
        queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata')));
      });

    const first = document.createElement('media-renderer') as any;
    first.src = 'https://ocdn012.bdsmlr.com/uploads/photos/cache.gif?e=1&t=1';
    first.alternateVideoSrc = 'https://ocdn012.bdsmlr.com/uploads/photos/cache.mp4?e=1&t=1';
    first.fallbackSrc = first.src;
    first.forceImage = true;
    first.type = 'feed';
    document.body.appendChild(first);

    await flush();
    await first.updateComplete;
    await flush();
    await first.updateComplete;

    const probeLoadsAfterFirst = loadSpy.mock.calls.length;
    expect(first.shadowRoot?.querySelector('video')).toBeTruthy();

    const second = document.createElement('media-renderer') as any;
    second.src = 'https://ocdn012.bdsmlr.com/uploads/photos/cache.gif?e=2&t=2';
    second.alternateVideoSrc = 'https://ocdn012.bdsmlr.com/uploads/photos/cache.mp4?e=2&t=2';
    second.fallbackSrc = second.src;
    second.forceImage = true;
    second.type = 'feed';
    document.body.appendChild(second);

    await flush();
    await second.updateComplete;
    await flush();
    await second.updateComplete;

    expect(second.shadowRoot?.querySelector('video')).toBeTruthy();
    expect(loadSpy.mock.calls.length).toBe(probeLoadsAfterFirst);
  });

  it('falls back after a 1500ms probe timeout to the original image', async () => {
    vi.useFakeTimers();
    const loadSpy = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});

    const renderer = document.createElement('media-renderer') as any;
    renderer.src = 'https://ocdn012.bdsmlr.com/uploads/photos/timeout.gif?e=1&t=1';
    renderer.alternateVideoSrc = 'https://ocdn012.bdsmlr.com/uploads/photos/timeout.mp4?e=1&t=1';
    renderer.fallbackSrc = renderer.src;
    renderer.forceImage = true;
    renderer.type = 'feed';
    document.body.appendChild(renderer);

    await flush();
    await renderer.updateComplete;
    vi.advanceTimersByTime(1500);
    await flush();
    await renderer.updateComplete;

    expect(renderer.shadowRoot?.querySelector('img')).toBeTruthy();
    expect(renderer.shadowRoot?.querySelector('video')).toBeNull();
    expect(loadSpy).toHaveBeenCalled();
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
