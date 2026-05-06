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

function makePost(overrides: Partial<ProcessedPost> = {}): ProcessedPost {
  return {
    id: 501,
    blogName: 'alpha',
    originBlogName: 'alpha',
    type: 2,
    content: {
      files: ['/uploads/alpha.jpg'],
      thumbnail: '/uploads/alpha.jpg',
    },
    _media: { type: 'image', url: '/uploads/alpha.jpg' },
    _retrievalPolicy: {
      linkAllowed: false,
      clickAction: 'open_modal',
      imageVariant: 'feed-pixelated',
    },
    ...overrides,
  } as ProcessedPost;
}

describe('post card retrieval click policy', () => {
  it('opens the modal path instead of navigating when the permalink is gated', async () => {
    stubBrowserState();
    const dispatchEvent = vi.fn();
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as any;

    const { PostCard } = await import('../src/components/post-card.js');
    const card = {
      post: makePost(),
      dispatchEvent,
      handleClick: () => PostCard.prototype.handleClick.call(card),
    } as any;

    PostCard.prototype.handlePermalinkClick.call(card, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'post-select',
    }));
  });
});
