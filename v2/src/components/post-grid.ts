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

      .masonry-container {
        display: flex;
        gap: ${unsafeCSS(SPACING.MD)}px;
        padding: 0 ${unsafeCSS(CONTAINER_SPACING.HORIZONTAL)}px;
        max-width: 1400px;
        margin: 0 auto;
        align-items: flex-start;
      }

      .masonry-column {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: ${unsafeCSS(SPACING.MD)}px;
        min-width: 0;
      }

      @media (max-width: ${unsafeCSS(BREAKPOINTS.TABLET)}px) {
        .masonry-column:last-child {
          display: none;
        }
      }

      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE)}px) {
        .masonry-column:nth-child(2) {
          display: none;
        }
      }

      .sentinel {
        height: 1px;
        width: 100%;
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
  @property({ type: String }) page: 'feed' | 'archive' | 'search' | 'activity' | 'post' | 'social' = 'archive';

  private handlePostSelect(e: PostSelectEvent): void {
    this.dispatchEvent(
      new CustomEvent<PostSelectDetail>(EventNames.POST_CLICK, { detail: e.detail })
    );
  }

  render() {
    if (this.posts.length === 0) {
      return html`<section class="masonry-container" role="status"><div class="empty">No posts to display</div></section>`;
    }

    // Distribute posts into 3 stable columns
    const colCount = 3;
    const columns: ProcessedPost[][] = Array.from({ length: colCount }, () => []);
    
    this.posts.forEach((post, i) => {
      columns[i % colCount].push(post);
    });

    return html`
      <section class="masonry-container" role="feed" aria-label="Post grid">
        ${columns.map(col => html`
          <div class="masonry-column">
            ${col.map(post => html`
              <post-card .post=${post} .page=${this.page} @post-select=${this.handlePostSelect}></post-card>
            `)}
          </div>
        `)}
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
