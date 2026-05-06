import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProcessedPost } from '../src/types/post.js';

function stubBrowserState() {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal('window', {
    location: { href: 'https://example.invalid/' },
    open: vi.fn(),
  } as unknown as Window);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeHydratedPost(overrides: Partial<ProcessedPost> = {}): ProcessedPost {
  return {
    id: 601,
    blogName: 'beta',
    originBlogName: 'beta',
    type: 2,
    content: {
      files: ['/uploads/beta.jpg'],
      thumbnail: '/uploads/beta.jpg',
    },
    _media: { type: 'image', url: '/uploads/beta.jpg' },
    _retrievalPolicy: {
      linkAllowed: false,
      clickAction: 'open_modal',
      imageVariant: 'feed-pixelated',
    },
    ...overrides,
  } as ProcessedPost;
}

describe('post recommendations retrieval click policy', () => {
  it('opens the existing modal path instead of navigating for gated canonical posts', async () => {
    stubBrowserState();
    const dispatchEvent = vi.fn();
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as any;

    const { PostRecommendations } = await import('../src/components/post-recommendations.js');
    const component = Object.create(PostRecommendations.prototype) as InstanceType<typeof PostRecommendations>;

    (component as any).dispatchEvent = dispatchEvent;
    Object.defineProperty(component, 'from', { value: 'direct', configurable: true, writable: true });
    (component as any).navigateToRelated({
      post_id: 601,
      similarity_score: 0,
      _hydratedPost: makeHydratedPost(),
    } as any, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    const dispatched = dispatchEvent.mock.calls[0]?.[0] as CustomEvent | undefined;
    expect(dispatched).toBeTruthy();
    expect(dispatched?.type).toBe('post-click');
    expect(dispatched?.detail).toEqual(expect.objectContaining({ from: 'direct' }));
  });
});
