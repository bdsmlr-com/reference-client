import { afterEach, describe, expect, it, vi } from 'vitest';

function stubBrowserState() {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal('window', {
    location: { search: '' },
  } as Window);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('post recommendations policy', () => {
  it('uses canonical recommendation posts directly and skips batch hydration when available', async () => {
    stubBrowserState();
    const { materializeRecommendationItems } = await import('../src/components/post-recommendations.js');
    const batchGetPosts = vi.fn();
    const getPost = vi.fn();
    const searchPosts = vi.fn();

    const items = await materializeRecommendationItems(
      {
        posts: [
          {
            id: 101,
            blogName: 'alpha',
            type: 2,
            content: {
              files: ['/uploads/alpha.jpg'],
              thumbnail: '/uploads/alpha.jpg',
            },
          },
        ],
        postPolicies: {
          '101': {
            imageVariant: 'feed-pixelated',
            linkAllowed: false,
            clickAction: 'open_modal',
            redactionMode: 'pixelated',
            visibilityFraction: 0.4,
          },
        },
      } as any,
      { batchGetPosts, getPost, searchPosts },
    );

    expect(batchGetPosts).not.toHaveBeenCalled();
    expect(getPost).not.toHaveBeenCalled();
    expect(items).toHaveLength(1);
    expect(items[0].post_id).toBe(101);
    expect(items[0]._hydratedPost?._media.type).toBe('image');
    expect(items[0]._hydratedPost?._retrievalPolicy?.imageVariant).toBe('feed-pixelated');
    expect(items[0]._hydratedPost?._retrievalPolicy?.clickAction).toBe('open_modal');
  });

  it('falls back to batch hydration when canonical posts are unavailable', async () => {
    stubBrowserState();
    const { materializeRecommendationItems } = await import('../src/components/post-recommendations.js');
    const batchGetPosts = vi.fn().mockResolvedValue({
      posts: [
        {
          id: 202,
          blogName: 'beta',
          type: 2,
          content: {
            files: ['/uploads/beta.jpg'],
            thumbnail: '/uploads/beta.jpg',
          },
        },
      ],
    });
    const getPost = vi.fn();
    const searchPosts = vi.fn();

    const items = await materializeRecommendationItems(
      {
        recommendations: [
          {
            post_id: 202,
            similarity_score: 0.81,
          },
        ],
      } as any,
      { batchGetPosts, getPost, searchPosts },
    );

    expect(batchGetPosts).toHaveBeenCalledTimes(1);
    expect(batchGetPosts).toHaveBeenCalledWith([202]);
    expect(getPost).not.toHaveBeenCalled();
    expect(items).toHaveLength(1);
    expect(items[0].post_id).toBe(202);
    expect(items[0]._hydratedPost?._media.type).toBe('image');
  });

  it('rehydrates canonical recommendation posts when identity fields are missing', async () => {
    stubBrowserState();
    const { materializeRecommendationItems } = await import('../src/components/post-recommendations.js');
    const batchGetPosts = vi.fn().mockResolvedValue({
      posts: [
        {
          id: 303,
          blogName: 'gamma',
          type: 2,
          content: {
            files: ['/uploads/gamma.jpg'],
            thumbnail: '/uploads/gamma.jpg',
          },
        },
      ],
    });
    const getPost = vi.fn();
    const searchPosts = vi.fn();

    const items = await materializeRecommendationItems(
      {
        posts: [
          {
            id: 303,
            type: 2,
            content: {
              files: ['/uploads/gamma.jpg'],
              thumbnail: '/uploads/gamma.jpg',
            },
          },
        ],
      } as any,
      { batchGetPosts, getPost, searchPosts },
    );

    expect(batchGetPosts).toHaveBeenCalledTimes(1);
    expect(batchGetPosts).toHaveBeenCalledWith([303]);
    expect(getPost).not.toHaveBeenCalled();
    expect(items).toHaveLength(1);
    expect(items[0]._hydratedPost?.blogName).toBe('gamma');
  });

  it('falls back to search hydration when batch hydration is still sparse', async () => {
    stubBrowserState();
    const { materializeRecommendationItems } = await import('../src/components/post-recommendations.js');
    const batchGetPosts = vi.fn().mockResolvedValue({
      posts: [
        {
          id: 404,
          type: 2,
          content: {
            files: ['/uploads/delta.jpg'],
            thumbnail: '/uploads/delta.jpg',
          },
        },
      ],
    });
    const getPost = vi.fn();
    const searchPosts = vi.fn().mockResolvedValue({
      posts: [
        {
          id: 404,
          blogName: 'delta',
          type: 2,
          content: {
            files: ['/uploads/delta.jpg'],
            thumbnail: '/uploads/delta.jpg',
          },
        },
      ],
    });

    const items = await materializeRecommendationItems(
      {
        posts: [
          {
            id: 404,
            type: 2,
            content: {
              files: ['/uploads/delta.jpg'],
              thumbnail: '/uploads/delta.jpg',
            },
          },
        ],
      } as any,
      { batchGetPosts, getPost, searchPosts },
    );

    expect(batchGetPosts).toHaveBeenCalledTimes(1);
    expect(batchGetPosts).toHaveBeenCalledWith([404]);
    expect(getPost).not.toHaveBeenCalled();
    expect(searchPosts).toHaveBeenCalledTimes(1);
    expect(searchPosts).toHaveBeenCalledWith('post:404');
    expect(items).toHaveLength(1);
    expect(items[0]._hydratedPost?.blogName).toBe('delta');
  });
});
