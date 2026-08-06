// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PostsApi } from '../src/services/api.js';
import type { RelatedPostsRequest, RelatedPostsResponse } from '../src/types/api.js';
import { apiClient } from '../src/services/client.js';
import { ApiError, ApiErrorCode } from '../src/services/api-error.js';
import '../src/components/post-recommendations.js';

async function settle(element: { updateComplete: Promise<unknown> }): Promise<void> {
  await element.updateComplete;
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}

function createRecommendations(perspective: { role: 'viewer' | 'original' | 'reblogger'; blogName: string; blogId?: number } | undefined) {
  const element = document.createElement('post-recommendations') as any;
  element.postId = 101;
  element.perspective = perspective;
  document.body.append(element);
  return element;
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;

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
  it('keeps request roles strict while accepting legacy response metadata', () => {
    const requestIsExact: Equal<Parameters<PostsApi['related']>[0], RelatedPostsRequest> = true;
    const legacyRole: RelatedPostsResponse['recommendationPerspective']['role'] = 'legacy';
    const reblogRequest: RelatedPostsRequest = {
      seed_post_id: 625562977,
      perspective_role: 'reblogger',
      displayedReblogPostId: 625562977,
    };

    expect(requestIsExact).toBe(true);
    expect(legacyRole).toBe('legacy');
    expect(reblogRequest.displayedReblogPostId).toBe(625562977);
  });

  it('uses the strict related endpoint with an explicit perspective', () => {
    const apiSrc = readFileSync(join(process.cwd(), 'src/services/api.ts'), 'utf8');
    const recommendationsSrc = readFileSync(
      join(process.cwd(), 'src/components/post-recommendations.ts'),
      'utf8',
    );
    const relatedPageSrc = readFileSync(
      join(process.cwd(), 'src/pages/view-post-related.ts'),
      'utf8',
    );

    expect(apiSrc).toContain("req: Omit<RelatedPostsRequest, 'perspective_role'>");
    expect(recommendationsSrc).toContain('apiClient.posts.related({');
    expect(recommendationsSrc).toContain('perspective_role: perspective.role');
    expect(recommendationsSrc).not.toContain('relatedLegacy');
    expect(relatedPageSrc).not.toContain('.perspectiveRole=');
  });

  it('makes exactly one related request for a property initialization', async () => {
    const related = vi.spyOn(apiClient.posts, 'related').mockResolvedValue({ posts: [] } as any);
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });

    try {
      await settle(element);
      expect(related).toHaveBeenCalledTimes(1);
      expect(related).toHaveBeenCalledWith(expect.objectContaining({
        seed_post_id: 101,
        perspective_role: 'original',
        perspective_blog_name: 'origin',
        perspective_blog_id: 11,
      }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
      expect(element.shadowRoot?.textContent).toContain('No related posts found.');
      expect(element.shadowRoot?.querySelector('post-grid')).toBeNull();
      expect(element.shadowRoot?.querySelector('load-footer')).toBeNull();
    } finally {
      element.remove();
      related.mockRestore();
    }
  });

  it('sends the displayed reblog id only for a reblogger perspective', async () => {
    const related = vi.spyOn(apiClient.posts, 'related').mockResolvedValue({ posts: [] } as any);
    const element = createRecommendations({ role: 'reblogger', blogName: 'reblogger', blogId: 20 });
    element.displayedReblogPostId = 202;

    try {
      await settle(element);
      expect(related).toHaveBeenCalledWith(expect.objectContaining({
        seed_post_id: 101,
        perspective_role: 'reblogger',
        displayedReblogPostId: 202,
      }), expect.any(Object));
    } finally {
      element.remove();
      related.mockRestore();
    }
  });

  it('names the selected perspective in the inline recommendations heading', async () => {
    const related = vi.spyOn(apiClient.posts, 'related').mockResolvedValue({ posts: [] } as any);
    const element = createRecommendations({ role: 'reblogger', blogName: 'reblogger', blogId: 20 });

    try {
      await settle(element);
      expect(element.shadowRoot?.querySelector('h3')?.textContent?.trim())
        .toBe('Related posts for Reblogger (@reblogger)');
      expect(element.shadowRoot?.textContent).not.toContain('More like this');
    } finally {
      element.remove();
      related.mockRestore();
    }
  });

  it('does not request when the selected perspective is unresolved', async () => {
    const related = vi.spyOn(apiClient.posts, 'related').mockResolvedValue({ posts: [] } as any);
    const element = createRecommendations(undefined);

    try {
      await settle(element);
      expect(related).not.toHaveBeenCalled();
      expect(element.shadowRoot?.textContent).toContain('Recommendations are unavailable for the selected blog.');
      expect(element.shadowRoot?.querySelector('load-footer')).toBeNull();
    } finally {
      element.remove();
      related.mockRestore();
    }
  });

  it('shows the named unavailable pane for a non-retryable perspective error', async () => {
    const related = vi.spyOn(apiClient.posts, 'related').mockRejectedValue(new ApiError(
      ApiErrorCode.BAD_REQUEST,
      'Recommendations are unavailable for @viewer because its preference profile has not been indexed yet.',
      {
        serverCode: 'recommendation_perspective_not_indexed',
        isRetryable: false,
        details: { perspectiveRole: 'viewer', blogId: 12, blogName: 'viewer' },
      },
    ));
    const element = createRecommendations({ role: 'viewer', blogName: 'viewer', blogId: 12 });

    try {
      await settle(element);
      expect(element.shadowRoot?.textContent).toContain('Recommendations are unavailable for @viewer');
      expect(element.shadowRoot?.querySelector('load-footer')).toBeNull();
      expect(element.shadowRoot?.textContent).not.toContain('Count: 0');
      const recommendationsSrc = readFileSync(
        join(process.cwd(), 'src/components/post-recommendations.ts'),
        'utf8',
      );
      expect(recommendationsSrc).toContain('isRelatedPerspectiveNotIndexedError(apiError)');
    } finally {
      element.remove();
      related.mockRestore();
    }
  });

  it('retries temporary recommendation failures exactly once per click', async () => {
    const related = vi.spyOn(apiClient.posts, 'related')
      .mockRejectedValueOnce(new ApiError(
        ApiErrorCode.SERVER_ERROR,
        'Recommendations are temporarily unavailable.',
        { serverCode: 'recommendation_service_unavailable', isRetryable: true },
      ))
      .mockResolvedValueOnce({ posts: [] } as any);
    const element = createRecommendations({ role: 'viewer', blogName: 'viewer', blogId: 12 });

    try {
      await settle(element);
      const retry = Array.from(element.shadowRoot?.querySelectorAll('button') || [])
        .find((button) => button.textContent?.trim() === 'Retry') as HTMLButtonElement;
      expect(retry).toBeTruthy();
      retry.click();
      await settle(element);
      expect(related).toHaveBeenCalledTimes(2);
      expect(element.shadowRoot?.querySelector('load-footer')).toBeNull();
    } finally {
      element.remove();
      related.mockRestore();
    }
  });

  it('aborts and ignores an in-flight request when the perspective changes', async () => {
    const first = deferred<any>();
    const related = vi.spyOn(apiClient.posts, 'related')
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ posts: [] } as any);
    const batchGetPosts = vi.spyOn(apiClient.posts, 'batchGet').mockResolvedValue({ posts: [] } as any);
    const element = createRecommendations({ role: 'viewer', blogName: 'first-viewer', blogId: 11 });

    try {
      await settle(element);
      const firstOptions = related.mock.calls[0][1];
      element.perspective = { role: 'viewer', blogName: 'second-viewer', blogId: 12 };
      await settle(element);
      first.resolve({ recommendations: [{ post_id: 404, similarity_score: 0.9 }] });
      await settle(element);

      expect(firstOptions?.signal.aborted).toBe(true);
      expect(related).toHaveBeenCalledTimes(2);
      expect(batchGetPosts).not.toHaveBeenCalled();
      expect(element.shadowRoot?.textContent).toContain('No related posts found.');
    } finally {
      element.remove();
      related.mockRestore();
      batchGetPosts.mockRestore();
    }
  });

  it('aborts and ignores an in-flight request when disconnected', async () => {
    const request = deferred<any>();
    const related = vi.spyOn(apiClient.posts, 'related').mockImplementation(() => request.promise);
    const batchGetPosts = vi.spyOn(apiClient.posts, 'batchGet').mockResolvedValue({ posts: [] } as any);
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });

    await settle(element);
    const options = related.mock.calls[0][1];
    element.remove();
    request.resolve({ recommendations: [{ post_id: 404, similarity_score: 0.9 }] });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(options?.signal.aborted).toBe(true);
    expect(batchGetPosts).not.toHaveBeenCalled();
    related.mockRestore();
    batchGetPosts.mockRestore();
  });

  it('uses canonical recommendation posts directly and skips batch hydration when available', async () => {
    stubBrowserState();
    const { materializeRecommendationItems } = await import('../src/components/post-recommendations.js');
    const batchGetPosts = vi.fn();
    const getPost = vi.fn();

    const items = await materializeRecommendationItems(
      {
        posts: [
          {
            id: 101,
            blogName: 'alpha',
            type: 2,
            mediaRepresentation: {
              kind: 'ORIGINAL',
              items: [{ kind: 'IMAGE', original: { url: '/uploads/alpha.jpg' } }],
            },
            contentBlocks: [{ mediaBlock: {} }],
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
      { batchGetPosts, getPost },
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
          mediaRepresentation: {
            kind: 'ORIGINAL',
            items: [{ kind: 'IMAGE', original: { url: '/uploads/beta.jpg' } }],
          },
          contentBlocks: [{ mediaBlock: {} }],
        },
      ],
    });
    const getPost = vi.fn();

    const items = await materializeRecommendationItems(
      {
        recommendations: [
          {
            post_id: 202,
            similarity_score: 0.81,
          },
        ],
      } as any,
      { batchGetPosts, getPost },
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
          mediaRepresentation: {
            kind: 'ORIGINAL',
            items: [{ kind: 'IMAGE', original: { url: '/uploads/gamma.jpg' } }],
          },
          contentBlocks: [{ mediaBlock: {} }],
        },
      ],
    });
    const getPost = vi.fn();

    const items = await materializeRecommendationItems(
      {
        posts: [
          {
            id: 303,
            type: 2,
            mediaRepresentation: {
              kind: 'ORIGINAL',
              items: [{ kind: 'IMAGE', original: { url: '/uploads/gamma.jpg' } }],
            },
            contentBlocks: [{ mediaBlock: {} }],
          },
        ],
      } as any,
      { batchGetPosts, getPost },
    );

    expect(batchGetPosts).toHaveBeenCalledTimes(1);
    expect(batchGetPosts).toHaveBeenCalledWith([303]);
    expect(getPost).not.toHaveBeenCalled();
    expect(items).toHaveLength(1);
    expect(items[0]._hydratedPost?.blogName).toBe('gamma');
  });

  it('falls back to per-post hydration when batch hydration is still sparse', async () => {
    stubBrowserState();
    const { materializeRecommendationItems } = await import('../src/components/post-recommendations.js');
    const batchGetPosts = vi.fn().mockResolvedValue({
      posts: [
        {
          id: 404,
          type: 2,
          mediaRepresentation: {
            kind: 'ORIGINAL',
            items: [{ kind: 'IMAGE', original: { url: '/uploads/delta.jpg' } }],
          },
          contentBlocks: [{ mediaBlock: {} }],
        },
      ],
    });
    const getPost = vi.fn().mockResolvedValue({
      post: {
        id: 404,
        blogName: 'delta',
        type: 2,
        mediaRepresentation: {
          kind: 'ORIGINAL',
          items: [{ kind: 'IMAGE', original: { url: '/uploads/delta.jpg' } }],
        },
        contentBlocks: [{ mediaBlock: {} }],
      },
    });

    const items = await materializeRecommendationItems(
      {
        posts: [
          {
            id: 404,
            type: 2,
            mediaRepresentation: {
              kind: 'ORIGINAL',
              items: [{ kind: 'IMAGE', original: { url: '/uploads/delta.jpg' } }],
            },
            contentBlocks: [{ mediaBlock: {} }],
          },
        ],
      } as any,
      { batchGetPosts, getPost },
    );

    expect(batchGetPosts).toHaveBeenCalledTimes(1);
    expect(batchGetPosts).toHaveBeenCalledWith([404]);
    expect(getPost).toHaveBeenCalledTimes(1);
    expect(getPost).toHaveBeenCalledWith(404);
    expect(items).toHaveLength(1);
    expect(items[0]._hydratedPost?.blogName).toBe('delta');
  });
});
