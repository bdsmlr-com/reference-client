import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import { getContextualErrorMessage } from '../services/api-error.js';
import '../components/skeleton-loader.js';
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
    `
  ];

  @property({ type: String }) postId = '';
  @property({ type: String }) from = 'direct';

  @state() private loading = true;
  @state() private error = '';
  @state() private post: ProcessedPost | null = null;
  @state() private originPost: ProcessedPost | null = null;

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
    this.originPost = null;

    try {
      const id = parseInt(this.postId);
      const resp = await apiClient.posts.get(id);
      
      if (resp.post) {
        this.post = {
          ...resp.post,
          _media: extractMedia(resp.post)
        };
        if (
          resp.post.originPostId
          && resp.post.originPostId !== resp.post.id
        ) {
          const originResp = await apiClient.posts.get(resp.post.originPostId);
          if (originResp.post) {
            this.originPost = {
              ...originResp.post,
              _media: extractMedia(originResp.post),
            };
          }
        }
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
      <post-detail-content
        style="width: 100%;"
        .post=${this.post}
        .originPost=${this.originPost}
        .from=${this.from as PostRouteSource}
      ></post-detail-content>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-post': ViewPost;
  }
}
