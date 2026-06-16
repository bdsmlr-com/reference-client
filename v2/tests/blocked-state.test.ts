import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthUser, setAuthUser } from '../src/state/auth-state.js';

class TestCustomEvent<T = unknown> extends Event {
  detail: T;
  constructor(type: string, init?: CustomEventInit<T>) {
    super(type, init);
    this.detail = init?.detail as T;
  }
}

let currentController: import('../src/services/blocked-state.js').BlockedStateController | null = null;

async function createController(api?: Partial<{
  getBlocked: ReturnType<typeof vi.fn>;
  blockBlog: ReturnType<typeof vi.fn>;
  unblockBlog: ReturnType<typeof vi.fn>;
}>) {
  const blockApi = {
    getBlocked: vi.fn().mockResolvedValue({ blocked_blog_ids: [22] }),
    blockBlog: vi.fn().mockResolvedValue({ ok: true, action: 'block', targetBlogId: 22, state: { blocked: true } }),
    unblockBlog: vi.fn().mockResolvedValue({ ok: true, action: 'unblock', targetBlogId: 22, state: { blocked: false } }),
    ...api,
  };
  const mod = await import('../src/services/blocked-state.js');
  currentController = new mod.BlockedStateController({ blockApi });
  return { controller: currentController, blockApi };
}

describe('blocked-state controller', () => {
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

  it('hydrates blocked blog ids once per user and serves boolean lookups', async () => {
    const { controller, blockApi } = await createController();
    setAuthUser({ userId: 7, blogId: 11, activeBlogId: 11, blogs: [{ id: 11, name: 'alpha' }] });

    await controller.hydrateBlockedState(22);
    expect(controller.getBlockedState(22)).toBe(true);
    expect(controller.getBlockedState(33)).toBe(false);
    expect(blockApi.getBlocked).toHaveBeenCalledWith({ user_id: 7 });
  });

  it('applies optimistic block and unblock updates', async () => {
    let resolveBlock!: (value: unknown) => void;
    let resolveUnblock!: (value: unknown) => void;
    const { controller, blockApi } = await createController({
      getBlocked: vi.fn().mockResolvedValue({ blocked_blog_ids: [] }),
      blockBlog: vi.fn().mockReturnValue(new Promise((resolve) => { resolveBlock = resolve; })),
      unblockBlog: vi.fn().mockReturnValue(new Promise((resolve) => { resolveUnblock = resolve; })),
    });
    setAuthUser({ userId: 7, blogId: 11, activeBlogId: 11, blogs: [{ id: 11, name: 'alpha' }] });

    await controller.hydrateBlockedState(22);
    expect(controller.getBlockedState(22)).toBe(false);

    const blockPending = controller.blockBlog(22);
    expect(controller.getBlockedState(22)).toBe(true);
    resolveBlock({ ok: true, action: 'block', targetBlogId: 22, state: { blocked: true } });
    await blockPending;

    const unblockPending = controller.unblockBlog(22);
    expect(controller.getBlockedState(22)).toBe(false);
    resolveUnblock({ ok: true, action: 'unblock', targetBlogId: 22, state: { blocked: false } });
    await unblockPending;

    expect(blockApi.blockBlog).toHaveBeenCalledWith({ actingBlogId: 11, targetBlogId: 22 });
    expect(blockApi.unblockBlog).toHaveBeenCalledWith({ actingBlogId: 11, targetBlogId: 22 });
  });
});
