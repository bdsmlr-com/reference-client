import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { recService, type RecResult, type SimilarPostsResponse } from '../services/recommendation-api.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import type { Post } from '../types/api.js';
import { repeat } from 'lit/directives/repeat.js';
import { scrollObserver } from '../services/scroll-observer.js';
import { isAdminMode } from '../services/blog-resolver.js';
import { resolveLink } from '../services/link-resolver.js';
import { applyRetrievalPostPolicies, resolveRetrievalClickMode, type RetrievalPostPolicyMap } from '../services/retrieval-presentation.js';
import type { PostRouteSource } from '../services/post-route-context.js';
import './post-grid.js';
import './load-footer.js';
import './loading-spinner.js';

const RECS_PAGE_SIZE = 20;

export interface RecommendationHydrationDeps {
  batchGetPosts: (postIds: number[]) => Promise<{ posts?: ProcessedPost[] }>;
  getPost: (postId: number) => Promise<{ post?: ProcessedPost }>;
}

function buildCanonicalRecommendationItems(
  posts: Post[],
  policies: RetrievalPostPolicyMap | undefined,
): RecResult[] {
  const normalizedPosts = applyRetrievalPostPolicies(
    posts.map((post) => {
      const processed = { ...post } as ProcessedPost;
      processed._media = extractMedia(processed);
      return processed;
    }),
    policies,
  );

  return normalizedPosts.map((post) => ({
    post_id: post.id,
    post_owner: post.blogName,
    similarity_score: 0,
    _hydratedPost: post,
  })) as RecResult[];
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
    return buildCanonicalRecommendationItems(response.posts, response.postPolicies);
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
  @property({ type: String }) mode: 'grid' | 'list' = 'grid';
  @property({ type: String }) perspectiveBlogName = '';
  @property({ type: String }) title = 'More like this ✨';
  @property({ type: Boolean }) showBrowseLink = false;
  @property({ type: String }) from: PostRouteSource = 'direct';

  @state() private relatedPosts: RecResult[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private infiniteScroll = false;
  @state() private error = '';

  private currentAbortController: AbortController | null = null;
  private seenIds = new Set<number>();
  private nextOffset = 0;

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
    if (sentinel) {
      scrollObserver.unobserve(sentinel);
    }
  }

  protected firstUpdated(): void {
    if (this.postId) {
      this.resetAndFetch();
    }
    
    const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
    if (sentinel) {
      scrollObserver.observe(sentinel, () => {
        if (this.infiniteScroll && !this.loading && !this.exhausted) {
          this.fetchMore();
        }
      });
    }
  }

  updated(changedProperties: Map<string, any>): void {
    if (changedProperties.has('postId')) {
      this.resetAndFetch();
    }
  }

  private async resetAndFetch() {
    const id = this.getNormalizedPostId();
    if (!id) {
      this.relatedPosts = [];
      this.seenIds.clear();
      return;
    }
    
    // Cancel any in-flight request
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;
    
    this.relatedPosts = [];
    this.seenIds.clear();
    this.nextOffset = 0;
    this.exhausted = false;
    this.loading = false;
    this.error = '';
    
    await this.fetchMore(signal);
  }

  private getNormalizedPostId(): number {
    if (typeof this.postId === 'number') return this.postId;
    if (typeof this.postId === 'string') return parseInt(this.postId, 10) || 0;
    return 0;
  }

  private async fetchMore(signal?: AbortSignal) {
    const id = this.getNormalizedPostId();
    if (!id || this.loading || this.exhausted) return;
    
    // If we're called manually (e.g. Load More button), use the current controller's signal
    const fetchSignal = signal || this.currentAbortController?.signal;

    this.loading = true;
    this.error = '';

    try {
      const requestOffset = this.nextOffset;
      const recs = await recService.getSimilarPosts(
        id,
        RECS_PAGE_SIZE,
        requestOffset,
        this.perspectiveBlogName || undefined,
      );
      
      if (fetchSignal?.aborted) return;

      const items = await materializeRecommendationItems(recs, {
        batchGetPosts: async (postIds) => {
          const batchResp = await apiClient.posts.batchGet({ post_ids: postIds });
          return { posts: batchResp.posts as ProcessedPost[] | undefined };
        },
        getPost: async (postId) => {
          const resp = await apiClient.posts.get(postId);
          return { post: resp.post as ProcessedPost | undefined };
        },
      });

      if (fetchSignal?.aborted) return;

      if (items.length === 0) {
        this.exhausted = true;
        return;
      }
      this.nextOffset += RECS_PAGE_SIZE;

      // De-duplicate items before appending
      const newItems = items.filter(r => r.post_id && !this.seenIds.has(r.post_id));
      newItems.forEach(r => { if (r.post_id) this.seenIds.add(r.post_id); });

      this.relatedPosts = [...this.relatedPosts, ...newItems];
      if (items.length < RECS_PAGE_SIZE || this.relatedPosts.length >= 96) {
        this.exhausted = true;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      console.error('Failed to fetch recommendations', e);
      this.error = 'Failed to load related posts.';
    } finally {
      this.loading = false;
    }
  }

  private handleInfiniteToggle(e: CustomEvent) {
    this.infiniteScroll = e.detail.enabled;
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

  render() {
    const id = this.getNormalizedPostId();
    if (!id) return nothing;

    const isAdmin = isAdminMode();

    return html`
      ${isAdmin ? html`<div style="font-family:monospace; font-size:10px; color:#00ff00; background:#000; padding:2px 4px; border-radius:4px; margin-bottom:8px;">[REC_DEBUG: id=${id}, count=${this.relatedPosts.length}, loading=${this.loading}]</div>` : ''}
      ${this.title || this.showBrowseLink
        ? html`
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:24px;">
              ${this.title ? html`<h3 style="margin:0;">${this.title}</h3>` : html`<span></span>`}
              ${this.showBrowseLink
                ? html`<a href="/post/${id}/related" style="color:var(--accent); text-decoration:none; font-size:14px;">See more...</a>`
                : nothing}
            </div>
          `
        : nothing}
      
      ${this.error ? html`<div class="error-text" style="color: var(--error); font-size: 13px; margin-bottom: 16px;">${this.error}</div>` : ''}

      ${this.mode === 'grid'
        ? html`
            <div class="flat-results">
              <post-grid
                .posts=${this.relatedPosts
                  .map((r) => (r as any)._hydratedPost as ProcessedPost | undefined)
                  .filter((post): post is ProcessedPost => !!post)}
                .page=${'search'}
                .mode=${'grid'}
              ></post-grid>
            </div>
          `
        : html`
            <div class="gutter-grid">
              ${repeat(this.relatedPosts, r => r.post_id, r => {
                const h = (r as any)._hydratedPost;
                if (!h) return html`<div class="gutter-skeleton"></div>`;
                const postLink = resolveLink('recommendation_post', { postId: h.id });
                const raw = h._media?.url || h._media?.videoUrl || h.content?.thumbnail;
                const blogLabel = `${h.blogName || h.originBlogName || ''}`.trim();
                return html`
                  <div class="gutter-item" @click=${(event: Event) => this.navigateToRelated(r, event)}>
                    <div class="rec-media">
                      <media-renderer .src=${raw} .type=${'gutter'}></media-renderer>
                    </div>
                    <div class="rec-meta">
                      ${blogLabel ? html`<span class="rec-blog">@${blogLabel.replace(/^@+/, '')}</span>` : html`<span></span>`}
                      <span title=${postLink.title || nothing}>${postLink.label || h.id}${postLink.icon ? ` ${postLink.icon}` : ''}</span>
                    </div>
                  </div>
                `;
              })}
              ${this.loading && this.relatedPosts.length === 0 ? 
                Array(6).fill(0).map(() => html`<div class="gutter-skeleton"></div>`) : nothing}
            </div>
          `}

      <load-footer
        .mode=${this.mode}
        .loading=${this.loading}
        .exhausted=${this.exhausted}
        .loadingTarget=${RECS_PAGE_SIZE}
        .infiniteScroll=${this.infiniteScroll}
        .pageName=${'post-recommendations'}
        @load-more=${() => this.fetchMore()}
        @infinite-toggle=${this.handleInfiniteToggle}
      ></load-footer>

      <div id="scroll-sentinel"></div>
    `;
  }
}
