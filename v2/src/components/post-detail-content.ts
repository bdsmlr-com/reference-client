import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
import { sanitizeHtmlFragment } from '../services/html-sanitizer.js';
import './post-engagement.js';
import './post-recommendations.js';

@customElement('post-detail-content')
export class PostDetailContent extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host { display: block; }
      .body-text {
        margin-bottom: 32px;
        border-bottom: 1px solid var(--border-subtle);
        padding-bottom: 24px;
      }
    `,
  ];

  @property({ type: Object }) post: ProcessedPost | null = null;
  @property({ type: String }) recommendationsMode: 'list' | 'grid' = 'list';
  @property({ type: Boolean }) engagementStandalone = false;

  render() {
    if (!this.post) return nothing;
    const p = this.post;

    return html`
      <div class="body-text">
        ${unsafeHTML(sanitizeHtmlFragment(p.content?.html || p.body || ''))}
      </div>

      <post-engagement .post=${p} ?standalone=${this.engagementStandalone}></post-engagement>

      <post-recommendations .postId=${p.id} .mode=${this.recommendationsMode}></post-recommendations>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-detail-content': PostDetailContent;
  }
}
