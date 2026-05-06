import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { BREAKPOINTS, SPACING } from '../types/ui-constants.js';

type PageName = 'archive' | 'timeline' | 'social' | 'following' | 'masquerade';

@customElement('blog-context')
export class BlogContext extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        margin-bottom: ${SPACING.LG}px;
      }

      :host([hidden]) {
        display: none;
      }

      .context-container {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: ${SPACING.SM}px;
        padding: ${SPACING.SM}px ${SPACING.LG}px;
        background: var(--bg-panel-alt);
        border: 1px solid var(--border);
        border-radius: 8px;
        max-width: 600px;
        margin: 0 auto;
        flex-wrap: wrap;
      }

      .context-label {
        font-size: 12px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .blog-name {
        color: var(--text-primary);
        font-size: 14px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE)}px) {
        .context-container {
          padding: ${SPACING.SM}px;
          gap: ${SPACING.XS}px;
        }
      }
    `,
  ];

  @property({ type: String }) page: PageName = 'timeline';
  @property({ type: String }) viewedBlog = '';

  render() {
    if (!this.viewedBlog) {
      return null;
    }

    return html`
      <div class="context-container" role="region" aria-label="Blog context">
        <span class="context-label">Blog</span>
        <strong class="blog-name">@${this.viewedBlog}</strong>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blog-context': BlogContext;
  }
}
