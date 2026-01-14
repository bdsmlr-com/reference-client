import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { BREAKPOINTS, REQUEST_TIMING } from '../types/ui-constants.js';

/**
 * Skeleton loader variants for different content types.
 * - post-card: Grid card skeleton (Search, Archive)
 * - post-feed: Full-width feed item skeleton (Timeline, Activity, Following)
 * - blog-card: Blog card skeleton (Blogs page)
 * - blog-list: Blog list item skeleton (Social page)
 */
export type SkeletonVariant = 'post-card' | 'post-feed' | 'blog-card' | 'blog-list';

@customElement('skeleton-loader')
export class SkeletonLoader extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      /* Shimmer animation */
      @keyframes shimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }

      .skeleton {
        background: linear-gradient(
          90deg,
          var(--bg-panel-alt) 25%,
          var(--border) 50%,
          var(--bg-panel-alt) 75%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s ease-in-out infinite;
        border-radius: 4px;
      }

      /* Post Card Skeleton (Grid) */
      .post-card-skeleton {
        background: var(--bg-panel);
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--border);
      }

      .post-card-skeleton .image {
        width: 100%;
        height: 200px;
        border-radius: 0;
      }

      .post-card-skeleton .badge {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 80px;
        height: 20px;
      }

      .post-card-skeleton .content {
        padding: 10px;
      }

      .post-card-skeleton .stats {
        width: 60%;
        height: 14px;
        margin-bottom: 8px;
      }

      .post-card-skeleton .tags {
        display: flex;
        gap: 4px;
      }

      .post-card-skeleton .tag {
        width: 50px;
        height: 18px;
        border-radius: 12px;
      }

      /* Post Feed Skeleton (Full-width) */
      .post-feed-skeleton {
        background: var(--bg-panel);
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--border);
        margin-bottom: 16px;
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
      }

      .post-feed-skeleton .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
      }

      .post-feed-skeleton .header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .post-feed-skeleton .avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
      }

      .post-feed-skeleton .name {
        width: 100px;
        height: 16px;
      }

      .post-feed-skeleton .date {
        width: 60px;
        height: 14px;
      }

      .post-feed-skeleton .image {
        width: 100%;
        height: 300px;
        border-radius: 0;
      }

      .post-feed-skeleton .body {
        padding: 16px;
      }

      .post-feed-skeleton .stats {
        display: flex;
        gap: 16px;
        margin-bottom: 12px;
      }

      .post-feed-skeleton .stat {
        width: 50px;
        height: 16px;
      }

      .post-feed-skeleton .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .post-feed-skeleton .tag {
        width: 70px;
        height: 24px;
        border-radius: 14px;
      }

      /* Blog Card Skeleton */
      .blog-card-skeleton {
        background: var(--bg-panel);
        border-radius: 8px;
        border: 1px solid var(--border);
        padding: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        min-height: 180px;
      }

      .blog-card-skeleton .avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        margin-bottom: 12px;
      }

      .blog-card-skeleton .name {
        width: 100px;
        height: 16px;
        margin-bottom: 4px;
      }

      .blog-card-skeleton .title {
        width: 150px;
        height: 14px;
        margin-bottom: 8px;
      }

      .blog-card-skeleton .stats {
        display: flex;
        gap: 12px;
        margin-top: auto;
      }

      .blog-card-skeleton .stat {
        width: 50px;
        height: 14px;
      }

      /* Blog List Skeleton (Social page) */
      .blog-list-skeleton {
        background: var(--bg-panel);
        border-radius: 8px;
        border: 1px solid var(--border);
        padding: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .blog-list-skeleton .avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .blog-list-skeleton .info {
        flex: 1;
        min-width: 0;
      }

      .blog-list-skeleton .name {
        width: 80px;
        height: 16px;
        margin-bottom: 4px;
      }

      .blog-list-skeleton .title {
        width: 120px;
        height: 12px;
      }

      /* Grid container for multiple skeletons */
      .skeleton-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: 1fr;
      }

      @media (min-width: ${unsafeCSS(BREAKPOINTS.MOBILE)}px) {
        .skeleton-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (min-width: ${unsafeCSS(BREAKPOINTS.TABLET)}px) {
        .skeleton-grid {
          grid-template-columns: repeat(4, 1fr);
        }
      }

      /* Feed layout - always single column */
      .skeleton-feed {
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      /* Mobile adjustments */
      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {
        .post-feed-skeleton {
          margin-left: 8px;
          margin-right: 8px;
        }

        .post-feed-skeleton .header {
          padding: 10px 12px;
        }

        .post-feed-skeleton .body {
          padding: 12px;
        }
      }

      /* Slow request indicator (TOUT-002) */
      .slow-indicator {
        text-align: center;
        padding: 16px;
        color: var(--text-muted);
        font-size: 13px;
        animation: fadeIn 0.3s ease-in;
        margin-bottom: 8px;
      }

      .slow-indicator .slow-message {
        color: var(--accent);
        font-weight: 500;
        margin-bottom: 4px;
      }

      .slow-indicator .elapsed-time {
        font-variant-numeric: tabular-nums;
        font-size: 12px;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
    `,
  ];

  /** The type of skeleton to display */
  @property({ type: String }) variant: SkeletonVariant = 'post-card';

  /** Number of skeleton items to show */
  @property({ type: Number }) count = 1;

  /** Enable elapsed time tracking and slow request indicator (TOUT-002) */
  @property({ type: Boolean }) trackTime = false;

  @state() private elapsedSeconds = 0;
  @state() private isSlowRequest = false;

  private startTime: number | null = null;
  private timerInterval: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.trackTime) {
      this.startTimer();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopTimer();
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('trackTime')) {
      if (this.trackTime) {
        this.startTimer();
      } else {
        this.stopTimer();
      }
    }
  }

  private startTimer(): void {
    if (this.timerInterval !== null) return;

    this.startTime = Date.now();
    this.elapsedSeconds = 0;
    this.isSlowRequest = false;

    this.timerInterval = window.setInterval(() => {
      if (this.startTime === null) return;

      const elapsed = Date.now() - this.startTime;
      this.elapsedSeconds = Math.floor(elapsed / 1000);

      // Mark as slow request after threshold
      if (elapsed >= REQUEST_TIMING.SLOW_THRESHOLD_MS && !this.isSlowRequest) {
        this.isSlowRequest = true;
      }
    }, REQUEST_TIMING.ELAPSED_UPDATE_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.startTime = null;
    this.elapsedSeconds = 0;
    this.isSlowRequest = false;
  }

  /** Reset the timer (call when starting a new request) */
  resetTimer(): void {
    this.stopTimer();
    if (this.trackTime) {
      this.startTimer();
    }
  }

  private formatElapsedTime(): string {
    const elapsed = this.elapsedSeconds;
    if (elapsed >= REQUEST_TIMING.MAX_ELAPSED_DISPLAY_MS / 1000) {
      return 'still working...';
    }
    if (elapsed >= 60) {
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${elapsed}s`;
  }

  private renderSlowIndicator() {
    if (!this.trackTime || !this.isSlowRequest) {
      return '';
    }
    return html`
      <div class="slow-indicator" role="status" aria-live="polite">
        <div class="slow-message">Taking longer than expected...</div>
        <div class="elapsed-time">${this.formatElapsedTime()}</div>
      </div>
    `;
  }

  private renderPostCardSkeleton() {
    return html`
      <div class="post-card-skeleton">
        <div style="position: relative;">
          <div class="skeleton image"></div>
        </div>
        <div class="content">
          <div class="skeleton stats"></div>
          <div class="tags">
            <div class="skeleton tag"></div>
            <div class="skeleton tag"></div>
          </div>
        </div>
      </div>
    `;
  }

  private renderPostFeedSkeleton() {
    return html`
      <div class="post-feed-skeleton">
        <div class="header">
          <div class="header-left">
            <div class="skeleton name"></div>
          </div>
          <div class="skeleton date"></div>
        </div>
        <div class="skeleton image"></div>
        <div class="body">
          <div class="stats">
            <div class="skeleton stat"></div>
            <div class="skeleton stat"></div>
            <div class="skeleton stat"></div>
          </div>
          <div class="tags">
            <div class="skeleton tag"></div>
            <div class="skeleton tag"></div>
            <div class="skeleton tag"></div>
          </div>
        </div>
      </div>
    `;
  }

  private renderBlogCardSkeleton() {
    return html`
      <div class="blog-card-skeleton">
        <div class="skeleton avatar"></div>
        <div class="skeleton name"></div>
        <div class="skeleton title"></div>
        <div class="stats">
          <div class="skeleton stat"></div>
          <div class="skeleton stat"></div>
        </div>
      </div>
    `;
  }

  private renderBlogListSkeleton() {
    return html`
      <div class="blog-list-skeleton">
        <div class="skeleton avatar"></div>
        <div class="info">
          <div class="skeleton name"></div>
          <div class="skeleton title"></div>
        </div>
      </div>
    `;
  }

  private renderSkeleton() {
    switch (this.variant) {
      case 'post-card':
        return this.renderPostCardSkeleton();
      case 'post-feed':
        return this.renderPostFeedSkeleton();
      case 'blog-card':
        return this.renderBlogCardSkeleton();
      case 'blog-list':
        return this.renderBlogListSkeleton();
      default:
        return this.renderPostCardSkeleton();
    }
  }

  render() {
    const items = Array.from({ length: this.count }, (_, i) => i);
    const isGrid = this.variant === 'post-card' || this.variant === 'blog-card' || this.variant === 'blog-list';
    const containerClass = isGrid ? 'skeleton-grid' : 'skeleton-feed';
    const slowIndicator = this.renderSlowIndicator();

    if (this.count === 1) {
      return html`
        ${slowIndicator}
        ${this.renderSkeleton()}
      `;
    }

    return html`
      ${slowIndicator}
      <div class=${containerClass}>
        ${items.map(() => this.renderSkeleton())}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'skeleton-loader': SkeletonLoader;
  }
}
