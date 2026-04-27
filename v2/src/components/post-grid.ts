import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ProcessedPost } from '../types/post.js';
import { EventNames, type PostSelectDetail } from '../types/events.js';
import './activity-grid.js';

@customElement('post-grid')
export class PostGrid extends LitElement {
  @property({ type: Array }) posts: ProcessedPost[] = [];
  @property({ type: String }) page: 'feed' | 'archive' | 'search' | 'activity' | 'post' | 'social' = 'archive';
  @property({ type: String, reflect: true }) mode: 'grid' | 'masonry' = 'grid';

  private handleActivityClick(e: CustomEvent<{ post: ProcessedPost }>): void {
    this.dispatchEvent(
      new CustomEvent<PostSelectDetail>(EventNames.POST_CLICK, { detail: e.detail })
    );
  }

  render() {
    const items = this.posts.map((post) => ({ post, type: 'post' as const }));

    return html`
      <activity-grid
        .mode=${this.mode}
        .items=${items}
        @activity-click=${this.handleActivityClick}
      ></activity-grid>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-grid': PostGrid;
  }
}
