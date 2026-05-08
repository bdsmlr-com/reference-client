import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { isAdminMode } from '../services/blog-resolver.js';
import type { ViewStats } from '../types/post.js';
import { EventNames } from '../types/events.js';
import { SPACING, CONTAINER_SPACING } from '../types/ui-constants.js';

export type FooterMode = 'search' | 'archive' | 'timeline' | 'activity' | 'list';

@customElement('load-footer')
export class LoadFooter extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        max-width: 1200px;
        margin: 20px auto;
        /* UIC-021: Use standardized container spacing */
        padding: 0 ${CONTAINER_SPACING.HORIZONTAL}px;
        text-align: center;
      }

      .load-more {
        display: block;
        width: 100%;
        max-width: 150px;
        /* UIC-021: Use standardized spacing scale */
        margin: 0 auto ${SPACING.SM}px;
        padding: ${SPACING.SM}px ${SPACING.LG}px;
        border-radius: ${SPACING.XS}px;
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        font-size: 13px;
        min-height: 32px;
        transition: background 0.2s;
      }

      .load-more:hover:not(:disabled) {
        background: var(--border-strong);
      }

      .load-more:disabled {
        background: var(--bg-panel);
        color: var(--text-muted);
        cursor: default;
      }

      .progress {
        display: block;
        font-size: 10px;
        color: var(--text-muted);
        margin-top: 2px;
      }

      .footer-stats {
        display: flex;
        justify-content: center;
        gap: 16px;
        font-size: 12px;
        color: var(--text-muted);
        flex-wrap: wrap;
      }

      .footer-stats span {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .footer-stats .found {
        color: var(--success);
      }
      .footer-stats .deleted {
        color: var(--error);
      }
      .footer-stats .dupes {
        color: var(--warning);
      }
      .footer-stats .not-found {
        color: var(--text-muted);
      }
      .footer-stats .count {
        color: var(--text-primary);
      }

      /* Visually hidden text for screen readers */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `,
  ];

  @property({ type: String }) mode: FooterMode = 'search';
  @property({ type: Object }) stats: ViewStats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
  @property({ type: Number }) totalCount = 0;
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) exhausted = false;
  @property({ type: Number }) loadingCurrent = 0;
  @property({ type: Number }) loadingTarget = 12;
  @property({ type: Boolean }) infiniteScroll = false;
  @property({ type: Boolean }) persistSelection = true;
  @property({ type: String }) pageName = '';
  @property({ type: String }) navigationMode: 'infinite' | 'paginated' = 'infinite';
  @property({ type: Number }) currentPage = 1;
  @property({ type: Boolean }) hasPreviousPage = false;
  @property({ type: Boolean }) hasNextPage = false;

  private handleLoadMore(): void {
    this.dispatchEvent(new CustomEvent(EventNames.LOAD_MORE));
  }

  private handlePreviousPage(): void {
    this.dispatchEvent(new CustomEvent(EventNames.PREVIOUS_PAGE));
  }

  private handleNextPage(): void {
    this.dispatchEvent(new CustomEvent(EventNames.NEXT_PAGE));
  }

  private renderButton() {
    if (this.navigationMode === 'paginated') {
      return html`
        <div class="footer-stats">
          <button class="load-more" ?disabled=${this.loading || !this.hasPreviousPage} @click=${this.handlePreviousPage}>
            Previous
          </button>
          <span class="count">Page <b>${this.currentPage}</b></span>
          <button class="load-more" ?disabled=${this.loading || !this.hasNextPage} @click=${this.handleNextPage}>
            Next
          </button>
        </div>
      `;
    }

    if (this.infiniteScroll) {
      if (this.loading) {
        return html`
          <div class="footer-stats" role="status" aria-live="polite">
            <span class="count">Loading more…</span>
          </div>
        `;
      }
      if (this.exhausted) {
        return html`<button class="load-more" disabled>No more results</button>`;
      }
      return html`
        <div class="footer-stats" role="status" aria-live="polite">
          <span class="count">∞ scroll on</span>
        </div>
      `;
    }

    if (this.exhausted) {
      return html`<button class="load-more" disabled>No more results</button>`;
    }

    if (this.loading) {
      return html`
        <button class="load-more" disabled>
          Loading...
          <span class="progress">${this.loadingCurrent} of ${this.loadingTarget} found</span>
        </button>
      `;
    }

    return html`<button class="load-more" @click=${this.handleLoadMore}>Load More</button>`;
  }

  private renderStats() {
    if (!isAdminMode() && (this.mode === 'search' || this.mode === 'archive')) {
      return html`
        <div class="footer-stats" role="status" aria-live="polite">
          <span class="count">Loaded: <b>${this.stats.found}</b> posts</span>
        </div>
      `;
    }

    if (this.mode === 'search') {
      return html`
        <div class="footer-stats" role="status" aria-live="polite" aria-label="Search results statistics">
          <span class="found" role="text" aria-label="Found ${this.stats.found} posts">
            <span aria-hidden="true">✓</span> Found: <b>${this.stats.found}</b>
          </span>
          <span class="deleted" role="text" aria-label="Deleted ${this.stats.deleted} posts">
            <span aria-hidden="true">🗑</span> Deleted: <b>${this.stats.deleted}</b>
          </span>
          <span class="dupes" role="text" aria-label="Duplicate ${this.stats.dupes} posts">
            <span aria-hidden="true">⊘</span> Dupes: <b>${this.stats.dupes}</b>
          </span>
          <span class="not-found" role="text" aria-label="Not found ${this.stats.notFound} posts">
            <span aria-hidden="true">✗</span> Not found: <b>${this.stats.notFound}</b>
          </span>
        </div>
      `;
    }

    if (this.mode === 'archive') {
      const filtered = this.stats.deleted + this.stats.dupes + this.stats.notFound;
      return html`
        <div class="footer-stats" role="status" aria-live="polite" aria-label="Archive statistics">
          <span class="count" role="text" aria-label="Loaded ${this.stats.found} posts">
            Loaded: <b>${this.stats.found}</b>
          </span>
          ${filtered > 0 ? html`
            <span class="deleted" role="text" aria-label="Filtered out ${filtered} posts">
              Filtered: <b>${filtered}</b>
            </span>
          ` : ''}
        </div>
      `;
    }

    // Timeline and Activity have no stats (per PRD)
    if (this.mode === 'timeline' || this.mode === 'activity') {
      return html``;
    }

    // list mode
    return html`
      <div class="footer-stats" role="status" aria-live="polite" aria-label="List statistics">
        <span class="count" role="text" aria-label="Total count ${this.totalCount} items">
          Count: <b>${this.totalCount}</b>
        </span>
      </div>
    `;
  }

  render() {
    return html`
      <footer>
        ${this.renderButton()}
        ${this.renderStats()}
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'load-footer': LoadFooter;
  }
}
