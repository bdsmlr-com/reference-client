import { blogFollowState, followBlog, unfollowBlog } from './api.js';
import { getAuthUser } from '../state/auth-state.js';
import type { BlogFollowStateRequest, BlogFollowStateResponse, FollowBlogRequest, FollowBlogResponse, UnfollowBlogRequest, UnfollowBlogResponse } from '../types/api.js';

type FollowApi = {
  getBlogFollowState(req: BlogFollowStateRequest): Promise<BlogFollowStateResponse>;
  followBlog(req: FollowBlogRequest): Promise<FollowBlogResponse>;
  unfollowBlog(req: UnfollowBlogRequest): Promise<UnfollowBlogResponse>;
};

export interface FollowStateDependencies {
  followApi?: FollowApi;
  getAuthUser?: typeof getAuthUser;
}

export interface FollowStateSnapshot {
  followed: boolean;
  source: 'server' | 'optimistic';
}

export function buildFollowStateCacheKey(targetBlogId: number, actingBlogId: number): string {
  return `follow:${targetBlogId}:${actingBlogId}`;
}

export class FollowStateController {
  private readonly followApi: FollowApi;
  private readonly getAuthUserFn: typeof getAuthUser;
  private readonly followStateCache = new Map<string, FollowStateSnapshot>();
  private readonly requestVersions = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private actorEpoch = 0;
  private readonly handleAuthUserChanged = () => this.clear();
  private readonly listening = typeof window !== 'undefined' && typeof window.addEventListener === 'function';

  constructor(deps: FollowStateDependencies = {}) {
    if (!deps.followApi) throw new Error('followApi is required');
    this.followApi = deps.followApi;
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
    this.followStateCache.clear();
    this.requestVersions.clear();
    this.actorEpoch += 1;
    this.notifyListeners();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch (error) { console.error('Error in follow-state listener', error); }
    }
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

  getFollowState(targetBlogId: number): boolean | undefined {
    const actorBlogId = this.getCurrentActorBlogId();
    if (!actorBlogId) return undefined;
    return this.followStateCache.get(buildFollowStateCacheKey(targetBlogId, actorBlogId))?.followed;
  }

  private applySnapshot(targetBlogId: number, actingBlogId: number, followed: boolean, source: FollowStateSnapshot['source']) {
    this.followStateCache.set(buildFollowStateCacheKey(targetBlogId, actingBlogId), { followed, source });
    this.notifyListeners();
  }

  private beginRequestForKey(key: string): { epoch: number; version: number; key: string } {
    const version = (this.requestVersions.get(key) ?? 0) + 1;
    this.requestVersions.set(key, version);
    return { epoch: this.actorEpoch, version, key };
  }

  private isCurrentRequest(snapshot: { epoch: number; version: number; key: string }): boolean {
    return this.actorEpoch === snapshot.epoch && this.requestVersions.get(snapshot.key) === snapshot.version;
  }

  async hydrateFollowState(targetBlogId: number): Promise<boolean | undefined> {
    const actorBlogId = this.getCurrentActorBlogId();
    if (!actorBlogId) return undefined;
    const cached = this.followStateCache.get(buildFollowStateCacheKey(targetBlogId, actorBlogId));
    if (cached) return cached.followed;
    const snapshot = this.beginRequestForKey(buildFollowStateCacheKey(targetBlogId, actorBlogId));
    const response = await this.followApi.getBlogFollowState({ actingBlogId: actorBlogId, targetBlogId });
    const followed = Boolean(response.isFollowed);
    if (this.isCurrentRequest(snapshot)) this.applySnapshot(targetBlogId, actorBlogId, followed, 'server');
    return followed;
  }

  async followBlog(targetBlogId: number): Promise<FollowBlogResponse> {
    const actorBlogId = this.requireCurrentActorBlogId();
    const cacheKey = buildFollowStateCacheKey(targetBlogId, actorBlogId);
    const previous = this.followStateCache.get(cacheKey);
    const snapshot = this.beginRequestForKey(cacheKey);
    this.applySnapshot(targetBlogId, actorBlogId, true, 'optimistic');
    try {
      const response = await this.followApi.followBlog({ actingBlogId: actorBlogId, targetBlogId });
      if (this.isCurrentRequest(snapshot)) this.applySnapshot(targetBlogId, actorBlogId, true, 'server');
      return response;
    } catch (error) {
      if (this.isCurrentRequest(snapshot)) {
        if (previous) this.followStateCache.set(cacheKey, previous);
        else this.followStateCache.delete(cacheKey);
        this.notifyListeners();
      }
      throw error;
    }
  }

  async unfollowBlog(targetBlogId: number): Promise<UnfollowBlogResponse> {
    const actorBlogId = this.requireCurrentActorBlogId();
    const cacheKey = buildFollowStateCacheKey(targetBlogId, actorBlogId);
    const previous = this.followStateCache.get(cacheKey);
    const snapshot = this.beginRequestForKey(cacheKey);
    this.applySnapshot(targetBlogId, actorBlogId, false, 'optimistic');
    try {
      const response = await this.followApi.unfollowBlog({ actingBlogId: actorBlogId, targetBlogId });
      if (this.isCurrentRequest(snapshot)) this.applySnapshot(targetBlogId, actorBlogId, false, 'server');
      return response;
    } catch (error) {
      if (this.isCurrentRequest(snapshot)) {
        if (previous) this.followStateCache.set(cacheKey, previous);
        else this.followStateCache.delete(cacheKey);
        this.notifyListeners();
      }
      throw error;
    }
  }
}

export const followStateController = new FollowStateController({
  followApi: {
    getBlogFollowState: blogFollowState,
    followBlog,
    unfollowBlog,
  },
});
