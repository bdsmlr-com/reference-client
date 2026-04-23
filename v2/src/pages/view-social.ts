import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { getUrlParam, setUrlParams, isBlogInPath } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import {
  generatePaginationCursorKey,
  getCachedPaginationCursor,
  setCachedPaginationCursor,
} from '../services/storage.js';
import {
  mergeFollowEdges,
  countNewFollowEdges,
  shouldStopFollowPagination,
  fingerprintFollowEdges,
} from '../services/follow-pagination.js';
import { getPageSlotConfig } from '../services/render-page.js';
import type { RenderSlotConfig } from '../config.js';
import type { FollowEdge, Blog } from '../types/api.js';
import '../components/blog-list.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/error-state.js';
import '../components/blog-header.js';
import '../components/render-card.js';

const PAGE_SIZE = 100;
type Tab = 'followers' | 'following';

@customElement('view-social')
export class ViewSocial extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--blog-bg, var(--bg-primary));
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

  @property({ type: String }) blog = '';

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
  @state() private autoRetryAttempt = 0;
  @state() private isRetryableError = false;
  @state() private blogData: Blog | null = null;
  private readonly mainSlotConfig: RenderSlotConfig = getPageSlotConfig('social', 'main_stream');
  /** SOC-019: Bypass cached follow graph on next fetch after mismatch */
  private skipCacheOnNextFetch = false;

  private followersPaginationKey = '';
  private followingPaginationKey = '';
  private lastFollowersPageFingerprint: string | null = null;
  private lastFollowingPageFingerprint: string | null = null;
  private seenFollowersCursors = new Set<string>();
  private seenFollowingCursors = new Set<string>();
  private followersPageAttempts = 0;
  private followingPageAttempts = 0;
  private readonly maxPageAttempts = 32;

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('blog')) {
      this.loadFromUrl();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('beforeunload', this.savePaginationState);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('beforeunload', this.savePaginationState);
    this.savePaginationState();
    const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
    if (sentinel) {
      scrollObserver.unobserve(sentinel);
    }
    clearBlogTheme();
  }

  private savePaginationState = (): void => {
    if (this.followersPaginationKey && this.followers.length > 0) {
      setCachedPaginationCursor(
        this.followersPaginationKey,
        this.followersCursor,
        window.scrollY,
        this.followers.length,
        this.followersExhausted
      );
    }
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
    this.lastFollowersPageFingerprint = null;
    this.lastFollowingPageFingerprint = null;
    this.seenFollowersCursors.clear();
    this.seenFollowingCursors.clear();
    this.followersPageAttempts = 0;
    this.followingPageAttempts = 0;
    const tab = getUrlParam('tab') as Tab;
    if (tab === 'followers' || tab === 'following') {
      this.activeTab = tab;
    }

    if (!this.blog) {
      this.errorMessage = ErrorMessages.VALIDATION.NO_BLOG_SPECIFIED;
      return;
    }

    try {
      this.statusMessage = 'Resolving blog...';
      this.blogData = await initBlogTheme(this.blog);
      const blogId = await apiClient.identity.resolveNameToId(this.blog);

      if (!blogId) {
        this.errorMessage = ErrorMessages.BLOG.notFound(this.blog);
        this.statusMessage = '';
        return;
      }

      this.blogId = blogId;
      this.statusMessage = '';
      await this.loadData();
    } catch (e) {
      this.errorMessage = getContextualErrorMessage(e, 'resolve_blog', { blogName: this.blog });
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
      this.statusMessage = '';
    }
  }

  private observeSentinel(): void {
    requestAnimationFrame(() => {
      const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
      if (sentinel) {
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

    const params: Record<string, string> = { tab: this.activeTab };
    if (!isBlogInPath()) {
      params.blog = this.blog;
    }
    setUrlParams(params);

    this.followersPaginationKey = generatePaginationCursorKey('social-followers', {
      blog: this.blog,
    });
    this.followingPaginationKey = generatePaginationCursorKey('social-following', {
      blog: this.blog,
    });

    const activeKey = this.activeTab === 'followers'
      ? this.followersPaginationKey
      : this.followingPaginationKey;
    const cachedState = getCachedPaginationCursor(activeKey);
    if (cachedState && cachedState.itemCount > 0) {
      if (this.activeTab === 'followers') {
        this.followersCursor = cachedState.cursor;
        this.followersExhausted = cachedState.exhausted;
      } else {
        this.followingCursor = cachedState.cursor;
        this.followingExhausted = cachedState.exhausted;
      }
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
      const operation = this.activeTab === 'followers' ? 'load_followers' : 'load_following';
      this.errorMessage = getContextualErrorMessage(e, operation, { blogName: this.blog });
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
      const cursorKey = cursor || '__first_page__';

      if (this.activeTab === 'followers') {
        if (this.seenFollowersCursors.has(cursorKey)) {
          this.followersExhausted = true;
          return;
        }
        if (this.followersPageAttempts >= this.maxPageAttempts) {
          this.followersExhausted = true;
          return;
        }
        this.seenFollowersCursors.add(cursorKey);
        this.followersPageAttempts += 1;
      } else {
        if (this.seenFollowingCursors.has(cursorKey)) {
          this.followingExhausted = true;
          return;
        }
        if (this.followingPageAttempts >= this.maxPageAttempts) {
          this.followingExhausted = true;
          return;
        }
        this.seenFollowingCursors.add(cursorKey);
        this.followingPageAttempts += 1;
      }

      const shouldSkipCache = this.skipCacheOnNextFetch;
      this.skipCacheOnNextFetch = false;

      const resp = await apiClient.followGraph.getCached({
        blog_id: this.blogId,
        direction: direction === 'followers' ? 2 : 1,
        page_size: PAGE_SIZE,
        page_token: cursor || undefined,
      }, { skipCache: shouldSkipCache });

      const rawResp = resp as unknown as Record<string, unknown>;
      const followersCountFromApi = (resp.followersCount ?? rawResp['followers_count'] ?? 0) as number;
      const followingCountFromApi = (resp.followingCount ?? rawResp['following_count'] ?? 0) as number;
      const nextPageTokenFromApi = (resp.nextPageToken ?? rawResp['next_page_token'] ?? null) as string | null;

      if (followersCountFromApi > 0) {
        this.followersCount = followersCountFromApi;
      }
      if (followingCountFromApi > 0) {
        this.followingCount = followingCountFromApi;
      }

      if (this.activeTab === 'followers') {
        const items = resp.followers || [];
        const pageFingerprint = fingerprintFollowEdges(items);
        const repeatedPage = !!cursor && this.lastFollowersPageFingerprint === pageFingerprint;
        const newlyAddedCount = countNewFollowEdges(this.followers, items);
        this.followers = mergeFollowEdges(this.followers, items);
        this.lastFollowersPageFingerprint = pageFingerprint;
        const shouldStop = shouldStopFollowPagination({
          previousCursor: cursor,
          nextCursor: nextPageTokenFromApi,
          incomingCount: items.length,
          newlyAddedCount,
          repeatedPage,
          totalCount: this.followersCount,
          loadedCount: this.followers.length,
        });
        this.followersCursor = shouldStop ? null : nextPageTokenFromApi;
        if (this.followersCount > 0) {
          const expectedPages = Math.ceil(this.followersCount / PAGE_SIZE) + 1;
          if (this.followersPageAttempts >= expectedPages) {
            this.followersCursor = null;
            this.followersExhausted = true;
          }
        }

        if (this.followersCount === 0 && this.followers.length > 0) {
          this.followersCount = this.followers.length;
        }

        if (!cursor && this.followersCount > 0 && items.length === 0) {
          this.errorMessage = ErrorMessages.DATA.followDataMismatch(
            this.blog,
            'followers',
            this.followersCount
          );
          this.isRetryableError = true;
          this.skipCacheOnNextFetch = true;
          apiClient.followGraph.invalidateCache(this.blogId);
          return;
        }

        if (shouldStop) {
          this.followersExhausted = true;
        }
      } else {
        const items = resp.following || [];
        const pageFingerprint = fingerprintFollowEdges(items);
        const repeatedPage = !!cursor && this.lastFollowingPageFingerprint === pageFingerprint;
        const newlyAddedCount = countNewFollowEdges(this.following, items);
        this.following = mergeFollowEdges(this.following, items);
        this.lastFollowingPageFingerprint = pageFingerprint;
        const shouldStop = shouldStopFollowPagination({
          previousCursor: cursor,
          nextCursor: nextPageTokenFromApi,
          incomingCount: items.length,
          newlyAddedCount,
          repeatedPage,
          totalCount: this.followingCount,
          loadedCount: this.following.length,
        });
        this.followingCursor = shouldStop ? null : nextPageTokenFromApi;
        if (this.followingCount > 0) {
          const expectedPages = Math.ceil(this.followingCount / PAGE_SIZE) + 1;
          if (this.followingPageAttempts >= expectedPages) {
            this.followingCursor = null;
            this.followingExhausted = true;
          }
        }

        if (this.followingCount === 0 && this.following.length > 0) {
          this.followingCount = this.following.length;
        }

        if (!cursor && this.followingCount > 0 && items.length === 0) {
          this.errorMessage = ErrorMessages.DATA.followDataMismatch(
            this.blog,
            'following',
            this.followingCount
          );
          this.isRetryableError = true;
          this.skipCacheOnNextFetch = true;
          apiClient.followGraph.invalidateCache(this.blogId);
          return;
        }

        if (shouldStop) {
          this.followingExhausted = true;
        }
      }
    } catch (e) {
      const operation = this.activeTab === 'followers' ? 'load_followers' : 'load_following';
      this.errorMessage = getContextualErrorMessage(e, operation, { blogName: this.blog });
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

    const params: Record<string, string> = { tab: this.activeTab };
    if (!isBlogInPath()) {
      params.blog = this.blog;
    }
    setUrlParams(params);

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
      this.autoRetryAttempt = 0;
    } catch {
      if (isAutoRetry && this.isRetryableError) {
        this.autoRetryAttempt++;
      }
    }

    this.retrying = false;
  }

  render() {
    return html`
      <div class="content">
        ${this.blog
          ? html`
              <blog-header
                page="social"
                .blogName=${this.blog}
                .blogTitle=${this.blogData?.title || ''}
              ></blog-header>
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

        ${this.statusMessage && !this.errorMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}

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
          ? html`
              <render-card
                cardType=${this.mainSlotConfig.loading?.cardType || ''}
                count=${this.mainSlotConfig.loading?.count}
                loading
              ></render-card>
            `
          : ''}

        <div id="scroll-sentinel" style="height:1px;"></div>
      </div>
    `;
  }
}
