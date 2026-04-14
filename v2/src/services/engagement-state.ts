import { getAuthUser } from '../state/auth-state.js';
import { getValidToken } from './storage.js';
import type {
  BatchGetLikeStatesRequest,
  BatchGetLikeStatesResponse,
  LikePostRequest,
  LikePostResponse,
  UnlikePostRequest,
  UnlikePostResponse,
} from '../types/api.js';

type EngagementApi = {
  batchGetLikeStates(req: BatchGetLikeStatesRequest): Promise<BatchGetLikeStatesResponse>;
  likePost(req: LikePostRequest): Promise<LikePostResponse>;
  unlikePost(req: UnlikePostRequest): Promise<UnlikePostResponse>;
};

export interface LikeStateSnapshot {
  liked: boolean;
  source: 'server' | 'optimistic';
}

export interface EngagementStateDependencies {
  engagementApi?: EngagementApi;
  getAuthUser?: typeof getAuthUser;
  tokenProvider?: () => string | null;
}

export function buildLikeStateCacheKey(postId: number, actingBlogId: number): string {
  return `${postId}:${actingBlogId}`;
}

export class EngagementStateController {
  private readonly engagementApi: EngagementApi;
  private readonly getAuthUserFn: typeof getAuthUser;
  private readonly tokenProvider: () => string | null;
  private readonly likeStateCache = new Map<string, LikeStateSnapshot>();
  private readonly requestVersions = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private actorEpoch = 0;
  private readonly handleAuthUserChanged = () => {
    this.clear();
  };
  private readonly listening = typeof window !== 'undefined' && typeof window.addEventListener === 'function';

  constructor(deps: EngagementStateDependencies = {}) {
    if (!deps.engagementApi) {
      throw new Error('engagementApi is required');
    }
    this.engagementApi = deps.engagementApi;
    this.getAuthUserFn = deps.getAuthUser ?? getAuthUser;
    this.tokenProvider = deps.tokenProvider ?? getValidToken;

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
    this.likeStateCache.clear();
    this.requestVersions.clear();
    this.actorEpoch += 1;
    this.notifyListeners();
  }

  private getCurrentActorBlogId(): number | null {
    const user = this.getAuthUserFn();
    return user?.activeBlogId ?? user?.blogId ?? null;
  }

  private requireCurrentActorBlogId(): number {
    const actorBlogId = this.getCurrentActorBlogId();
    if (!actorBlogId) {
      throw new Error('No active blog selected');
    }
    return actorBlogId;
  }

  private requireActorToken(): string {
    const token = this.tokenProvider();
    if (!token) {
      throw new Error('No valid auth token available');
    }
    return token;
  }

  private applySnapshot(postId: number, actingBlogId: number, liked: boolean, source: LikeStateSnapshot['source']) {
    this.likeStateCache.set(buildLikeStateCacheKey(postId, actingBlogId), {
      liked,
      source,
    });
    this.notifyListeners();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.error('Error in engagement-state listener', error);
      }
    }
  }

  private beginRequest(postId: number, actingBlogId: number): { epoch: number; version: number; key: string } {
    const key = buildLikeStateCacheKey(postId, actingBlogId);
    const version = (this.requestVersions.get(key) ?? 0) + 1;
    this.requestVersions.set(key, version);
    return {
      epoch: this.actorEpoch,
      version,
      key,
    };
  }

  private isCurrentRequest(snapshot: { epoch: number; version: number; key: string }): boolean {
    return this.actorEpoch === snapshot.epoch && this.requestVersions.get(snapshot.key) === snapshot.version;
  }

  getLikeState(postId: number): boolean | undefined {
    const actorBlogId = this.getCurrentActorBlogId();
    if (!actorBlogId) {
      return undefined;
    }
    return this.likeStateCache.get(buildLikeStateCacheKey(postId, actorBlogId))?.liked;
  }

  async hydrateLikeStates(postIds: number[]): Promise<Map<number, boolean>> {
    const actorBlogId = this.getCurrentActorBlogId();
    const result = new Map<number, boolean>();
    if (!actorBlogId || postIds.length === 0) {
      return result;
    }

    const uniquePostIds = [...new Set(postIds)];
    const missingPostIds = uniquePostIds.filter(
      (postId) => !this.likeStateCache.has(buildLikeStateCacheKey(postId, actorBlogId))
    );
    const requestSnapshots = new Map<number, { epoch: number; version: number; key: string }>();
    for (const postId of missingPostIds) {
      requestSnapshots.set(postId, this.beginRequest(postId, actorBlogId));
    }

    if (missingPostIds.length > 0) {
      const response = await this.engagementApi.batchGetLikeStates({
        postIds: missingPostIds,
        actingBlogId: actorBlogId,
      });
      const returned = new Map<number, boolean>();

      for (const state of response.states ?? []) {
        returned.set(state.postId, state.liked);
        const snapshot = requestSnapshots.get(state.postId);
        if (snapshot && this.isCurrentRequest(snapshot)) {
          this.applySnapshot(state.postId, actorBlogId, state.liked, 'server');
        }
      }

      for (const postId of missingPostIds) {
        const snapshot = requestSnapshots.get(postId);
        if (!returned.has(postId) && snapshot && this.isCurrentRequest(snapshot)) {
          this.applySnapshot(postId, actorBlogId, false, 'server');
        }
      }
    }

    for (const postId of uniquePostIds) {
      const liked = this.getLikeState(postId);
      if (liked !== undefined) {
        result.set(postId, liked);
      }
    }

    return result;
  }

  async likePost(postId: number): Promise<LikePostResponse> {
    const actorBlogId = this.requireCurrentActorBlogId();
    const cacheKey = buildLikeStateCacheKey(postId, actorBlogId);
    const previous = this.likeStateCache.get(cacheKey);
    const requestSnapshot = this.beginRequest(postId, actorBlogId);

    this.applySnapshot(postId, actorBlogId, true, 'optimistic');

    try {
      const response = await this.engagementApi.likePost({
        postId,
        actor: { token: this.requireActorToken() },
      });
      if (this.isCurrentRequest(requestSnapshot)) {
        const liked = response.state?.liked ?? true;
        this.applySnapshot(postId, actorBlogId, liked, 'server');
      }
      return response;
    } catch (error) {
      if (this.isCurrentRequest(requestSnapshot)) {
        if (previous) {
          this.likeStateCache.set(cacheKey, previous);
        } else {
          this.likeStateCache.delete(cacheKey);
        }
      }
      throw error;
    }
  }

  async unlikePost(postId: number): Promise<UnlikePostResponse> {
    const actorBlogId = this.requireCurrentActorBlogId();
    const cacheKey = buildLikeStateCacheKey(postId, actorBlogId);
    const previous = this.likeStateCache.get(cacheKey);
    const requestSnapshot = this.beginRequest(postId, actorBlogId);

    this.applySnapshot(postId, actorBlogId, false, 'optimistic');

    try {
      const response = await this.engagementApi.unlikePost({
        postId,
        actor: { token: this.requireActorToken() },
      });
      if (this.isCurrentRequest(requestSnapshot)) {
        const liked = response.state?.liked ?? false;
        this.applySnapshot(postId, actorBlogId, liked, 'server');
      }
      return response;
    } catch (error) {
      if (this.isCurrentRequest(requestSnapshot)) {
        if (previous) {
          this.likeStateCache.set(cacheKey, previous);
        } else {
          this.likeStateCache.delete(cacheKey);
        }
      }
      throw error;
    }
  }
}

export function createEngagementStateController(
  engagementApi: EngagementApi,
  deps: Omit<EngagementStateDependencies, 'engagementApi'> = {}
): EngagementStateController {
  return new EngagementStateController({
    ...deps,
    engagementApi,
  });
}
