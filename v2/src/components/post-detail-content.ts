import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { baseStyles } from '../styles/theme.js';
import { extractRenderableTags, type ProcessedPost } from '../types/post.js';
import { sanitizeHtmlFragment } from '../services/html-sanitizer.js';
import { resolveLink } from '../services/link-resolver.js';
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

      .post-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 20px;
      }

      .tag-chip {
        font-size: 12px;
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 3px 9px;
        color: var(--accent);
        text-decoration: none;
      }

      .tag-chip:hover {
        border-color: var(--accent);
      }
    `,
  ];

  @property({ type: Object }) post: ProcessedPost | null = null;
  @property({ type: String }) recommendationsMode: 'list' | 'grid' = 'list';
  @property({ type: Boolean }) engagementStandalone = false;

  render() {
    if (!this.post) return nothing;
    const p = this.post;
    const tags = extractRenderableTags(p);

    return html`
      <div class="body-text">
        ${unsafeHTML(sanitizeHtmlFragment(p.content?.html || p.body || ''))}
      </div>

      ${tags.length > 0 ? html`
        <div class="post-tags">
          ${tags.map((tag) => {
            const link = resolveLink('search_tag', { tag });
            return html`<a class="tag-chip" href=${link.href} target=${link.target} rel=${link.rel || ''} title=${link.title || ''}>${link.label || `#${tag}`}</a>`;
          })}
        </div>
      ` : nothing}

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
