import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import { getContextualErrorMessage } from '../services/api-error.js';
import { recService, type RecResult } from '../services/recommendation-api.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/skeleton-loader.js';
import '../components/post-feed-item.js';
import '../components/media-renderer.js';
import '../components/load-footer.js';

@customElement('view-post')
export class ViewPost extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: 40px 20px;
        max-width: 800px;
        margin: 0 auto;
        min-height: 100vh;
      }
      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        padding: 100px 0;
      }
      .recommendations {
        margin-top: 60px;
        border-top: 1px solid var(--border);
        padding-top: 40px;
      }
      .recommendations h3 {
        margin-bottom: 24px;
        font-size: 1.5rem;
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
      }
      .gutter-item:hover {
        transform: scale(1.02);
        border-color: var(--accent);
      }
      .back-nav {
        margin-bottom: 24px;
      }
      .back-link {
        color: var(--text-muted);
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        transition: color 0.2s;
      }
      .back-link:hover {
        color: var(--accent);
      }
    `
  ];

  @property({ type: String }) postId = '';

  @state() private loading = true;
  @state() private error = '';
  @state() private post: ProcessedPost | null = null;
  @state() private relatedPosts: RecResult[] = [];
  @state() private loadingRelated = false;
  private hasAutoOpened = false;

  protected updated(changedProperties: Map<string, any>): void {
    if (changedProperties.has('postId')) {
      this.loadPost();
    }
  }

  private async loadPost(): Promise<void> {
    if (!this.postId) return;
    this.loading = true;
    this.error = '';
    this.post = null;
    this.relatedPosts = [];

    try {
      const id = parseInt(this.postId);
      const resp = await apiClient.posts.get(id);
      
      if (resp.post) {
        this.post = {
          ...resp.post,
          _media: extractMedia(resp.post)
        };
        
        // AUTO-OPEN LIGHTBOX ON DEEP LINK
        // Only if we haven't already auto-opened for this instance
        if (!this.hasAutoOpened) {
          this.hasAutoOpened = true;
          this.dispatchEvent(new CustomEvent('post-click', {
            detail: { 
              post: this.post,
              posts: [this.post],
              index: 0
            },
            bubbles: true,
            composed: true
          }));
        }

        this.fetchRelatedPosts();
      } else {
        this.error = 'Post not found.';
      }
    } catch (e) {
      this.error = getContextualErrorMessage(e, 'load_posts');
    } finally {
      this.loading = false;
    }
  }

  private async fetchRelatedPosts() {
    if (!this.post || this.loadingRelated) return;
    this.loadingRelated = true;
    try {
      const recs = await recService.getSimilarPosts(this.post.id, 12);
      const postIds = recs.map(r => r.post_id).filter((id): id is number => !!id);
      
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
      this.relatedPosts = recs;
    } catch (e) {
      console.error('Failed to fetch recommendations', e);
    } finally {
      this.loadingRelated = false;
    }
  }

  private handlePostClick(_e: CustomEvent) {
    // When the main post is clicked, open it in the lightbox
    this.dispatchEvent(new CustomEvent('post-click', {
      detail: { 
        post: this.post,
        posts: [this.post],
        index: 0
      },
      bubbles: true,
      composed: true
    }));
  }

  private navigateToRelated(rec: RecResult) {
    if (rec.post_id) {
      window.history.pushState({}, '', `/post/${rec.post_id}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading-container">
          <skeleton-loader count="1" mode="feed"></skeleton-loader>
          <div style="opacity: 0.5;">Loading post...</div>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="error-container" style="text-align: center; padding: 100px 0;">
          <h2 style="color: var(--error);">${this.error}</h2>
          <a href="/" class="btn" style="display: inline-block; margin-top: 20px; color: var(--accent); text-decoration: none;">Return Home</a>
        </div>
      `;
    }

    if (!this.post) return nothing;

    return html`
      <div class="back-nav">
        <a href="/" class="back-link">← Back to Feed</a>
      </div>

      <post-feed-item .post=${this.post} @post-click=${this.handlePostClick}></post-feed-item>

      <div class="recommendations">
        <h3>More like this ✨</h3>
        ${this.loadingRelated && this.relatedPosts.length === 0 ? html`
          <div class="gutter-grid">
            ${Array(6).fill(0).map(() => html`<div class="gutter-item" style="opacity: 0.2;"></div>`)}
          </div>
        ` : ''}

        <div class="gutter-grid">
          ${repeat(this.relatedPosts, r => r.post_id, r => {
            const h = (r as any)._hydratedPost;
            if (!h) return nothing;
            
            const raw = h._media?.url || h._media?.videoUrl || h.content?.thumbnail;
            return html`
              <div class="gutter-item" @click=${() => this.navigateToRelated(r)}>
                <media-renderer .src=${raw} .type=${'gutter'}></media-renderer>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-post': ViewPost;
  }
}
