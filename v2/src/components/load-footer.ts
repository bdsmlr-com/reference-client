import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ViewStats } from '../types/post.js';

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
        padding: 0 16px;
        text-align: center;
      }

      .load-more {
        display: block;
        width: 100%;
        max-width: 200px;
        margin: 0 auto 12px;
        padding: 12px 24px;
        border-radius: 6px;
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        font-size: 16px;
        min-height: 44px;
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
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
      }

      .infinite-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 12px;
        font-size: 13px;
        color: var(--text-muted);
      }

      .infinite-toggle input {
        cursor: pointer;
        width: 18px;
        height: 18px;
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

  private handleLoadMore(): void {
    this.dispatchEvent(new CustomEvent('load-more'));
  }

  private handleInfiniteToggle(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    this.dispatchEvent(new CustomEvent('infinite-toggle', { detail: { enabled: checked } }));
  }

  private renderButton() {
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
    if (this.mode === 'search') {
      return html`
        <div class="footer-stats">
          <span class="found">✓ Found: <b>${this.stats.found}</b></span>
          <span class="deleted">🗑 Deleted: <b>${this.stats.deleted}</b></span>
          <span class="dupes">⊘ Dupes: <b>${this.stats.dupes}</b></span>
          <span class="not-found">✗ Not found: <b>${this.stats.notFound}</b></span>
        </div>
      `;
    }

    if (this.mode === 'archive') {
      const filtered = this.stats.deleted + this.stats.dupes + this.stats.notFound;
      return html`
        <div class="footer-stats">
          <span class="count">Loaded: <b>${this.stats.found}</b></span>
          ${filtered > 0 ? html`<span class="deleted">Filtered: <b>${filtered}</b></span>` : ''}
        </div>
      `;
    }

    // Timeline and Activity have no stats (per PRD)
    if (this.mode === 'timeline' || this.mode === 'activity') {
      return html``;
    }

    // list mode
    return html`
      <div class="footer-stats">
        <span class="count">Count: <b>${this.totalCount}</b></span>
      </div>
    `;
  }

  render() {
    return html`
      <div class="infinite-toggle">
        <input
          type="checkbox"
          id="infinite-scroll"
          .checked=${this.infiniteScroll}
          @change=${this.handleInfiniteToggle}
        />
        <label for="infinite-scroll">Enable infinite scroll</label>
      </div>
      ${this.renderButton()}
      ${this.renderStats()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'load-footer': LoadFooter;
  }
}
