import { blockBlog, getBlocked, unblockBlog } from './api.js';
import { getAuthUser } from '../state/auth-state.js';
import type { BlockBlogRequest, BlockBlogResponse, GetBlockedRequest, GetBlockedResponse, UnblockBlogRequest, UnblockBlogResponse } from '../types/api.js';

type BlockApi = {
  getBlocked(req: GetBlockedRequest): Promise<GetBlockedResponse>;
  blockBlog(req: BlockBlogRequest): Promise<BlockBlogResponse>;
  unblockBlog(req: UnblockBlogRequest): Promise<UnblockBlogResponse>;
};

export interface BlockedStateDependencies {
  blockApi?: BlockApi;
  getAuthUser?: typeof getAuthUser;
}

export class BlockedStateController {
  private readonly blockApi: BlockApi;
  private readonly getAuthUserFn: typeof getAuthUser;
  private readonly listeners = new Set<() => void>();
  private blockedBlogIds = new Set<number>();
  private requestVersion = 0;
  private hydratedUserId: number | null = null;
  private readonly handleAuthUserChanged = () => this.clear();
  private readonly listening = typeof window !== 'undefined' && typeof window.addEventListener === 'function';

  constructor(deps: BlockedStateDependencies = {}) {
    if (!deps.blockApi) throw new Error('blockApi is required');
    this.blockApi = deps.blockApi;
    this.getAuthUserFn = deps.getAuthUser ?? getAuthUser;
    if (this.listening) {
      window.addEventListener('auth-user-changed', this.handleAuthUserChanged as EventListener);
    }
  }

  destroy(): void {
    if (this.listening) {
      window.removeEventListener('auth-user-changed', this.handleAuthUserChanged as EventListener);
    }
    this.listeners.clear();
  }

  clear(): void {
    this.blockedBlogIds.clear();
    this.hydratedUserId = null;
    this.requestVersion += 1;
    this.notifyListeners();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch (error) { console.error('Error in blocked-state listener', error); }
    }
  }

  private getCurrentUserId(): number | null {
    return this.getAuthUserFn()?.userId ?? null;
  }

  private getCurrentActorBlogId(): number | null {
    const user = this.getAuthUserFn();
    return user?.activeBlogId ?? user?.blogId ?? null;
  }

  private requireCurrentActorBlogId(): number {
    const actorBlogId = this.getCurrentActorBlogId();
    if (!actorBlogId) throw new Error('No active blog selected');
    return actorBlogId;
  }

  getBlockedState(targetBlogId: number): boolean | undefined {
    const userId = this.getCurrentUserId();
    if (!userId || this.hydratedUserId !== userId) return undefined;
    return this.blockedBlogIds.has(targetBlogId);
  }

  async hydrateBlockedState(targetBlogId: number): Promise<boolean | undefined> {
    const userId = this.getCurrentUserId();
    if (!userId) return undefined;
    if (this.hydratedUserId !== userId) {
      const version = ++this.requestVersion;
      const response = await this.blockApi.getBlocked({ user_id: userId });
      if (version === this.requestVersion) {
        this.hydratedUserId = userId;
        this.blockedBlogIds = new Set(response.blocked_blog_ids || []);
        this.notifyListeners();
      }
    }
    return this.blockedBlogIds.has(targetBlogId);
  }

  async blockBlog(targetBlogId: number): Promise<BlockBlogResponse> {
    const actorBlogId = this.requireCurrentActorBlogId();
    const previous = new Set(this.blockedBlogIds);
    this.blockedBlogIds.add(targetBlogId);
    this.notifyListeners();
    try {
      const response = await this.blockApi.blockBlog({ actingBlogId: actorBlogId, targetBlogId });
      return response;
    } catch (error) {
      this.blockedBlogIds = previous;
      this.notifyListeners();
      throw error;
    }
  }

  async unblockBlog(targetBlogId: number): Promise<UnblockBlogResponse> {
    const actorBlogId = this.requireCurrentActorBlogId();
    const previous = new Set(this.blockedBlogIds);
    this.blockedBlogIds.delete(targetBlogId);
    this.notifyListeners();
    try {
      const response = await this.blockApi.unblockBlog({ actingBlogId: actorBlogId, targetBlogId });
      return response;
    } catch (error) {
      this.blockedBlogIds = previous;
      this.notifyListeners();
      throw error;
    }
  }
}

export const blockedStateController = new BlockedStateController({
  blockApi: {
    getBlocked,
    blockBlog,
    unblockBlog,
  },
});
