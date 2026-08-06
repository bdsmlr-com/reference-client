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
  localStorage?.clear?.();
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

  it('uses the stable related document endpoint with an explicit perspective', () => {
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
    expect(recommendationsSrc).toContain('apiClient.posts.relatedDocument({');
    expect(recommendationsSrc).toContain('perspective_role: perspective.role');
    expect(recommendationsSrc).toContain('displayed_reblog_post_id: displayedReblogPostId');
    expect(recommendationsSrc).not.toContain('relatedLegacy');
    expect(relatedPageSrc).not.toContain('.perspectiveRole=');
  });

  it('makes exactly one related document request for a property initialization', async () => {
    const related = vi.spyOn(apiClient.posts, 'relatedDocument').mockResolvedValue({ posts: [] } as any);
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

  it('loads only the selected inline perspective document on initialization', async () => {
    const relatedDocument = vi.fn().mockResolvedValue({ posts: [] });
    (apiClient.posts as any).relatedDocument = relatedDocument;
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });
    element.perspectives = [
      { role: 'original', blogName: 'origin', blogId: 11 },
      { role: 'reblogger', blogName: 'reblogger', blogId: 12 },
    ];

    try {
      await settle(element);

      expect(relatedDocument).toHaveBeenCalledTimes(1);
      expect(relatedDocument).toHaveBeenCalledWith(expect.objectContaining({
        seed_post_id: 101,
        perspective_role: 'original',
        perspective_blog_name: 'origin',
        perspective_blog_id: 11,
      }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
      expect(element.shadowRoot?.textContent).toContain('Original blog (@origin)');
      expect(relatedDocument).not.toHaveBeenCalledWith(expect.objectContaining({
        perspective_role: 'reblogger',
      }), expect.anything());
    } finally {
      element.remove();
      delete (apiClient.posts as any).relatedDocument;
    }
  });

  it('extends the local related-document window without a second API request', async () => {
    const relatedDocument = vi.spyOn(apiClient.posts, 'relatedDocument')
      .mockResolvedValueOnce({
        posts: Array.from({ length: 20 }, (_, index) => ({ id: index + 1, blogName: 'origin', type: 2 })),
        page: { nextPageToken: 'opaque-next-page' },
      } as any)
      .mockResolvedValueOnce({
        posts: [{ id: 2, blogName: 'origin', type: 2 }],
        page: {},
      } as any);
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });

    try {
      await settle(element);
      await (element as any).fetchMore();

      expect(relatedDocument).toHaveBeenCalledTimes(1);
      expect(relatedDocument).toHaveBeenCalledWith(expect.not.objectContaining({
        page_size: expect.anything(),
      }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    } finally {
      element.remove();
      relatedDocument.mockRestore();
    }
  });

  it('loads a non-default inline perspective only when its tab is selected', async () => {
    const relatedDocument = vi.spyOn(apiClient.posts, 'relatedDocument').mockResolvedValue({ posts: [] } as any);
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });
    element.perspectives = [
      { role: 'original', blogName: 'origin', blogId: 11 },
      { role: 'reblogger', blogName: 'reblogger', blogId: 12 },
    ];
    element.displayedReblogPostId = 202;

    try {
      await settle(element);
      expect(relatedDocument).toHaveBeenCalledTimes(1);

      const rebloggerTab = Array.from(element.shadowRoot?.querySelectorAll('button') || [])
        .find((button) => button.textContent?.includes('Reblogger')) as HTMLButtonElement;
      expect(rebloggerTab).toBeTruthy();
      rebloggerTab.click();
      await settle(element);

      expect(relatedDocument).toHaveBeenCalledTimes(2);
      expect(relatedDocument).toHaveBeenLastCalledWith(expect.objectContaining({
        perspective_role: 'reblogger',
        displayed_reblog_post_id: 202,
      }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
      expect(element.shadowRoot?.querySelector('h3')?.textContent?.trim())
        .toBe('Related posts for Reblogger (@reblogger)');
    } finally {
      element.remove();
      relatedDocument.mockRestore();
    }
  });

  it('uses the displayed post route as reblog context when the explicit value is absent', async () => {
    const relatedDocument = vi.spyOn(apiClient.posts, 'relatedDocument').mockResolvedValue({ posts: [] } as any);
    const element = createRecommendations({ role: 'reblogger', blogName: 'reblogger', blogId: 12 });
    element.relatedRoutePostId = 202;

    try {
      await settle(element);

      expect(relatedDocument).toHaveBeenCalledWith(expect.objectContaining({
        perspective_role: 'reblogger',
        displayed_reblog_post_id: 202,
      }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    } finally {
      element.remove();
      relatedDocument.mockRestore();
    }
  });

  it('uses roving accessible inline tabs without fetching on focus alone', async () => {
    const relatedDocument = vi.spyOn(apiClient.posts, 'relatedDocument').mockResolvedValue({ posts: [] } as any);
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });
    element.perspectives = [
      { role: 'original', blogName: 'origin', blogId: 11 },
      { role: 'reblogger', blogName: 'reblogger', blogId: 12 },
    ];

    try {
      await settle(element);
      const tabs = Array.from(element.shadowRoot?.querySelectorAll<HTMLButtonElement>('[role="tab"]') || []);
      const panel = element.shadowRoot?.querySelector<HTMLElement>('[role="tabpanel"]');

      expect(element.shadowRoot?.querySelector('[role="tablist"]')).not.toBeNull();
      expect(tabs.map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1']);
      expect(panel?.id).toBe(tabs[0].getAttribute('aria-controls'));
      expect(panel?.getAttribute('aria-labelledby')).toBe(tabs[0].id);

      tabs[0].focus();
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      expect(element.shadowRoot?.activeElement).toBe(tabs[1]);
      expect(relatedDocument).toHaveBeenCalledTimes(1);
      expect(tabs[1].getAttribute('aria-selected')).toBe('false');

      tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await settle(element);
      expect(relatedDocument).toHaveBeenCalledTimes(2);
      expect(relatedDocument).toHaveBeenLastCalledWith(expect.objectContaining({ perspective_role: 'reblogger' }), expect.any(Object));
    } finally {
      element.remove();
      relatedDocument.mockRestore();
    }
  });

  it('suppresses only a not-indexed tab and makes one fallback request to a distinct reblogger', async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', storage);
    const relatedDocument = vi.spyOn(apiClient.posts, 'relatedDocument')
      .mockRejectedValueOnce(new ApiError(
        ApiErrorCode.BAD_REQUEST,
        'Recommendations are unavailable for @origin because its preference profile has not been indexed yet.',
        {
          serverCode: 'recommendation_perspective_not_indexed',
          isRetryable: false,
          details: { perspectiveRole: 'original', blogId: 11, blogName: 'origin' },
        },
      ))
      .mockResolvedValueOnce({ posts: [], recommendationPerspective: { role: 'reblogger', blogName: 'reblogger', blogId: 12 } } as any);
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });
    element.perspectives = [
      { role: 'original', blogName: 'origin', blogId: 11 },
      { role: 'reblogger', blogName: 'reblogger', blogId: 12 },
    ];

    try {
      await settle(element);

      expect(relatedDocument).toHaveBeenCalledTimes(2);
      expect(relatedDocument.mock.calls[1][0]).toMatchObject({ perspective_role: 'reblogger' });
      expect(storage.setItem).toHaveBeenCalledWith(
        'related-perspective-not-indexed:11',
        expect.stringMatching(/"expiresAt":\d+/),
      );
      expect(element.shadowRoot?.textContent).not.toContain('Original blog (@origin)');
      expect(element.shadowRoot?.querySelector('h3')?.textContent?.trim())
        .toBe('Related posts for Reblogger (@reblogger)');
    } finally {
      element.remove();
      relatedDocument.mockRestore();
    }
  });

  it('selects an unsuppressed fallback before fetching after a reload-style reset', async () => {
    const values = new Map<string, string>([
      ['related-perspective-not-indexed:11', JSON.stringify({ expiresAt: Date.now() + 60_000 })],
    ]);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
    });
    const relatedDocument = vi.spyOn(apiClient.posts, 'relatedDocument').mockResolvedValue({ posts: [] } as any);
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });
    element.perspectives = [
      { role: 'original', blogName: 'origin', blogId: 11 },
      { role: 'reblogger', blogName: 'reblogger', blogId: 12 },
    ];

    try {
      await settle(element);

      expect(relatedDocument).toHaveBeenCalledTimes(1);
      expect(relatedDocument).toHaveBeenCalledWith(expect.objectContaining({
        perspective_role: 'reblogger',
        perspective_blog_id: 12,
      }), expect.any(Object));
      expect(element.shadowRoot?.querySelector('h3')?.textContent?.trim())
        .toBe('Related posts for Reblogger (@reblogger)');
    } finally {
      element.remove();
      relatedDocument.mockRestore();
    }
  });

  it('renders unavailable without a request when every persisted perspective is suppressed', async () => {
    const values = new Map<string, string>([
      ['related-perspective-not-indexed:11', JSON.stringify({ expiresAt: Date.now() + 60_000 })],
      ['related-perspective-not-indexed:12', JSON.stringify({ expiresAt: Date.now() + 60_000 })],
    ]);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const relatedDocument = vi.spyOn(apiClient.posts, 'relatedDocument').mockResolvedValue({ posts: [] } as any);
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });
    element.perspectives = [
      { role: 'original', blogName: 'origin', blogId: 11 },
      { role: 'reblogger', blogName: 'reblogger', blogId: 12 },
    ];

    try {
      await settle(element);

      expect(relatedDocument).not.toHaveBeenCalled();
      expect(element.shadowRoot?.textContent).toContain('Recommendations are unavailable for the selected blog.');
    } finally {
      element.remove();
      relatedDocument.mockRestore();
    }
  });

  it('removes expired perspective suppression before requesting the selected blog', async () => {
    const values = new Map<string, string>([
      ['related-perspective-not-indexed:11', JSON.stringify({ expiresAt: Date.now() - 1 })],
    ]);
    const removeItem = vi.fn((key: string) => values.delete(key));
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn(),
      removeItem,
    });
    const relatedDocument = vi.spyOn(apiClient.posts, 'relatedDocument').mockResolvedValue({ posts: [] } as any);
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });

    try {
      await settle(element);

      expect(removeItem).toHaveBeenCalledWith('related-perspective-not-indexed:11');
      expect(relatedDocument).toHaveBeenCalledWith(expect.objectContaining({
        perspective_role: 'original',
        perspective_blog_id: 11,
      }), expect.any(Object));
    } finally {
      element.remove();
      relatedDocument.mockRestore();
    }
  });

  it('hydrates media for only the visible related document cards in one scoped batch', async () => {
    const relatedDocument = vi.spyOn(apiClient.posts, 'relatedDocument').mockResolvedValue({
      posts: Array.from({ length: 16 }, (_, index) => ({
        id: index + 1,
        blogName: `blog-${index + 1}`,
        type: 2,
        mediaRepresentation: {
          kind: 'ORIGINAL',
          items: [{ kind: 'IMAGE', original: { path: `/uploads/${index + 1}.jpg` } }],
        },
      })),
    } as any);
    const hydrateRelatedMedia = vi.spyOn(apiClient.posts, 'hydrateRelatedMedia').mockResolvedValue({ media: {} });
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });

    try {
      await settle(element);

      expect(hydrateRelatedMedia).toHaveBeenCalledTimes(1);
      expect(hydrateRelatedMedia).toHaveBeenCalledWith({
        references: Array.from({ length: 12 }, (_, index) => ({
          postId: index + 1,
          path: `/uploads/${index + 1}.jpg`,
        })),
      }, expect.objectContaining({
        scope: 'original',
        signal: expect.any(AbortSignal),
      }));
    } finally {
      element.remove();
      relatedDocument.mockRestore();
      hydrateRelatedMedia.mockRestore();
    }
  });

  it('hydrates only canonical originals when related documents include unresolvable alternates', async () => {
    const relatedDocument = vi.spyOn(apiClient.posts, 'relatedDocument').mockResolvedValue({
      posts: Array.from({ length: 12 }, (_, postIndex) => ({
        id: postIndex + 1,
        blogName: `blog-${postIndex + 1}`,
        type: 2,
        mediaRepresentation: {
          kind: 'ORIGINAL',
          items: [{
            kind: 'IMAGE',
            original: { path: `/uploads/${postIndex + 1}/original.jpg` },
            alternates: Array.from({ length: 9 }, (_, alternateIndex) => ({
              path: `/uploads/${postIndex + 1}/alternate-${alternateIndex + 1}.jpg`,
            })),
          }],
        },
      })),
    } as any);
    const hydrateRelatedMedia = vi.spyOn(apiClient.posts, 'hydrateRelatedMedia').mockResolvedValue({ media: {} });
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });

    try {
      await settle(element);

      expect(hydrateRelatedMedia).toHaveBeenCalledTimes(1);
      expect(hydrateRelatedMedia.mock.calls[0][0].references).toEqual(
        Array.from({ length: 12 }, (_, postIndex) => ({
          postId: postIndex + 1,
          path: `/uploads/${postIndex + 1}/original.jpg`,
        })),
      );
      expect(element.shadowRoot?.textContent).not.toContain('Recommendations are unavailable right now.');
    } finally {
      element.remove();
      relatedDocument.mockRestore();
      hydrateRelatedMedia.mockRestore();
    }
  });

  it('applies a server-derived animated alternate to the hydrated recommendation card', async () => {
    const relatedDocument = vi.spyOn(apiClient.posts, 'relatedDocument').mockResolvedValue({
      posts: [{
        id: 42,
        blogName: 'origin',
        type: 2,
        mediaRepresentation: {
          kind: 'ANIMATED_VIDEO',
          items: [{
            kind: 'IMAGE',
            original: { path: '/uploads/42.gif' },
            alternates: [{ path: '/uploads/42.mp4', mimeType: 'video/mp4' }],
          }],
        },
      }],
    } as any);
    const hydrateRelatedMedia = vi.spyOn(apiClient.posts, 'hydrateRelatedMedia').mockResolvedValue({
      media: {
        '42:/uploads/42.gif': {
          original: 'https://media.example/42.gif',
          alternates: ['https://media.example/42.mp4'],
        },
      },
    } as any);
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });

    try {
      await settle(element);

      expect((element as any).relatedPosts[0]._hydratedPost._media.videoUrl).toBe('https://media.example/42.mp4');
    } finally {
      element.remove();
      relatedDocument.mockRestore();
      hydrateRelatedMedia.mockRestore();
    }
  });

  it('aborts hydration and ignores its stale result when the perspective changes', async () => {
    const hydration = deferred<any>();
    const relatedDocument = vi.spyOn(apiClient.posts, 'relatedDocument')
      .mockResolvedValueOnce({
        posts: [{
          id: 1,
          blogName: 'origin',
          type: 2,
          mediaRepresentation: { kind: 'ORIGINAL', items: [{ kind: 'IMAGE', original: { path: '/uploads/one.jpg' } }] },
        }],
      } as any)
      .mockResolvedValueOnce({ posts: [] } as any);
    const hydrateRelatedMedia = vi.spyOn(apiClient.posts, 'hydrateRelatedMedia').mockImplementation(() => hydration.promise);
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });
    element.perspectives = [
      { role: 'original', blogName: 'origin', blogId: 11 },
      { role: 'reblogger', blogName: 'reblogger', blogId: 12 },
    ];

    try {
      await settle(element);
      const signal = hydrateRelatedMedia.mock.calls[0][1].signal;
      element.perspective = { role: 'reblogger', blogName: 'reblogger', blogId: 12 };
      await settle(element);
      hydration.resolve({ media: { '1:/uploads/one.jpg': { original: 'https://media.example/stale.jpg' } } });
      await settle(element);

      expect(signal.aborted).toBe(true);
      expect(element.shadowRoot?.querySelector('h3')?.textContent?.trim())
        .toBe('Related posts for Reblogger (@reblogger)');
      expect(element.shadowRoot?.querySelector('post-grid')).toBeNull();
    } finally {
      element.remove();
      relatedDocument.mockRestore();
      hydrateRelatedMedia.mockRestore();
    }
  });

  it('aborts hydration and ignores its stale result when disconnected', async () => {
    const hydration = deferred<any>();
    const relatedDocument = vi.spyOn(apiClient.posts, 'relatedDocument').mockResolvedValue({
      posts: [{
        id: 1,
        blogName: 'origin',
        type: 2,
        mediaRepresentation: { kind: 'ORIGINAL', items: [{ kind: 'IMAGE', original: { path: '/uploads/one.jpg' } }] },
      }],
    } as any);
    const hydrateRelatedMedia = vi.spyOn(apiClient.posts, 'hydrateRelatedMedia').mockImplementation(() => hydration.promise);
    const element = createRecommendations({ role: 'original', blogName: 'origin', blogId: 11 });

    await settle(element);
    const signal = hydrateRelatedMedia.mock.calls[0][1].signal;
    element.remove();
    hydration.resolve({ media: { '1:/uploads/one.jpg': { original: 'https://media.example/stale.jpg' } } });
    await Promise.resolve();

    expect(signal.aborted).toBe(true);
    expect(element.shadowRoot?.querySelector('post-grid')).toBeNull();
    relatedDocument.mockRestore();
    hydrateRelatedMedia.mockRestore();
  });

  it('sends the displayed reblog id only for a reblogger perspective', async () => {
    const related = vi.spyOn(apiClient.posts, 'relatedDocument').mockResolvedValue({ posts: [] } as any);
    const element = createRecommendations({ role: 'reblogger', blogName: 'reblogger', blogId: 20 });
    element.displayedReblogPostId = 202;

    try {
      await settle(element);
      expect(related).toHaveBeenCalledWith(expect.objectContaining({
        seed_post_id: 101,
        perspective_role: 'reblogger',
        displayed_reblog_post_id: 202,
      }), expect.any(Object));
    } finally {
      element.remove();
      related.mockRestore();
    }
  });

  it('names the selected perspective in the inline recommendations heading', async () => {
    const related = vi.spyOn(apiClient.posts, 'relatedDocument').mockResolvedValue({ posts: [] } as any);
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
    const related = vi.spyOn(apiClient.posts, 'relatedDocument').mockResolvedValue({ posts: [] } as any);
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
    const related = vi.spyOn(apiClient.posts, 'relatedDocument').mockRejectedValue(new ApiError(
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
    const related = vi.spyOn(apiClient.posts, 'relatedDocument')
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
    const related = vi.spyOn(apiClient.posts, 'relatedDocument')
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
    const related = vi.spyOn(apiClient.posts, 'relatedDocument').mockImplementation(() => request.promise);
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
