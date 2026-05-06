import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import { getContextualErrorMessage } from '../services/api-error.js';
import '../components/skeleton-loader.js';
import '../components/post-feed-item.js';
import '../components/post-detail-content.js';
import type { PostRouteSource } from '../services/post-route-context.js';

@customElement('view-post')
export class ViewPost extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: 28px 12px 56px;
        max-width: min(980px, calc(100vw - 20px));
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
      .post-shell {
        display: grid;
        gap: 18px;
        padding: 18px;
        border-radius: 24px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--bg-panel) 86%, transparent);
        box-shadow: 0 28px 68px rgba(0, 0, 0, 0.28);
        backdrop-filter: blur(14px);
      }
    `
  ];

  @property({ type: String }) postId = '';
  @property({ type: String }) from = 'direct';

  @state() private loading = true;
  @state() private error = '';
  @state() private post: ProcessedPost | null = null;

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

    try {
      const id = parseInt(this.postId);
      const resp = await apiClient.posts.get(id);
      
      if (resp.post) {
        this.post = {
          ...resp.post,
          _media: extractMedia(resp.post)
        };
      } else {
        this.error = 'Post not found.';
      }
    } catch (e) {
      this.error = getContextualErrorMessage(e, 'load_posts');
    } finally {
      this.loading = false;
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
      <div class="post-shell">
        <post-feed-item
          style="width: 100%; max-width: none; margin: 0;"
          .post=${this.post}
          page="post"
          .disableClick=${true}
          .videoAutoplay=${false}
          .videoControls=${true}
          .videoLoop=${true}
        ></post-feed-item>

        <post-detail-content
          style="width: 100%;"
          .post=${this.post}
          .from=${this.from as PostRouteSource}
        ></post-detail-content>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-post': ViewPost;
  }
}
