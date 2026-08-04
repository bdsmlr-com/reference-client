import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('discover policy', () => {
  it('materializes canonical recommended posts through the shared api-post helper and applies policy metadata', async () => {
    const { materializeApiPosts } = await import('../src/services/content-results.js');

    const posts = materializeApiPosts(
      [
        {
          id: 501,
          blogName: 'alpha',
          type: 2,
          contentBlocks: [{ mediaBlock: {} }],
          mediaRepresentation: {
            kind: 'ORIGINAL',
            items: [{ kind: 'IMAGE', original: { url: '/uploads/alpha.jpg' } }],
          },
        },
      ] as any,
      {
        '501': {
          imageVariant: 'feed-pixelated',
          linkAllowed: false,
          clickAction: 'open_modal',
          redactionMode: 'pixelated',
          visibilityFraction: 0.4,
        },
      },
    );

    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe(501);
    expect(posts[0]._media.type).toBe('image');
    expect(posts[0]._retrievalPolicy?.imageVariant).toBe('feed-pixelated');
    expect(posts[0]._retrievalPolicy?.clickAction).toBe('open_modal');
  });

  it('returns an empty list when canonical posts are absent', async () => {
    const { materializeApiPosts } = await import('../src/services/content-results.js');

    expect(materializeApiPosts(undefined, undefined)).toEqual([]);
  });

  it('reuses the shared canonical post materializer in recommendation flows', () => {
    const recommendationApiSrc = readFileSync(join(ROOT, 'services/recommendation-api.ts'), 'utf8');
    const postRecommendationsSrc = readFileSync(join(ROOT, 'components/post-recommendations.ts'), 'utf8');

    expect(recommendationApiSrc).toContain("import { materializeApiPosts } from './content-results.js';");
    expect(recommendationApiSrc).toContain('return materializeApiPosts(response.posts, response.postPolicies);');
    expect(postRecommendationsSrc).toContain("import { materializeApiPosts } from '../services/content-results.js';");
    expect(postRecommendationsSrc).toContain('const canonicalPosts = materializeApiPosts(response.posts, response.postPolicies);');
    expect(postRecommendationsSrc).not.toContain('function buildCanonicalRecommendationItems(');
  });
});
