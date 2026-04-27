import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import '../components/post-recommendations.js';

@customElement('view-post-related')
export class ViewPostRelated extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: 32px 20px 56px;
        max-width: 1200px;
        margin: 0 auto;
        min-height: 100vh;
      }

      .back-nav {
        margin-bottom: 20px;
      }

      .back-link {
        color: var(--text-muted);
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
      }

      .back-link:hover {
        color: var(--accent);
      }

      .subtitle {
        color: var(--text-muted);
        font-size: 14px;
        margin: 0 0 20px;
      }
    `,
  ];

  @property({ type: String }) postId = '';
  @property({ type: String }) perspectiveBlogName = '';
  @property({ type: String }) title = 'More like this ✨';

  private get normalizedPostId(): number {
    return parseInt(this.postId, 10) || 0;
  }

  render() {
    const id = this.normalizedPostId;
    if (!id) {
      return html`<div class="subtitle">Missing post id.</div>`;
    }

    return html`
      <div class="back-nav">
        <a href="/post/${id}" class="back-link">← Back to post</a>
      </div>

      <div class="subtitle">Expanded related results for post ${id}</div>

      <post-recommendations
        .postId=${id}
        .mode=${'list'}
        .perspectiveBlogName=${this.perspectiveBlogName}
        .title=${this.title}
      ></post-recommendations>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-post-related': ViewPostRelated;
  }
}
