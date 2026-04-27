import { describe, expect, it } from 'vitest';

describe('discover policy', () => {
  it('materializes canonical recommended posts directly and applies policy metadata', async () => {
    const { materializeRecommendedPosts } = await import('../src/services/recommendation-api.js');

    const posts = materializeRecommendedPosts({
      posts: [
        {
          id: 501,
          blogName: 'alpha',
          type: 2,
          content: {
            files: ['/uploads/alpha.jpg'],
            thumbnail: '/uploads/alpha.jpg',
          },
        },
      ],
      postPolicies: {
        '501': {
          imageVariant: 'feed-pixelated',
          linkAllowed: false,
          clickAction: 'open_modal',
          redactionMode: 'pixelated',
          visibilityFraction: 0.4,
        },
      },
    } as any);

    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe(501);
    expect(posts[0]._media.type).toBe('image');
    expect(posts[0]._retrievalPolicy?.imageVariant).toBe('feed-pixelated');
    expect(posts[0]._retrievalPolicy?.clickAction).toBe('open_modal');
  });

  it('does not materialize legacy recommendation payloads as canonical posts', async () => {
    const { materializeRecommendedPosts } = await import('../src/services/recommendation-api.js');

    const posts = materializeRecommendedPosts({
      recommendations: [
        {
          content_id: 'alpha',
          similarity_score: 0.81,
        },
      ],
    } as any);

    expect(posts).toHaveLength(0);
  });
});
