import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { initTheme, injectGlobalStyles, baseStyles } from '../styles/theme.js';
import { blogFollowGraphCached } from '../services/api.js';
import { resolveIdentifierCached } from '../services/api.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { getBlogName, getUrlParam, setUrlParams, isBlogInPath } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import {
  generatePaginationCursorKey,
  getCachedPaginationCursor,
  setCachedPaginationCursor,
} from '../services/storage.js';
import type { FollowEdge, Blog } from '../types/api.js';
import '../components/shared-nav.js';
import '../components/blog-list.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/skeleton-loader.js';
import '../components/error-state.js';
import '../components/offline-banner.js';
import '../components/blog-context.js';

// Initialize theme immediately to prevent FOUC (Flash of Unstyled Content)
injectGlobalStyles();
initTheme();

const PAGE_SIZE = 100;

type Tab = 'followers' | 'following';

@customElement('social-page')
export class SocialPage extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--bg-primary);
      }

      .content {
        padding: 20px 0;
      }

      .blog-header {
        text-align: center;
        padding: 0 16px 20px;
      }

      .blog-name {
        font-size: 24px;
        color: var(--text-primary);
        margin: 0 0 8px;
      }

      .blog-meta {
        font-size: 14px;
        color: var(--text-muted);
      }

      .tabs {
        display: flex;
        justify-content: center;
        gap: 6px;
        padding: 0 16px;
        margin-bottom: 16px;
      }

      .tab {
        padding: 6px 14px;
        border-radius: 4px;
        background: var(--bg-panel);
        color: var(--text-muted);
        font-size: 13px;
        min-height: 30px;
        transition: all 0.2s;
        border: 1px solid var(--border);
      }

      .tab:hover {
        background: var(--bg-panel-alt);
      }

      .tab.active {
        background: var(--accent);
        color: white;
        border-color: var(--accent);
      }

      .status {
        text-align: center;
        color: var(--text-muted);
        padding: 40px 16px;
      }

      .error {
        text-align: center;
        color: var(--error);
        padding: 40px 16px;
      }

      .list-container {
        margin-bottom: 20px;
      }
    `,
  ];

  @state() private blogName = '';
  @state() private blogId: number | null = null;
  @state() private activeTab: Tab = 'followers';
  @state() private followers: FollowEdge[] = [];
  @state() private following: FollowEdge[] = [];
  @state() private followersCount = 0;
  @state() private followingCount = 0;
  @state() private followersCursor: string | null = null;
  @state() private followingCursor: string | null = null;
  @state() private followersExhausted = false;
  @state() private followingExhausted = false;
  @state() private loading = false;
  @state() private infiniteScroll = false;
  @state() private statusMessage = '';
  @state() private errorMessage = '';
  @state() private retrying = false;
  /** TOUT-001: Track auto-retry attempts for exponential backoff */
  @state() private autoRetryAttempt = 0;
  /** TOUT-001: Whether current error is retryable (timeout, network, server) */
  @state() private isRetryableError = false;
  @state() private blogData: Blog | null = null;

  /** STOR-006: Cache keys for pagination cursor persistence (one per tab) */
  private followersPaginationKey = '';
  private followingPaginationKey = '';

  connectedCallback(): void {
    super.connectedCallback();
    this.loadFromUrl();
    // Save pagination state when user navigates away
    window.addEventListener('beforeunload', this.savePaginationState);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('beforeunload', this.savePaginationState);
    this.savePaginationState(); // Also save when component unmounts
    const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
    if (sentinel) {
      scrollObserver.unobserve(sentinel);
    }
    clearBlogTheme();
  }

  /** STOR-006: Save pagination state for both tabs */
  private savePaginationState = (): void => {
    // Save followers tab state if we have data
    if (this.followersPaginationKey && this.followers.length > 0) {
      setCachedPaginationCursor(
        this.followersPaginationKey,
        this.followersCursor,
        window.scrollY,
        this.followers.length,
        this.followersExhausted
      );
    }
    // Save following tab state if we have data
    if (this.followingPaginationKey && this.following.length > 0) {
      setCachedPaginationCursor(
        this.followingPaginationKey,
        this.followingCursor,
        window.scrollY,
        this.following.length,
        this.followingExhausted
      );
    }
  };

  private async loadFromUrl(): Promise<void> {
    this.blogName = getBlogName();
    const tab = getUrlParam('tab') as Tab;
    if (tab === 'followers' || tab === 'following') {
      this.activeTab = tab;
    }

    if (!this.blogName) {
      this.errorMessage = ErrorMessages.VALIDATION.NO_BLOG_SPECIFIED;
      return;
    }

    // Resolve blog name to ID using cached resolver
    try {
      this.statusMessage = 'Resolving blog...';

      // Initialize blog theming (fetches blog metadata and applies custom colors)
      this.blogData = await initBlogTheme(this.blogName);

      const blogId = await resolveIdentifierCached(this.blogName);

      if (!blogId) {
        this.errorMessage = ErrorMessages.BLOG.notFound(this.blogName);
        this.statusMessage = '';
        return;
      }

      this.blogId = blogId;
      this.statusMessage = '';
      await this.loadData();
    } catch (e) {
      // Use context-aware error messages for better user guidance
      this.errorMessage = getContextualErrorMessage(e, 'resolve_blog', { blogName: this.blogName });
      // TOUT-001: Check if error is retryable
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
      this.statusMessage = '';
    }
  }

  private observeSentinel(): void {
    requestAnimationFrame(() => {
      const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
      if (sentinel) {
        // Use shared observer - callback checks conditions each time
        scrollObserver.observe(sentinel, () => {
          if (this.infiniteScroll && !this.loading && !this.isExhausted && this.blogId) {
            this.loadMore();
          }
        });
      }
    });
  }

  private get isExhausted(): boolean {
    return this.activeTab === 'followers' ? this.followersExhausted : this.followingExhausted;
  }

  private get currentList(): FollowEdge[] {
    return this.activeTab === 'followers' ? this.followers : this.following;
  }

  private async loadData(): Promise<void> {
    if (!this.blogId) return;

    // Only set blog param if not already in URL path (URL-001)
    const params: Record<string, string> = { tab: this.activeTab };
    if (!isBlogInPath()) {
      params.blog = this.blogName;
    }
    setUrlParams(params);

    // STOR-006: Generate pagination keys for cursor caching (one per tab)
    this.followersPaginationKey = generatePaginationCursorKey('social-followers', {
      blog: this.blogName,
    });
    this.followingPaginationKey = generatePaginationCursorKey('social-following', {
      blog: this.blogName,
    });

    // STOR-006: Check for cached pagination state to resume from previous position
    const activeKey = this.activeTab === 'followers'
      ? this.followersPaginationKey
      : this.followingPaginationKey;
    const cachedState = getCachedPaginationCursor(activeKey);
    if (cachedState && cachedState.itemCount > 0) {
      // Restore cursor position for the active tab
      if (this.activeTab === 'followers') {
        this.followersCursor = cachedState.cursor;
        this.followersExhausted = cachedState.exhausted;
      } else {
        this.followingCursor = cachedState.cursor;
        this.followingExhausted = cachedState.exhausted;
      }
      // Schedule scroll restoration after initial load
      const scrollTarget = cachedState.scrollPosition;
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.scrollTo({ top: scrollTarget, behavior: 'auto' });
        }, 100);
      });
    }

    try {
      await this.fetchPage();
    } catch (e) {
      // Use context-aware error messages for better user guidance
      const operation = this.activeTab === 'followers' ? 'load_followers' : 'load_following';
      this.errorMessage = getContextualErrorMessage(e, operation, { blogName: this.blogName });
      // TOUT-001: Check if error is retryable
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
    }

    this.observeSentinel();
  }

  private async fetchPage(): Promise<void> {
    if (!this.blogId) return;

    this.loading = true;

    try {
      const direction = this.activeTab === 'followers' ? 'followers' : 'following';
      const cursor = this.activeTab === 'followers' ? this.followersCursor : this.followingCursor;

      const resp = await blogFollowGraphCached({
        blog_id: this.blogId,
        direction: direction === 'followers' ? 0 : 1,
        page_size: PAGE_SIZE,
        page_token: cursor || undefined,
      });

      // SOC-018: Handle both snake_case and camelCase field names from API response
      // The API may return followers_count/following_count (snake_case) but TypeScript
      // interface expects followersCount/followingCount (camelCase)
      const rawResp = resp as unknown as Record<string, unknown>;
      const followersCountFromApi = (resp.followersCount ?? rawResp['followers_count'] ?? 0) as number;
      const followingCountFromApi = (resp.followingCount ?? rawResp['following_count'] ?? 0) as number;
      const nextPageTokenFromApi = (resp.nextPageToken ?? rawResp['next_page_token'] ?? null) as string | null;

      // Always capture both counts from the API response if available
      // The API returns both followersCount and followingCount regardless of which direction was requested
      if (followersCountFromApi > 0) {
        this.followersCount = followersCountFromApi;
      }
      if (followingCountFromApi > 0) {
        this.followingCount = followingCountFromApi;
      }

      if (this.activeTab === 'followers') {
        const items = resp.followers || [];
        this.followers = [...this.followers, ...items];
        this.followersCursor = nextPageTokenFromApi;

        // Only fall back to loaded length if API didn't provide a count
        if (this.followersCount === 0 && this.followers.length > 0) {
          this.followersCount = this.followers.length;
        }

        if (!this.followersCursor || items.length === 0) {
          this.followersExhausted = true;
        }
      } else {
        const items = resp.following || [];
        this.following = [...this.following, ...items];
        this.followingCursor = nextPageTokenFromApi;

        // Only fall back to loaded length if API didn't provide a count
        if (this.followingCount === 0 && this.following.length > 0) {
          this.followingCount = this.following.length;
        }

        if (!this.followingCursor || items.length === 0) {
          this.followingExhausted = true;
        }
      }
    } catch (e) {
      // Use context-aware error messages for better user guidance
      const operation = this.activeTab === 'followers' ? 'load_followers' : 'load_following';
      this.errorMessage = getContextualErrorMessage(e, operation, { blogName: this.blogName });
      // TOUT-001: Check if error is retryable
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
    } finally {
      this.loading = false;
    }
  }

  private async loadMore(): Promise<void> {
    if (this.loading || this.isExhausted) return;
    await this.fetchPage();
  }

  private async switchTab(tab: Tab): Promise<void> {
    if (tab === this.activeTab) return;

    this.activeTab = tab;

    // Only set blog param if not already in URL path (URL-001)
    const params: Record<string, string> = { tab: this.activeTab };
    if (!isBlogInPath()) {
      params.blog = this.blogName;
    }
    setUrlParams(params);

    // Load if empty
    if (this.currentList.length === 0) {
      await this.fetchPage();
    }

    this.observeSentinel();
  }

  private handleInfiniteToggle(e: CustomEvent): void {
    this.infiniteScroll = e.detail.enabled;
    if (this.infiniteScroll) {
      this.observeSentinel();
    }
  }

  private async handleRetry(e?: CustomEvent): Promise<void> {
    const isAutoRetry = e?.detail?.isAutoRetry ?? false;
    this.retrying = true;
    this.errorMessage = '';
    this.isRetryableError = false;

    try {
      if (!this.blogId) {
        await this.loadFromUrl();
      } else {
        await this.fetchPage();
      }
      this.autoRetryAttempt = 0; // reset on success
    } catch {
      if (isAutoRetry && this.isRetryableError) {
        this.autoRetryAttempt++;
      }
    }

    this.retrying = false;
  }

  render() {
    return html`
      <offline-banner></offline-banner>
      <shared-nav currentPage="social"></shared-nav>

      <div class="content">
        ${this.blogName
          ? html`
              <div class="blog-header">
                <h1 class="blog-name">@${this.blogName}</h1>
                ${this.blogData?.title ? html`<p class="blog-meta">${this.blogData.title}</p>` : ''}
                ${this.blogId ? html`<p class="blog-meta">Social Connections</p>` : ''}
              </div>
              <blog-context page="social" .viewedBlog=${this.blogName}></blog-context>
            `
          : ''}

        ${this.errorMessage
          ? html`
              <error-state
                title="Error"
                message=${this.errorMessage}
                ?retrying=${this.retrying}
                ?autoRetry=${this.isRetryableError}
                .autoRetryAttempt=${this.autoRetryAttempt}
                @retry=${this.handleRetry}
              ></error-state>
            `
          : ''}

        ${this.blogId
          ? html`
              <div class="tabs">
                <button
                  class="tab ${this.activeTab === 'followers' ? 'active' : ''}"
                  @click=${() => this.switchTab('followers')}
                >
                  Followers ${this.followersCount > 0 ? `(${this.followersCount})` : this.followers.length > 0 ? `(${this.followers.length})` : ''}
                </button>
                <button
                  class="tab ${this.activeTab === 'following' ? 'active' : ''}"
                  @click=${() => this.switchTab('following')}
                >
                  Following ${this.followingCount > 0 ? `(${this.followingCount})` : this.following.length > 0 ? `(${this.following.length})` : ''}
                </button>
              </div>
            `
          : ''}

        ${this.statusMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}

        ${this.currentList.length > 0
          ? html`
              <div class="list-container">
                <blog-list .items=${this.currentList}></blog-list>
              </div>

              <load-footer
                mode="list"
                pageName="social"
                .totalCount=${this.currentList.length}
                .loading=${this.loading}
                .exhausted=${this.isExhausted}
                .infiniteScroll=${this.infiniteScroll}
                @load-more=${() => this.loadMore()}
                @infinite-toggle=${this.handleInfiniteToggle}
              ></load-footer>
            `
          : this.blogId && !this.loading
          ? html`<div class="status">No ${this.activeTab} found</div>`
          : ''}

        ${this.loading && this.currentList.length === 0
          ? html`<skeleton-loader variant="blog-list" count="8" trackTime></skeleton-loader>`
          : ''}

        <div id="scroll-sentinel" style="height:1px;"></div>
      </div>
    `;
  }
}

// Initialize app (theme already initialized at top of module)
const app = document.createElement('social-page');
document.body.appendChild(app);
