import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
import { EventNames, type PostSelectDetail, type PostSelectEvent } from '../types/events.js';
import { BREAKPOINTS, SPACING, CONTAINER_SPACING } from '../types/ui-constants.js';
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
        /* UIC-021: Use standardized spacing scale */
        gap: ${unsafeCSS(SPACING.MD)}px;
        max-width: 1200px;
        margin: 0 auto;
        /* UIC-021: Use standardized container spacing */
        padding: 0 ${unsafeCSS(CONTAINER_SPACING.HORIZONTAL)}px;
      }

      /* Tablet: 2 columns (BREAKPOINTS.MOBILE = 480px) */
      @media (min-width: ${unsafeCSS(BREAKPOINTS.MOBILE)}px) {
        .grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      /* Desktop: 4 columns (BREAKPOINTS.TABLET = 768px) */
      @media (min-width: ${unsafeCSS(BREAKPOINTS.TABLET)}px) {
        .grid {
          grid-template-columns: repeat(4, 1fr);
        }
      }

      .sentinel {
        height: 1px;
      }

      .empty {
        text-align: center;
        /* UIC-021: Use standardized spacing scale */
        padding: ${unsafeCSS(SPACING.XXL)}px;
        color: var(--text-muted);
        grid-column: 1 / -1;
      }
    `,
  ];

  @property({ type: Array }) posts: ProcessedPost[] = [];

  private handlePostSelect(e: PostSelectEvent): void {
    this.dispatchEvent(
      new CustomEvent<PostSelectDetail>(EventNames.POST_CLICK, { detail: e.detail })
    );
  }

  render() {
    if (this.posts.length === 0) {
      return html`<section class="grid" role="status"><div class="empty">No posts to display</div></section>`;
    }

    return html`
      <section class="grid" role="feed" aria-label="Post grid" aria-busy="false">
        ${this.posts.map(
          (post) => html`
            <post-card .post=${post} @post-select=${this.handlePostSelect}></post-card>
          `
        )}
      </section>
      <div class="sentinel" id="scroll-sentinel" aria-hidden="true"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-grid': PostGrid;
  }
}
