// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractMedia } from '../src/types/post.js';
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
