import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import type { Post } from '../types/api.js';
import { materializeApiPosts } from '../services/content-results.js';
import type { RecResult, SimilarPostsResponse } from '../services/recommendation-types.js';
import { describePrimaryMediaForSurface, extractMedia, type ProcessedPost } from '../types/post.js';
import { shouldObscureMedia } from '../services/media-redaction.js';
import { repeat } from 'lit/directives/repeat.js';
import { scrollObserver } from '../services/scroll-observer.js';
import { isAdminMode } from '../services/blog-resolver.js';
import { ApiError, isRelatedPerspectiveNotIndexedError } from '../services/api-error.js';
import { resolveLink } from '../services/link-resolver.js';
import { applyRetrievalPostPolicies, resolveRetrievalClickMode, type RetrievalPostPolicyMap } from '../services/retrieval-presentation.js';
import { buildPostHref, type PostRouteSource } from '../services/post-route-context.js';
import type { PostClickEvent } from '../types/events.js';
import {
  relatedPerspectiveHref,
  relatedPerspectiveLabel,
  type RelatedPerspective,
} from '../services/related-perspective.js';
import './post-grid.js';
import './load-footer.js';
import './loading-spinner.js';

const RECS_PAGE_SIZE = 20;
const VISIBLE_RELATED_CARD_COUNT = 12;
const RELATED_MEDIA_HYDRATION_REFERENCE_LIMIT = 100;
const NOT_INDEXED_SUPPRESSION_MS = 7 * 24 * 60 * 60 * 1000;
const NOT_INDEXED_STORAGE_PREFIX = 'related-perspective-not-indexed:';

function perspectivesMatch(left: RelatedPerspective, right: RelatedPerspective): boolean {
  if (left.blogId && right.blogId) return left.blogId === right.blogId;
  return left.role === right.role && left.blogName.trim().toLowerCase() === right.blogName.trim().toLowerCase();
}

function responsePerspective(value: unknown): RelatedPerspective | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const metadata = value as Record<string, unknown>;
  const role = metadata.role;
  const blogName = typeof metadata.blogName === 'string' ? metadata.blogName.trim() : '';
  if ((role !== 'viewer' && role !== 'original' && role !== 'reblogger') || !blogName) {
    return undefined;
  }

  return {
    role,
    blogName,
    blogId: typeof metadata.blogId === 'number' && metadata.blogId > 0 ? metadata.blogId : undefined,
    fallbackApplied: metadata.fallbackApplied === true,
  };
}

type RecommendationState =
  | { kind: 'loading' }
  | { kind: 'success' }
  | { kind: 'empty' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'temporary-failure'; message: string };

export interface RecommendationHydrationDeps {
  batchGetPosts: (postIds: number[]) => Promise<{ posts?: ProcessedPost[] }>;
  getPost: (postId: number) => Promise<{ post?: ProcessedPost }>;
}

function hasRecommendationIdentity(post: Post | ProcessedPost): boolean {
  return Boolean(`${post.blogName || post.originBlogName || ''}`.trim());
}

async function hydrateLegacyRecommendationItems(
  recs: RecResult[],
  policies: RetrievalPostPolicyMap | undefined,
  deps: RecommendationHydrationDeps,
): Promise<RecResult[]> {
  const normalized = recs.map((r) => {
    const rawId = r.post_id || (r as any).id;
    if (rawId) {
      r.post_id = typeof rawId === 'string' ? parseInt(rawId, 10) : rawId;
    }
    return r;
  });

  const postIds = normalized
    .map((r) => r.post_id)
    .filter((pid): pid is number => !!pid)
    .filter((pid, idx, arr) => arr.indexOf(pid) === idx);

  if (postIds.length > 0) {
    const hydratedMap = new Map<number, ProcessedPost>();

    try {
      const batchResp = await deps.batchGetPosts(postIds);
      (batchResp.posts || []).forEach((p) => {
        const processed = p as ProcessedPost;
        processed._media = extractMedia(processed);
        hydratedMap.set(processed.id, processed);
      });
    } catch {
      const hydratedPosts = await Promise.allSettled(
        postIds.map(async (postId) => {
          const resp = await deps.getPost(postId);
          const post = resp.post as ProcessedPost | undefined;
          if (!post) return null;
          post._media = extractMedia(post);
          return post;
        }),
      );

      hydratedPosts.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          hydratedMap.set(result.value.id, result.value);
        }
      });
    }

    const hydratedPosts = applyRetrievalPostPolicies([...hydratedMap.values()], policies);
    hydratedPosts.forEach((hydrated) => {
      hydratedMap.set(hydrated.id, hydrated);
    });

    normalized.forEach((r) => {
      if (!r.post_id) return;
      const hydrated = hydratedMap.get(r.post_id);
      if (hydrated) {
        (r as any)._hydratedPost = hydrated;
      }
    });
  }

  return normalized.filter((r) => !!r.post_id && !!(r as any)._hydratedPost) as RecResult[];
}

export async function materializeRecommendationItems(
  response: SimilarPostsResponse,
  deps: RecommendationHydrationDeps,
): Promise<RecResult[]> {
  if (Array.isArray(response.posts) && response.posts.length > 0) {
    const canonicalPosts = materializeApiPosts(response.posts, response.postPolicies);
    const canonical = canonicalPosts.map((post) => ({
      post_id: post.id,
      post_owner: post.blogName,
      similarity_score: 0,
      _hydratedPost: post,
    })) as RecResult[];
    const missingIdentityIds = canonical
      .map((item) => (item as any)._hydratedPost as ProcessedPost | undefined)
      .filter((post): post is ProcessedPost => !!post)
      .filter((post) => !hasRecommendationIdentity(post))
      .map((post) => post.id)
      .filter((id, index, all) => all.indexOf(id) === index);

    if (!missingIdentityIds.length) {
      return canonical;
    }

    const hydratedMap = new Map<number, ProcessedPost>();
    try {
      const batchResp = await deps.batchGetPosts(missingIdentityIds);
      applyRetrievalPostPolicies(batchResp.posts || [], response.postPolicies).forEach((post) => {
        const processed = post as ProcessedPost;
        processed._media = extractMedia(processed);
        hydratedMap.set(processed.id, processed);
      });
    } catch {
      // Fall through to per-post hydration below.
    }

    const finalMissingIdentityIds = missingIdentityIds.filter((postId) => {
      const hydrated = hydratedMap.get(postId);
      return !hydrated || !hasRecommendationIdentity(hydrated);
    });

    if (finalMissingIdentityIds.length) {
      const postResults = await Promise.allSettled(
        finalMissingIdentityIds.map(async (postId) => {
          const resp = await deps.getPost(postId);
          const post = resp.post as ProcessedPost | undefined;
          if (!post) return null;
          post._media = extractMedia(post);
          return post;
        }),
      );

      applyRetrievalPostPolicies(
        postResults
          .filter((result): result is PromiseFulfilledResult<ProcessedPost | null> => result.status === 'fulfilled')
          .map((result) => result.value)
          .filter((post): post is ProcessedPost => !!post),
        response.postPolicies,
      ).forEach((post) => {
        const processed = post as ProcessedPost;
        processed._media = extractMedia(processed);
        hydratedMap.set(processed.id, processed);
      });
    }

    return canonical.map((item) => {
      if (!item.post_id) return item;
      const hydrated = hydratedMap.get(item.post_id);
      if (!hydrated) return item;
      return {
        ...item,
        post_owner: hydrated.blogName || item.post_owner,
        _hydratedPost: hydrated,
      };
    });
  }

  const legacy = response.similar_posts || response.recommendations || [];
  return hydrateLegacyRecommendationItems(legacy, response.postPolicies, deps);
}

@customElement('post-recommendations')
export class PostRecommendations extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host { display: block; margin-top: 40px; }
      h3 { margin-bottom: 24px; font-size: 1.5rem; }
      .perspective-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
      }
      .perspective-tab {
        border: 1px solid var(--border);
        border-radius: 4px;
        background: var(--bg-panel);
        color: var(--text-muted);
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        padding: 6px 10px;
      }
      .perspective-tab.active {
        border-color: var(--accent);
        color: var(--text);
      }
      .gutter-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 16px;
      }
      .gutter-item {
        aspect-ratio: 1/1;
        background: var(--bg-panel-alt);
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        border: 1px solid var(--border);
        transition: transform 0.2s, border-color 0.2s;
        display: flex;
        flex-direction: column;
      }
      .rec-media {
        flex: 1;
        min-height: 0;
      }
      .rec-meta {
        font-size: 11px;
        color: var(--text-muted);
        background: var(--bg-panel);
        border-top: 1px solid var(--border);
        padding: 6px 8px;
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .rec-blog {
        color: var(--accent);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .gutter-item:hover {
        transform: scale(1.02);
        border-color: var(--accent);
      }
      .gutter-skeleton {
        aspect-ratio: 1/1;
        background: var(--bg-panel-alt);
        border-radius: 8px;
        animation: pulse 2s infinite;
      }
      .flat-results {
        margin: 0 -16px;
      }
      #scroll-sentinel {
        height: 20px;
        margin-top: 20px;
      }
      @keyframes pulse {
        0% { opacity: 0.5; }
        50% { opacity: 0.8; }
        100% { opacity: 0.5; }
      }
    `
  ];

  @property({ type: Number }) postId = 0;
  @property({ type: Number }) relatedRoutePostId = 0;
  @property({ type: Number }) displayedReblogPostId = 0;
  @property({ type: String }) mode: 'grid' | 'list' = 'grid';
  @property({ type: Object }) perspective?: RelatedPerspective;
  @property({ type: Array }) perspectives: RelatedPerspective[] = [];
  @property({ type: String }) title = '';
  @property({ type: Boolean }) showBrowseLink = false;
  @property({ type: String }) from: PostRouteSource = 'direct';

  @state() private relatedPosts: RecResult[] = [];
  @state() private state: RecommendationState = { kind: 'loading' };
  @state() private loadingMore = false;
  @state() private exhausted = false;
  @state() private infiniteScroll = false;
  @state() private effectivePerspective?: RelatedPerspective;
  @state() private focusedPerspectiveRole = '';

  private currentAbortController: AbortController | null = null;
  private requestToken = 0;
  private requestKey = '';
  private seenIds = new Set<number>();
  private nextPageToken: string | undefined;
  private fallbackUsed = false;

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.currentAbortController?.abort();
    this.currentAbortController = null;
    this.requestToken += 1;
    const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
    if (sentinel) {
      scrollObserver.unobserve(sentinel);
    }
  }

  protected firstUpdated(): void {
    const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
    if (sentinel) {
      scrollObserver.observe(sentinel, () => {
        if (this.infiniteScroll && !this.loadingMore && !this.exhausted && this.state.kind === 'success') {
          this.fetchMore();
        }
      });
    }
  }

  updated(changedProperties: Map<string, any>): void {
    if (changedProperties.has('postId') || changedProperties.has('perspective') || changedProperties.has('displayedReblogPostId')) {
      const nextKey = this.getRequestKey();
      if (nextKey === this.requestKey) return;
      this.requestKey = nextKey;
      this.resetAndFetch();
    }
  }

  private async resetAndFetch(fromFallback = false) {
    const id = this.getNormalizedPostId();
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.currentAbortController = new AbortController();
    const token = ++this.requestToken;

    this.relatedPosts = [];
    this.seenIds.clear();
    this.nextPageToken = undefined;
    this.exhausted = false;
    this.loadingMore = false;
    if (!fromFallback) this.fallbackUsed = false;

    if (!id) return;
    if (!this.perspective) {
      this.state = {
        kind: 'unavailable',
        message: 'Recommendations are unavailable for the selected blog.',
      };
      return;
    }

    if (this.isPerspectiveSuppressed(this.perspective)) {
      const fallback = this.selectNotIndexedFallback(this.perspective);
      if (!fallback) {
        this.effectivePerspective = undefined;
        this.state = {
          kind: 'unavailable',
          message: 'Recommendations are unavailable for the selected blog.',
        };
        return;
      }
      this.perspective = fallback;
      this.requestKey = this.getRequestKey();
    }

    this.effectivePerspective = this.perspective;
    this.state = { kind: 'loading' };
    await this.fetchMore(token, true);
  }

  private getNormalizedPostId(): number {
    if (typeof this.postId === 'number') return this.postId;
    if (typeof this.postId === 'string') return parseInt(this.postId, 10) || 0;
    return 0;
  }

  private getRequestKey(): string {
    const id = this.getNormalizedPostId();
    const perspective = this.perspective;
    const displayedReblogPostId = this.getDisplayedReblogPostId();
    return perspective
      ? `${id}:${perspective.role}:${perspective.blogId ?? ''}:${perspective.blogName.trim().toLowerCase()}:${displayedReblogPostId}`
      : `${id}:unresolved`;
  }

  private getDisplayedReblogPostId(): number {
    const explicitId = typeof this.displayedReblogPostId === 'number'
      ? this.displayedReblogPostId
      : parseInt(String(this.displayedReblogPostId), 10) || 0;
    if (explicitId > 0) return explicitId;
    const routePostId = typeof this.relatedRoutePostId === 'number'
      ? this.relatedRoutePostId
      : parseInt(String(this.relatedRoutePostId), 10) || 0;
    return routePostId > 0 ? routePostId : 0;
  }

  private get relatedRouteId(): number {
    const routePostId = typeof this.relatedRoutePostId === 'number'
      ? this.relatedRoutePostId
      : parseInt(String(this.relatedRoutePostId), 10) || 0;
    return routePostId > 0 ? routePostId : this.getNormalizedPostId();
  }

  private get visiblePerspective(): RelatedPerspective | undefined {
    return this.effectivePerspective || this.perspective;
  }

  private get heading(): string {
    const perspective = this.visiblePerspective;
    return perspective ? `Related posts for ${relatedPerspectiveLabel(perspective)}` : this.title;
  }

  private isCurrentRequest(token: number): boolean {
    return token === this.requestToken && !this.currentAbortController?.signal.aborted;
  }

  private getFailureState(error: unknown): RecommendationState {
    const apiError = error instanceof ApiError ? error : undefined;
    const message = error instanceof Error && error.message
      ? error.message
      : 'Recommendations are unavailable right now.';

    if (isRelatedPerspectiveNotIndexedError(apiError) || !apiError?.isRetryable) {
      return { kind: 'unavailable', message };
    }

    return { kind: 'temporary-failure', message };
  }

  private isPerspectiveSuppressed(perspective: RelatedPerspective): boolean {
    if (!perspective.blogId || typeof localStorage === 'undefined') return false;
    try {
      const raw = localStorage.getItem(`${NOT_INDEXED_STORAGE_PREFIX}${perspective.blogId}`);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { expiresAt?: unknown };
      const expiresAt = typeof parsed.expiresAt === 'number' ? parsed.expiresAt : 0;
      if (expiresAt > Date.now()) return true;
      localStorage.removeItem(`${NOT_INDEXED_STORAGE_PREFIX}${perspective.blogId}`);
    } catch {
      // Browser storage is optional for recommendation rendering.
    }
    return false;
  }

  private suppressPerspective(perspective: RelatedPerspective): void {
    if (!perspective.blogId || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        `${NOT_INDEXED_STORAGE_PREFIX}${perspective.blogId}`,
        JSON.stringify({ expiresAt: Date.now() + NOT_INDEXED_SUPPRESSION_MS }),
      );
    } catch {
      // Storage failure must not change the visible request result.
    }
  }

  private selectNotIndexedFallback(failed: RelatedPerspective): RelatedPerspective | undefined {
    const tabs = this.perspectives.filter((tab) => !this.isPerspectiveSuppressed(tab));
    const reblogger = tabs.find((tab) => tab.role === 'reblogger' && !perspectivesMatch(tab, failed));
    if (reblogger) return reblogger;
    const original = tabs.find((tab) => tab.role === 'original' && !perspectivesMatch(tab, failed));
    return original;
  }

  private async hydrateVisibleDocumentMedia(
    document: SimilarPostsResponse,
    perspective: RelatedPerspective,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    const posts = Array.isArray(document.posts) ? document.posts.slice(0, VISIBLE_RELATED_CARD_COUNT) : [];
    const references: Array<{ postId: number; path: string }> = [];
    const seen = new Set<string>();
    const addReference = (postId: number | undefined, media: any) => {
      const path = typeof media?.path === 'string' ? media.path : '';
      if (!postId || !path || seen.has(`${postId}:${path}`) || references.length >= RELATED_MEDIA_HYDRATION_REFERENCE_LIMIT) return;
      seen.add(`${postId}:${path}`);
      references.push({ postId, path });
    };

    posts.forEach((post: any) => {
      const postId = typeof post.id === 'number' ? post.id : undefined;
      (post.mediaRepresentation?.items || []).forEach((item: any) => {
        addReference(postId, item.original);
      });
    });

    if (!references.length) return;
    const hydration = await apiClient.posts.hydrateRelatedMedia(
      { references },
      { scope: perspective.role, signal },
    );
    const applyMediaUrl = (postId: number | undefined, item: any) => {
      const media = item?.original;
      const path = typeof media?.path === 'string' ? media.path : '';
      const urls = postId && path ? hydration.media[`${postId}:${path}`] : undefined;
      if (!urls) return;
      media.url = urls.original;
      if (urls.preview) media.previewUrl = urls.preview;
      if (Array.isArray(urls.alternates)) {
        (item.alternates || []).forEach((alternate: any, index: number) => {
          if (urls.alternates?.[index]) alternate.url = urls.alternates[index];
        });
      }
    };
    posts.forEach((post: any) => {
      const postId = typeof post.id === 'number' ? post.id : undefined;
      (post.mediaRepresentation?.items || []).forEach((item: any) => {
        applyMediaUrl(postId, item);
      });
    });
  }

  private async fetchMore(token = this.requestToken, initial = false) {
    const id = this.getNormalizedPostId();
    const perspective = this.perspective;
    if (!id || !perspective || this.loadingMore || this.exhausted || !this.isCurrentRequest(token)) return;

    this.loadingMore = !initial;

    try {
      const requestPageToken = this.nextPageToken;
      const displayedReblogPostId = this.getDisplayedReblogPostId();
      const recs = await apiClient.posts.relatedDocument({
        seed_post_id: id,
        perspective_role: perspective.role,
        perspective_blog_name: perspective.blogName,
        perspective_blog_id: perspective.blogId,
        ...(perspective.role === 'reblogger' && displayedReblogPostId
          ? { displayed_reblog_post_id: displayedReblogPostId }
          : {}),
        page_size: RECS_PAGE_SIZE,
        page_token: requestPageToken,
      }, { signal: this.currentAbortController?.signal });
      if (!this.isCurrentRequest(token)) return;
      this.effectivePerspective = responsePerspective(recs.recommendationPerspective) || perspective;

      await this.hydrateVisibleDocumentMedia(recs as SimilarPostsResponse, perspective, this.currentAbortController?.signal);
      if (!this.isCurrentRequest(token)) return;

      const items = await materializeRecommendationItems(recs as SimilarPostsResponse, {
        batchGetPosts: async (postIds) => {
          const batchResp = await apiClient.posts.batchGet({ post_ids: postIds });
          return { posts: batchResp.posts as ProcessedPost[] | undefined };
        },
        getPost: async (postId) => {
          const resp = await apiClient.posts.get(postId);
          return { post: resp.post as ProcessedPost | undefined };
        },
      });

      if (!this.isCurrentRequest(token)) return;

      if (items.length === 0) {
        this.exhausted = true;
        if (initial) this.state = { kind: 'empty' };
        return;
      }
      this.nextPageToken = recs.page?.nextPageToken;

      // De-duplicate items before appending
      const newItems = items.filter(r => r.post_id && !this.seenIds.has(r.post_id));
      newItems.forEach(r => { if (r.post_id) this.seenIds.add(r.post_id); });

      this.relatedPosts = [...this.relatedPosts, ...newItems];
      this.state = { kind: 'success' };
      if (!this.nextPageToken || this.relatedPosts.length >= 96) {
        this.exhausted = true;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError' || !this.isCurrentRequest(token)) return;
      const apiError = e instanceof ApiError ? e : undefined;
      if (isRelatedPerspectiveNotIndexedError(apiError)) {
        this.suppressPerspective(perspective);
        const fallback = !this.fallbackUsed ? this.selectNotIndexedFallback(perspective) : undefined;
        if (fallback) {
          this.fallbackUsed = true;
          this.perspective = fallback;
          this.requestKey = this.getRequestKey();
          await this.resetAndFetch(true);
          return;
        }
      }
      console.error('Failed to fetch recommendations', e);
      this.state = this.getFailureState(e);
    } finally {
      if (this.isCurrentRequest(token)) this.loadingMore = false;
    }
  }

  private handleInfiniteToggle(e: CustomEvent) {
    this.infiniteScroll = e.detail.enabled;
  }

  private selectPerspective(perspective: RelatedPerspective): void {
    if (this.perspective && perspectivesMatch(this.perspective, perspective)) {
      return;
    }
    this.perspective = perspective;
  }

  private relatedPerspectiveTabId(perspective: RelatedPerspective): string {
    return `inline-related-perspective-tab-${this.getNormalizedPostId()}-${perspective.role}`;
  }

  private handlePerspectiveTabKeydown(event: KeyboardEvent): void {
    const tab = event.currentTarget as HTMLButtonElement;
    const tabs = Array.from(this.shadowRoot?.querySelectorAll<HTMLButtonElement>('[role="tab"]') || []);
    const index = tabs.indexOf(tab);
    if (index < 0) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(index + direction + tabs.length) % tabs.length];
      this.focusedPerspectiveRole = next?.dataset.perspectiveRole || '';
      next?.focus();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const perspective = this.perspectives.find((candidate) => candidate.role === tab.dataset.perspectiveRole);
      if (perspective) this.selectPerspective(perspective);
    }
  }

  private navigateToRelated(rec: RecResult, event?: Event) {
    const hydrated = (rec as any)._hydratedPost;
    const mode = resolveRetrievalClickMode(hydrated?._retrievalPolicy);

    if (mode !== 'navigate') {
      event?.preventDefault();
      event?.stopPropagation();
      if (hydrated) {
        this.dispatchEvent(new CustomEvent('post-click', {
          detail: { post: hydrated, posts: [hydrated], index: 0, from: this.from },
          bubbles: true,
          composed: true,
        }));
      }
      return;
    }

    const id = rec.post_id;
    if (!id) return;

    const link = resolveLink('recommendation_post', { postId: id });
    if (link.target === '_blank') {
      window.open(link.href, '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.href = link.href;
  }

  private handleGridPostClick(e: PostClickEvent): void {
    e.stopPropagation();
    const post = e.detail.post;
    if (!post?.id) return;
    window.location.href = buildPostHref(post.id, this.from);
  }

  render() {
    const id = this.getNormalizedPostId();
    if (!id) return nothing;

    const isAdmin = isAdminMode();
    const isLoading = this.state.kind === 'loading';
    const isSuccess = this.state.kind === 'success';
    const heading = this.heading;
    const exploreHref = this.visiblePerspective
      ? relatedPerspectiveHref(this.relatedRouteId, this.visiblePerspective)
      : `/post/${this.relatedRouteId}/related`;
    const tabs = this.perspectives.filter((perspective) => !this.isPerspectiveSuppressed(perspective));
    const activeTabIndex = tabs.findIndex((perspective) => Boolean(this.visiblePerspective && perspectivesMatch(perspective, this.visiblePerspective)));
    const focusedRole = this.focusedPerspectiveRole || tabs[activeTabIndex]?.role || tabs[0]?.role || '';
    const panelId = `inline-related-perspective-panel-${id}`;

    return html`
      ${isAdmin ? html`<div style="font-family:monospace; font-size:10px; color:#00ff00; background:#000; padding:2px 4px; border-radius:4px; margin-bottom:8px;">[REC_DEBUG: id=${id}, count=${this.relatedPosts.length}, loading=${isLoading || this.loadingMore}]</div>` : ''}
      ${heading || this.showBrowseLink
        ? html`
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:24px;">
              ${heading ? html`<h3 style="margin:0;">${heading}</h3>` : html`<span></span>`}
              ${this.showBrowseLink
                ? html`<a href=${exploreHref} style="color:var(--accent); text-decoration:none; font-size:14px;">Explore perspectives</a>`
                : nothing}
            </div>
          `
        : nothing}

      ${tabs.length > 0
        ? html`<div class="perspective-tabs" role="tablist" aria-label="Related perspectives">
            ${tabs.map((perspective) => {
              const active = Boolean(this.visiblePerspective && perspectivesMatch(perspective, this.visiblePerspective));
              return html`
              <button
                id=${this.relatedPerspectiveTabId(perspective)}
                type="button"
                class="perspective-tab ${this.visiblePerspective?.role === perspective.role ? 'active' : ''}"
                role="tab"
                aria-selected=${active ? 'true' : 'false'}
                aria-controls=${panelId}
                tabindex=${focusedRole === perspective.role ? '0' : '-1'}
                data-perspective-role=${perspective.role}
                @click=${() => this.selectPerspective(perspective)}
                @keydown=${this.handlePerspectiveTabKeydown}
              >${relatedPerspectiveLabel(perspective)}</button>`;
            })}
          </div>`
        : nothing}

      <section
        id=${tabs.length > 0 ? panelId : nothing}
        role=${tabs.length > 0 ? 'tabpanel' : nothing}
        aria-labelledby=${tabs.length > 0 && this.visiblePerspective ? this.relatedPerspectiveTabId(this.visiblePerspective) : nothing}
      >
      ${this.state.kind === 'unavailable' || this.state.kind === 'temporary-failure'
        ? html`<div class="recommendation-status" role="status" style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">${this.state.message}${this.state.kind === 'temporary-failure' ? html` <button type="button" @click=${() => this.resetAndFetch()}>Retry</button>` : nothing}</div>`
        : nothing}

      ${this.state.kind === 'empty'
        ? html`<div class="recommendation-status" role="status" style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">No related posts found.</div>`
        : nothing}

      ${isLoading
        ? html`<div class="gutter-grid">${Array(6).fill(0).map(() => html`<div class="gutter-skeleton"></div>`)}</div>`
        : isSuccess && this.mode === 'grid'
        ? html`
            <div class="flat-results">
              <post-grid
                .posts=${this.relatedPosts
                  .map((r) => (r as any)._hydratedPost as ProcessedPost | undefined)
                  .filter((post): post is ProcessedPost => !!post)}
                .page=${'post'}
                .mode=${'grid'}
                @post-click=${this.handleGridPostClick}
              ></post-grid>
            </div>
          `
        : isSuccess ? html`
            <div class="gutter-grid">
              ${repeat(this.relatedPosts, r => r.post_id, r => {
                const h = (r as any)._hydratedPost;
                if (!h) return html`<div class="gutter-skeleton"></div>`;
                const postLink = resolveLink('recommendation_post', { postId: h.id });
                const mediaSource = describePrimaryMediaForSurface(h._media, 'preview');
                const raw = mediaSource?.src || '';
                const blogLabel = `${h.blogName || h.originBlogName || ''}`.trim();
                return html`
                  <div class="gutter-item" @click=${(event: Event) => this.navigateToRelated(r, event)}>
                    <div class="rec-media">
                      <media-renderer .src=${raw} .posterSrc=${mediaSource?.posterSrc} .alternateVideoSrc=${mediaSource?.alternateVideoSrc} .fallbackSrc=${mediaSource?.fallbackSrc} .forceImage=${mediaSource?.forceImage ?? false} .redacted=${shouldObscureMedia(h)} .type=${'gutter'}></media-renderer>
                    </div>
                    <div class="rec-meta">
                      ${blogLabel ? html`<span class="rec-blog">@${blogLabel.replace(/^@+/, '')}</span>` : html`<span></span>`}
                      <span title=${postLink.title || nothing}>${postLink.label || h.id}${postLink.icon ? ` ${postLink.icon}` : ''}</span>
                    </div>
                  </div>
                `;
              })}
              ${this.loadingMore ? Array(6).fill(0).map(() => html`<div class="gutter-skeleton"></div>`) : nothing}
            </div>
          ` : nothing}

      ${isSuccess ? html`<load-footer
        .mode=${this.mode}
        .loading=${this.loadingMore}
        .exhausted=${this.exhausted}
        .loadingTarget=${RECS_PAGE_SIZE}
        .infiniteScroll=${this.infiniteScroll}
        .pageName=${'post-recommendations'}
        @load-more=${() => this.fetchMore()}
        @infinite-toggle=${this.handleInfiniteToggle}
      ></load-footer>` : nothing}

      <div id="scroll-sentinel"></div>
      </section>
    `;
  }
}
