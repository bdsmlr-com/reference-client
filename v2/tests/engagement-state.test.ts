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
});
