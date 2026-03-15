import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import { getContextualErrorMessage } from '../services/api-error.js';
import '../components/skeleton-loader.js';

@customElement('view-post')
export class ViewPost extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: 40px 20px;
        max-width: 1200px;
        margin: 0 auto;
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

  @state() private loading = true;
  @state() private error = '';

  protected firstUpdated(): void {
    this.loadPost();
  }

  private async loadPost(): Promise<void> {
    if (!this.postId) return;
    this.loading = true;
    this.error = '';

    try {
      const id = parseInt(this.postId);
      const resp = await apiClient.posts.get(id);
      
      if (resp.post) {
        const processed: ProcessedPost = {
          ...resp.post,
          _media: extractMedia(resp.post)
        };
        
        // AUTO-OPEN LIGHTBOX
        this.dispatchEvent(new CustomEvent('post-click', {
          detail: { 
            post: processed,
            posts: [processed],
            index: 0
          },
          bubbles: true,
          composed: true
        }));
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
          <div style="opacity: 0.5;">Resolving deep link...</div>
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

    return html`
      <div style="text-align: center; padding: 100px 0; opacity: 0.5;">
        Post ${this.postId} is open in lightbox.
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-post': ViewPost;
  }
}
