import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import { getContextualErrorMessage } from '../services/api-error.js';
import '../components/skeleton-loader.js';
import '../components/post-feed-item.js';
import '../components/post-detail-content.js';

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
      .separator {
        text-align: center;
        margin: 32px 0;
        font-size: 24px;
        opacity: 0.5;
      }
    `
  ];

  @property({ type: String }) postId = '';

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

  private handlePostClick(_e: CustomEvent) {
    if (!this.post) return;
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

      <post-detail-content
        .post=${this.post}
        recommendationsMode="grid"
        ?engagementStandalone=${true}
      ></post-detail-content>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-post': ViewPost;
  }
}
