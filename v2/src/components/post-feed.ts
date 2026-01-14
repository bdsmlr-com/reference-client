import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
import { EventNames, type PostSelectDetail, type PostSelectEvent } from '../types/events.js';
import { BREAKPOINTS, SPACING, CONTAINER_SPACING } from '../types/ui-constants.js';
import './post-feed-item.js';

@customElement('post-feed')
export class PostFeed extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .feed {
        max-width: 600px;
        margin: 0 auto;
        /* UIC-021: Use standardized container spacing */
        padding: 0 ${unsafeCSS(CONTAINER_SPACING.HORIZONTAL)}px;
      }

      .sentinel {
        height: 1px;
      }

      .empty {
        text-align: center;
        /* UIC-021: Use standardized spacing scale */
        padding: ${unsafeCSS(SPACING.XXL)}px;
        color: var(--text-muted);
      }

      /* Mobile: max-width below BREAKPOINTS.MOBILE */
      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {
        .feed {
          /* UIC-021: Use standardized mobile container spacing */
          padding: 0 ${unsafeCSS(CONTAINER_SPACING.HORIZONTAL_MOBILE)}px;
        }
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
      return html`<section class="feed" role="status"><div class="empty">No posts to display</div></section>`;
    }

    return html`
      <section class="feed" role="feed" aria-label="Post feed" aria-busy="false">
        ${this.posts.map(
          (post) => html`
            <post-feed-item .post=${post} @post-select=${this.handlePostSelect}></post-feed-item>
          `
        )}
      </section>
      <div class="sentinel" id="scroll-sentinel" aria-hidden="true"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-feed': PostFeed;
  }
}
