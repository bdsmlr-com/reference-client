import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
import './post-card.js';

@customElement('post-grid')
export class PostGrid extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 16px;
      }

      /* Tablet: 2 columns */
      @media (min-width: 480px) {
        .grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      /* Desktop: 4 columns */
      @media (min-width: 768px) {
        .grid {
          grid-template-columns: repeat(4, 1fr);
        }
      }

      .sentinel {
        height: 1px;
      }

      .empty {
        text-align: center;
        padding: 40px;
        color: var(--text-muted);
        grid-column: 1 / -1;
      }
    `,
  ];

  @property({ type: Array }) posts: ProcessedPost[] = [];

  private handleCardClick(e: CustomEvent): void {
    this.dispatchEvent(new CustomEvent('post-click', { detail: e.detail }));
  }

  render() {
    if (this.posts.length === 0) {
      return html`<div class="grid"><div class="empty">No posts to display</div></div>`;
    }

    return html`
      <div class="grid">
        ${this.posts.map(
          (post) => html`
            <post-card .post=${post} @card-click=${this.handleCardClick}></post-card>
          `
        )}
      </div>
      <div class="sentinel" id="scroll-sentinel"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-grid': PostGrid;
  }
}
