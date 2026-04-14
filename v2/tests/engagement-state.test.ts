import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAuthUser, updateActiveBlog, clearAuthUser } from '../src/state/auth-state.js';
import { EngagementStateController } from '../src/services/engagement-state.js';

type LikeApi = {
  batchGetLikeStates: ReturnType<typeof vi.fn>;
  likePost: ReturnType<typeof vi.fn>;
  unlikePost: ReturnType<typeof vi.fn>;
};

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

class TestCustomEvent<T = unknown> extends Event {
  detail: T;

  constructor(type: string, init?: CustomEventInit<T>) {
    super(type, init);
    this.detail = init?.detail as T;
  }
}

let currentWindow: EventTarget & { location?: { search: string } } | null = null;
let currentController: EngagementStateController | null = null;

function createController(api?: Partial<LikeApi>) {
  const engagementApi = {
    batchGetLikeStates: vi.fn().mockResolvedValue({ states: [] }),
    likePost: vi.fn().mockResolvedValue({ ok: true, action: 'like', postId: 1, actingBlogId: 11, state: { liked: true } }),
    unlikePost: vi.fn().mockResolvedValue({ ok: true, action: 'unlike', postId: 1, actingBlogId: 11, state: { liked: false } }),
    ...api,
  };

  currentController = new EngagementStateController({
    engagementApi,
    tokenProvider: () => 'test-token',
  });

  return { engagementApi, controller: currentController };
}

describe('engagement-state controller', () => {
  beforeEach(() => {
    currentWindow = new EventTarget() as EventTarget & { location: { search: string } };
    currentWindow.location = { search: '' };
    vi.stubGlobal('window', currentWindow);
    vi.stubGlobal('CustomEvent', TestCustomEvent as unknown as typeof CustomEvent);
    clearAuthUser();
  });

  afterEach(() => {
    currentController?.destroy();
    currentController = null;
  });

  it('keys cached like states by post id and acting blog id', async () => {
    const { controller, engagementApi } = createController({
      batchGetLikeStates: vi.fn().mockImplementation(async ({ postIds, actingBlogId }) => ({
        states: postIds.map((postId: number) => ({ postId, liked: actingBlogId === 11 && postId === 1 })),
      })),
    });

    setAuthUser({
      userId: 7,
      blogId: 11,
      activeBlogId: 11,
      blogs: [
        { id: 11, name: 'alpha' },
        { id: 22, name: 'beta' },
      ],
    });

    await controller.hydrateLikeStates([1]);
    expect(controller.getLikeState(1)).toBe(true);

    updateActiveBlog(22, 'beta');
    await controller.hydrateLikeStates([1]);
    expect(controller.getLikeState(1)).toBe(false);

    expect(engagementApi.batchGetLikeStates).toHaveBeenCalledTimes(2);
    expect(engagementApi.batchGetLikeStates.mock.calls[0][0]).toEqual({ postIds: [1], actingBlogId: 11 });
    expect(engagementApi.batchGetLikeStates.mock.calls[1][0]).toEqual({ postIds: [1], actingBlogId: 22 });
  });

  it('drops cached actor state when auth-user-changed updates the active blog', async () => {
    const { controller, engagementApi } = createController({
      batchGetLikeStates: vi.fn().mockResolvedValue({ states: [{ postId: 9, liked: true }] }),
    });

    setAuthUser({
      userId: 7,
      blogId: 11,
      activeBlogId: 11,
      blogs: [{ id: 11, name: 'alpha' }],
    });

    await controller.hydrateLikeStates([9]);
    expect(controller.getLikeState(9)).toBe(true);

    updateActiveBlog(99, 'alt-blog');
    await flush();

    expect(controller.getLikeState(9)).toBeUndefined();

    await controller.hydrateLikeStates([9]);
    expect(engagementApi.batchGetLikeStates).toHaveBeenCalledTimes(2);
  });

  it('applies optimistic like and unlike overlays before the network responds', async () => {
    let resolveLike!: (value: unknown) => void;
    let resolveUnlike!: (value: unknown) => void;

    const likePromise = new Promise((resolve) => {
      resolveLike = resolve;
    });
    const unlikePromise = new Promise((resolve) => {
      resolveUnlike = resolve;
    });

    const { controller, engagementApi } = createController({
      likePost: vi.fn().mockReturnValue(likePromise),
      unlikePost: vi.fn().mockReturnValue(unlikePromise),
    });

    setAuthUser({
      userId: 7,
      blogId: 11,
      activeBlogId: 11,
      blogs: [{ id: 11, name: 'alpha' }],
    });

    await controller.hydrateLikeStates([5]);
    expect(controller.getLikeState(5)).toBe(false);

    const likePending = controller.likePost(5);
    expect(controller.getLikeState(5)).toBe(true);

    resolveLike({ ok: true, action: 'like', postId: 5, actingBlogId: 11, state: { liked: true } });
    await likePending;
    expect(controller.getLikeState(5)).toBe(true);

    const unlikePending = controller.unlikePost(5);
    expect(controller.getLikeState(5)).toBe(false);

    resolveUnlike({ ok: true, action: 'unlike', postId: 5, actingBlogId: 11, state: { liked: false } });
    await unlikePending;
    expect(controller.getLikeState(5)).toBe(false);

    expect(engagementApi.likePost).toHaveBeenCalledWith({ postId: 5, actor: { token: 'test-token' } });
    expect(engagementApi.unlikePost).toHaveBeenCalledWith({ postId: 5, actor: { token: 'test-token' } });
  });

  it('notifies subscribers when shared like state changes and stops after unsubscribe', async () => {
    let resolveLike!: (value: unknown) => void;
    const likePromise = new Promise((resolve) => {
      resolveLike = resolve;
    });

    const { controller } = createController({
      likePost: vi.fn().mockReturnValue(likePromise),
    });

    setAuthUser({
      userId: 7,
      blogId: 11,
      activeBlogId: 11,
      blogs: [{ id: 11, name: 'alpha' }],
    });

    await controller.hydrateLikeStates([21]);

    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    const pending = controller.likePost(21);
    expect(controller.getLikeState(21)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    resolveLike({ ok: true, action: 'like', postId: 21, actingBlogId: 11, state: { liked: true } });
    await pending;

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers when a failed optimistic toggle rolls state back', async () => {
    const { controller } = createController({
      likePost: vi.fn().mockRejectedValue(new Error('network down')),
    });

    setAuthUser({
      userId: 7,
      blogId: 11,
      activeBlogId: 11,
      blogs: [{ id: 11, name: 'alpha' }],
    });

    await controller.hydrateLikeStates([31]);
    expect(controller.getLikeState(31)).toBe(false);

    const listener = vi.fn();
    controller.subscribe(listener);

    await expect(controller.likePost(31)).rejects.toThrow('network down');

    expect(controller.getLikeState(31)).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale mutation response after the actor switches', async () => {
    let resolveLike!: (value: unknown) => void;
    const likePromise = new Promise((resolve) => {
      resolveLike = resolve;
    });

    const { controller } = createController({
      likePost: vi.fn().mockReturnValue(likePromise),
    });

    setAuthUser({
      userId: 7,
      blogId: 11,
      activeBlogId: 11,
      blogs: [
        { id: 11, name: 'alpha' },
        { id: 22, name: 'beta' },
      ],
    });

    await controller.hydrateLikeStates([7]);

    const pending = controller.likePost(7);
    expect(controller.getLikeState(7)).toBe(true);

    updateActiveBlog(22, 'beta');
    await flush();
    expect(controller.getLikeState(7)).toBeUndefined();

    resolveLike({ ok: true, action: 'like', postId: 7, actingBlogId: 11, state: { liked: true } });
    await pending;

    updateActiveBlog(11, 'alpha');
    await flush();
    expect(controller.getLikeState(7)).toBeUndefined();
  });

  it('keeps the newest toggle response when requests resolve out of order', async () => {
    let resolveLike!: (value: unknown) => void;
    let resolveUnlike!: (value: unknown) => void;

    const likePromise = new Promise((resolve) => {
      resolveLike = resolve;
    });
    const unlikePromise = new Promise((resolve) => {
      resolveUnlike = resolve;
    });

    const { controller } = createController({
      likePost: vi.fn().mockReturnValue(likePromise),
      unlikePost: vi.fn().mockReturnValue(unlikePromise),
    });

    setAuthUser({
      userId: 7,
      blogId: 11,
      activeBlogId: 11,
      blogs: [{ id: 11, name: 'alpha' }],
    });

    await controller.hydrateLikeStates([8]);

    const likePending = controller.likePost(8);
    expect(controller.getLikeState(8)).toBe(true);

    const unlikePending = controller.unlikePost(8);
    expect(controller.getLikeState(8)).toBe(false);

    resolveLike({ ok: true, action: 'like', postId: 8, actingBlogId: 11, state: { liked: true } });
    await flush();
    expect(controller.getLikeState(8)).toBe(false);

    resolveUnlike({ ok: true, action: 'unlike', postId: 8, actingBlogId: 11, state: { liked: false } });
    await unlikePending;
    await likePending;
    expect(controller.getLikeState(8)).toBe(false);
  });

  it('clear resets versioning so stale completions cannot repopulate cleared state', async () => {
    let resolveLike!: (value: unknown) => void;
    const likePromise = new Promise((resolve) => {
      resolveLike = resolve;
    });

    const { controller } = createController({
      likePost: vi.fn().mockReturnValue(likePromise),
    });

    setAuthUser({
      userId: 7,
      blogId: 11,
      activeBlogId: 11,
      blogs: [{ id: 11, name: 'alpha' }],
    });

    await controller.hydrateLikeStates([12]);

    const pending = controller.likePost(12);
    expect(controller.getLikeState(12)).toBe(true);

    controller.clear();
    expect(controller.getLikeState(12)).toBeUndefined();

    resolveLike({ ok: true, action: 'like', postId: 12, actingBlogId: 11, state: { liked: true } });
    await pending;

    expect(controller.getLikeState(12)).toBeUndefined();
  });
});

describe('engagement-state api helpers', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/base');
    const getItem = vi.fn((key: string) => {
      if (key === 'bdsmlr_token') return 'token-123';
      if (key === 'bdsmlr_token_expiry') return String(Math.floor(Date.now() / 1000) + 3600);
      return null;
    });
    const setItem = vi.fn();
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem, setItem, removeItem });
    vi.stubGlobal('window', {
      location: { origin: 'https://client.example.test', search: '' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn());
  });

  it('keeps like helpers on the configured API base', async () => {
    vi.resetModules();
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
      headers: { get: () => null },
    } as unknown as Response);

    const { likePost, unlikePost } = await import('../src/services/api.js');

    await likePost({ postId: 1, actor: { token: 'abc' } });
    await unlikePost({ postId: 1, actor: { token: 'abc' } });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/base/v2/internal-write/like',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/base/v2/internal-write/unlike',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
