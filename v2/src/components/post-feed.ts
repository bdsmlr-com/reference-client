import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
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
        padding: 0 16px;
      }

      .sentinel {
        height: 1px;
      }

      .empty {
        text-align: center;
        padding: 40px;
        color: var(--text-muted);
      }

      @media (max-width: 480px) {
        .feed {
          padding: 0 8px;
        }
      }
    `,
  ];

  @property({ type: Array }) posts: ProcessedPost[] = [];

  private handleItemClick(e: CustomEvent): void {
    this.dispatchEvent(new CustomEvent('post-click', { detail: e.detail }));
  }

  render() {
    if (this.posts.length === 0) {
      return html`<div class="feed"><div class="empty">No posts to display</div></div>`;
    }

    return html`
      <div class="feed">
        ${this.posts.map(
          (post) => html`
            <post-feed-item .post=${post} @item-click=${this.handleItemClick}></post-feed-item>
          `
        )}
      </div>
      <div class="sentinel" id="scroll-sentinel"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-feed': PostFeed;
  }
}
