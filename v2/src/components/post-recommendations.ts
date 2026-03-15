import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { recService, type RecResult } from '../services/recommendation-api.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import { repeat } from 'lit/directives/repeat.js';
import './media-renderer.js';
import './load-footer.js';
import './loading-spinner.js';

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
      @keyframes pulse {
        0% { opacity: 0.5; }
        50% { opacity: 0.8; }
        100% { opacity: 0.5; }
      }
    `
  ];

  @property({ type: Number }) postId = 0;
  @property({ type: String }) mode: 'grid' | 'list' = 'grid';

  @state() private relatedPosts: RecResult[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private infiniteScroll = false;

  private currentFetchId = 0;
  private seenIds = new Set<number>();

  protected firstUpdated(): void {
    if (this.postId) {
      this.resetAndFetch();
    }
  }

  updated(changedProperties: Map<string, any>): void {
    if (changedProperties.has('postId')) {
      this.resetAndFetch();
    }
  }

  private async resetAndFetch() {
    const id = typeof this.postId === 'string' ? parseInt(this.postId, 10) : this.postId;
    if (!id) return;
    
    this.currentFetchId++;
    const fetchId = this.currentFetchId;
    
    this.relatedPosts = [];
    this.seenIds.clear();
    this.exhausted = false;
    this.loading = false;
    
    await this.fetchMore(fetchId);
  }

  private async fetchMore(fetchId?: number) {
    const id = typeof this.postId === 'string' ? parseInt(this.postId, 10) : this.postId;
    if (!id || this.loading || this.exhausted) return;
    
    // If we were called with a specific fetchId, ensure it's still current
    if (fetchId !== undefined && fetchId !== this.currentFetchId) return;

    this.loading = true;
    const currentId = this.currentFetchId;

    try {
      const recs = await recService.getSimilarPosts(id, 12, this.relatedPosts.length);
      
      // Abandon if a new fetch has started in the meantime
      if (currentId !== this.currentFetchId) return;

      if (recs.length === 0) {
        this.exhausted = true;
        return;
      }

      // Backend sometimes uses 'id' instead of 'post_id'
      recs.forEach(r => {
        if (!r.post_id && (r as any).id) {
          r.post_id = parseInt((r as any).id, 10);
        }
      });

      const postIds = recs
        .map(r => r.post_id)
        .filter((pid): pid is number => !!pid && !this.seenIds.has(pid));

      if (postIds.length > 0) {
        const batchResp = await apiClient.posts.batchGet({ post_ids: postIds });
        const hydratedMap = new Map(batchResp.posts?.map(p => [p.id, p]));
        
        recs.forEach(r => { 
          if (r.post_id) {
            const p = hydratedMap.get(r.post_id);
            if (p) {
              const processed = p as ProcessedPost;
              processed._media = extractMedia(processed);
              (r as any)._hydratedPost = processed;
            }
          }
        });
      }
      
      // De-duplicate items before appending
      const newItems = recs.filter(r => r.post_id && !this.seenIds.has(r.post_id));
      newItems.forEach(r => { if (r.post_id) this.seenIds.add(r.post_id); });

      this.relatedPosts = [...this.relatedPosts, ...newItems];
      if (this.relatedPosts.length >= 96 || newItems.length === 0) this.exhausted = true;
    } catch (e) {
      console.error('Failed to fetch recommendations', e);
    } finally {
      if (currentId === this.currentFetchId) {
        this.loading = false;
      }
    }
  }

  private handleInfiniteToggle(e: CustomEvent) {
    this.infiniteScroll = e.detail.enabled;
  }

  private navigateToRelated(rec: RecResult) {
    const id = rec.post_id || (rec as any).id;
    if (id) {
      // Direct navigation to the post page as per user's "Best Practice" requirement
      window.location.href = `/post/${id}`;
    }
  }

  render() {
    const id = typeof this.postId === 'string' ? parseInt(this.postId, 10) : this.postId;
    if (id === undefined || id === null) return nothing;

    return html`
      <h3>More like this ✨</h3>
      
      <div class="gutter-grid">
        ${repeat(this.relatedPosts, r => r.post_id, r => {
          const h = (r as any)._hydratedPost;
          if (!h) return html`<div class="gutter-skeleton"></div>`;
          
          const raw = h._media?.url || h._media?.videoUrl || h.content?.thumbnail;
          return html`
            <div class="gutter-item" @click=${() => this.navigateToRelated(r)}>
              <media-renderer .src=${raw} .type=${'gutter'}></media-renderer>
            </div>
          `;
        })}
        ${this.loading && this.relatedPosts.length === 0 ? 
          Array(6).fill(0).map(() => html`<div class="gutter-skeleton"></div>`) : nothing}
      </div>

      <load-footer
        .mode=${this.mode}
        .loading=${this.loading}
        .exhausted=${this.exhausted}
        .infiniteScroll=${this.infiniteScroll}
        @load-more=${() => this.fetchMore()}
        @infinite-toggle=${this.handleInfiniteToggle}
      ></load-footer>
    `;
  }
}
