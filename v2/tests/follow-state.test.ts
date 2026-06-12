import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthUser, setAuthUser, updateActiveBlog } from '../src/state/auth-state.js';

type FollowApi = {
  getBlogFollowState: ReturnType<typeof vi.fn>;
  followBlog: ReturnType<typeof vi.fn>;
  unfollowBlog: ReturnType<typeof vi.fn>;
};

class TestCustomEvent<T = unknown> extends Event {
  detail: T;

  constructor(type: string, init?: CustomEventInit<T>) {
    super(type, init);
    this.detail = init?.detail as T;
  }
}

let currentController: import('../src/services/follow-state.js').FollowStateController | null = null;

async function createController(api?: Partial<FollowApi>) {
  const followApi = {
    getBlogFollowState: vi.fn().mockResolvedValue({ ok: true, actingBlogId: 11, targetBlogId: 22, isFollowed: false }),
    followBlog: vi.fn().mockResolvedValue({ ok: true, action: 'follow', actingBlogId: 11, targetBlogId: 22, state: { followed: true } }),
    unfollowBlog: vi.fn().mockResolvedValue({ ok: true, action: 'unfollow', actingBlogId: 11, targetBlogId: 22, state: { followed: false } }),
    ...api,
  };

  const mod = await import('../src/services/follow-state.js');
  currentController = new mod.FollowStateController({ followApi });
  return { controller: currentController, followApi };
}

describe('follow-state controller', () => {
  beforeEach(() => {
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('CustomEvent', TestCustomEvent as unknown as typeof CustomEvent);
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() });
    clearAuthUser();
  });

  afterEach(() => {
    currentController?.destroy();
    currentController = null;
  });

  it('hydrates follow state against the active blog and keys by actor/target', async () => {
    const { controller, followApi } = await createController({
      getBlogFollowState: vi.fn().mockImplementation(async ({ actingBlogId, targetBlogId }) => ({
        ok: true,
        actingBlogId,
        targetBlogId,
        isFollowed: actingBlogId === 11 && targetBlogId === 22,
      })),
    });

    setAuthUser({
      userId: 7,
      blogId: 11,
      activeBlogId: 11,
      blogs: [{ id: 11, name: 'alpha' }, { id: 33, name: 'beta' }],
    });

    await controller.hydrateFollowState(22);
    expect(controller.getFollowState(22)).toBe(true);

    updateActiveBlog(33, 'beta');
    await controller.hydrateFollowState(22);
    expect(controller.getFollowState(22)).toBe(false);

    expect(followApi.getBlogFollowState.mock.calls[0][0]).toEqual({ actingBlogId: 11, targetBlogId: 22 });
    expect(followApi.getBlogFollowState.mock.calls[1][0]).toEqual({ actingBlogId: 33, targetBlogId: 22 });
  });

  it('applies optimistic follow and unfollow overlays before the network responds', async () => {
    let resolveFollow!: (value: unknown) => void;
    let resolveUnfollow!: (value: unknown) => void;

    const { controller, followApi } = await createController({
      followBlog: vi.fn().mockReturnValue(new Promise((resolve) => { resolveFollow = resolve; })),
      unfollowBlog: vi.fn().mockReturnValue(new Promise((resolve) => { resolveUnfollow = resolve; })),
    });

    setAuthUser({ userId: 7, blogId: 11, activeBlogId: 11, blogs: [{ id: 11, name: 'alpha' }] });

    await controller.hydrateFollowState(22);
    expect(controller.getFollowState(22)).toBe(false);

    const followPending = controller.followBlog(22);
    expect(controller.getFollowState(22)).toBe(true);
    resolveFollow({ ok: true, action: 'follow', actingBlogId: 11, targetBlogId: 22, state: { followed: true } });
    await followPending;

    const unfollowPending = controller.unfollowBlog(22);
    expect(controller.getFollowState(22)).toBe(false);
    resolveUnfollow({ ok: true, action: 'unfollow', actingBlogId: 11, targetBlogId: 22, state: { followed: false } });
    await unfollowPending;

    expect(followApi.followBlog).toHaveBeenCalledWith({ actingBlogId: 11, targetBlogId: 22 });
    expect(followApi.unfollowBlog).toHaveBeenCalledWith({ actingBlogId: 11, targetBlogId: 22 });
  });
});
