import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { initTheme, injectGlobalStyles, baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, isApiError, toApiError } from '../services/api-error.js';
import { getUrlParam, setUrlParams, buildBlogPageUrl } from '../services/blog-resolver.js';
import {
  generatePaginationCursorKey,
  getCachedPaginationCursor,
  setCachedPaginationCursor,
} from '../services/storage.js';
import type { Blog, BlogSortField, Order } from '../types/api.js';
import { BREAKPOINTS } from '../types/ui-constants.js';
import '../components/shared-nav.js';
import '../components/blog-card.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/skeleton-loader.js';
import '../components/error-state.js';
import '../components/offline-banner.js';

// Initialize theme immediately to prevent FOUC (Flash of Unstyled Content)
injectGlobalStyles();
initTheme();

const PAGE_SIZE = 20;

interface BlogSortOption {
  value: string;
  label: string;
  field: BlogSortField;
  order: Order;
  /** If true, this sort option uses list-blogs-recent-activity with empty blog_ids */
  usesRecentActivityApi?: boolean;
}

// BlogSortField: 1=ID, 2=FOLLOWERS_COUNT, 3=POSTS_COUNT, 4=NAME, 5=CREATED_AT
const BLOG_SORT_OPTIONS: BlogSortOption[] = [
  { value: 'recent-activity', label: 'Recently Active', field: 5, order: 2, usesRecentActivityApi: true },
  { value: 'followers:0', label: 'Most Followers', field: 2, order: 1 },
  { value: 'posts:0', label: 'Most Posts', field: 3, order: 1 },
  { value: 'name:0', label: 'Name (A-Z)', field: 4, order: 0 },
  { value: 'created:0', label: 'Recently Joined', field: 5, order: 1 },
];

@customElement('blogs-page')
export class BlogsPage extends LitElement {
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

      .search-box {
        max-width: 500px;
        margin: 0 auto 16px;
        padding: 0 16px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: center;
      }

      .search-box input {
        flex: 1;
        min-width: 150px;
        max-width: 250px;
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: var(--text-primary);
        font-size: 14px;
        min-height: 32px;
      }

      .search-box input:focus {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }

      .search-box select {
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: var(--text-primary);
        font-size: 13px;
        min-height: 32px;
      }

      .search-box button {
        padding: 8px 16px;
        border-radius: 4px;
        background: var(--accent);
        color: white;
        font-size: 14px;
        transition: background 0.2s;
        min-height: 32px;
      }

      .search-box button:hover {
        background: var(--accent-hover);
      }

      .search-box button:disabled {
        background: var(--text-muted);
        cursor: wait;
      }

      .status {
        text-align: center;
        color: var(--text-muted);
        padding: 40px 16px;
      }

      .skeleton-container {
        display: block;
        max-width: 1200px;
        margin: 0 auto 20px;
        padding: 0 16px;
        box-sizing: border-box;
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
        padding: 0 16px;
        max-width: 1200px;
        margin: 0 auto 20px;
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

      /* Mobile: max-width below BREAKPOINTS.MOBILE */
      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {
        .search-box {
          flex-direction: column;
        }

        .search-box input,
        .search-box select,
        .search-box button {
          width: 100%;
        }
      }
    `,
  ];

  @state() private query = '';
  @state() private sortValue = 'followers:0';
  @state() private blogs: Blog[] = [];
  @state() private loading = false;
  @state() private searching = false;
  @state() private exhausted = false;
  @state() private statusMessage = '';
  @state() private errorMessage = '';
  @state() private retrying = false;
  @state() private hasSearched = false;
  @state() private totalCount = 0;
  @state() private effectiveQuery = '';
  /** TOUT-001: Track auto-retry attempts for exponential backoff */
  @state() private autoRetryAttempt = 0;
  /** TOUT-001: Whether current error is retryable (timeout, network, server) */
  @state() private isRetryableError = false;

  private backendCursor: string | null = null;
  private paginationKey = ''; // Cache key for pagination cursor persistence

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
  }

  private savePaginationState = (): void => {
    if (this.paginationKey && this.blogs.length > 0) {
      setCachedPaginationCursor(
        this.paginationKey,
        this.backendCursor,
        window.scrollY,
        this.blogs.length,
        this.exhausted
      );
    }
  };

  private loadFromUrl(): void {
    const q = getUrlParam('q');
    const sort = getUrlParam('sort');

    if (q) this.query = q;
    if (sort) this.sortValue = sort;

    // Find current sort option to check if it uses recent activity API
    const sortOpt = BLOG_SORT_OPTIONS.find((o) => o.value === this.sortValue) || BLOG_SORT_OPTIONS[0];

    // Auto-search if query is provided, OR if "Recently Active" is selected (no query needed)
    if (this.query || sortOpt.usesRecentActivityApi) {
      this.search();
    }
  }

  private resetState(): void {
    this.backendCursor = null;
    this.exhausted = false;
    this.blogs = [];
    this.statusMessage = '';
    this.errorMessage = '';
    this.totalCount = 0;
  }

  private buildPrefixQuery(query: string): string | null {
    const trimmed = query.trim();
    if (!trimmed) return null;

    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;

    const prefixed = tokens.map((token) => {
      const isNegated = token.startsWith('-');
      const core = isNegated ? token.slice(1) : token;
      if (!core || core.includes('*')) {
        return token;
      }
      const withWildcard = `${core}*`;
      return isNegated ? `-${withWildcard}` : withWildcard;
    });

    const candidate = prefixed.join(' ');
    return candidate !== trimmed ? candidate : null;
  }

  private async search(): Promise<void> {
    const trimmedQuery = this.query.trim();
    const sortOpt = BLOG_SORT_OPTIONS.find((o) => o.value === this.sortValue) || BLOG_SORT_OPTIONS[0];

    // "Recently Active" doesn't require a search query
    if (!trimmedQuery && !sortOpt.usesRecentActivityApi) return;

    this.query = trimmedQuery;
    this.effectiveQuery = trimmedQuery;

    this.searching = true;
    this.resetState();
    this.hasSearched = true;

    // Update URL params - include sort even without query for Recently Active
    // Use empty string for q when no query, which setUrlParams will handle by removing the param
    setUrlParams({
      q: trimmedQuery || '',
      sort: this.sortValue,
    });

    // Generate pagination key for cursor caching (CACHE-003)
    this.paginationKey = generatePaginationCursorKey('blogs', {
      q: trimmedQuery,
      sort: this.sortValue,
    });

    // Check for cached pagination state to resume from previous position
    const cachedState = getCachedPaginationCursor(this.paginationKey);
    if (cachedState && cachedState.itemCount > 0) {
      // Restore cursor position - will resume loading from this point
      this.backendCursor = cachedState.cursor;
      this.exhausted = cachedState.exhausted;
      // Schedule scroll restoration after initial load
      const scrollTarget = cachedState.scrollPosition;
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.scrollTo({ top: scrollTarget, behavior: 'auto' });
        }, 100);
      });
    }

    try {
      await this.loadBlogs();
    } catch (e) {
      // Use context-aware error messages for better user guidance
      this.errorMessage = getContextualErrorMessage(e, 'search_blogs', { query: this.query });
      // TOUT-001: Check if error is retryable
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
    }

    this.searching = false;
  }

  /**
   * TOUT-001: Handle retry events from error-state, supporting auto-retry.
   * @param e CustomEvent with detail.isAutoRetry and detail.attempt
   */
  private async handleRetry(e?: CustomEvent): Promise<void> {
    const isAutoRetry = e?.detail?.isAutoRetry ?? false;

    this.retrying = true;
    this.errorMessage = '';
    this.isRetryableError = false;

    try {
      await this.loadBlogs();
      // Success - reset auto-retry counter
      this.autoRetryAttempt = 0;
    } catch (err) {
      // Use context-aware error messages for better user guidance
      this.errorMessage = getContextualErrorMessage(err, 'search_blogs', { query: this.query });
      // TOUT-001: Check if error is retryable
      const apiError = isApiError(err) ? err : toApiError(err);
      this.isRetryableError = apiError.isRetryable;
      // If this was an auto-retry and we still have a retryable error,
      // increment attempt counter for next backoff
      if (isAutoRetry && this.isRetryableError) {
        this.autoRetryAttempt++;
      }
    }

    this.retrying = false;
  }

  private async loadBlogs(): Promise<void> {
    this.loading = true;

    try {
      const sortOpt = BLOG_SORT_OPTIONS.find((o) => o.value === this.sortValue) || BLOG_SORT_OPTIONS[0];

      // "Recently Active" uses list-blogs-recent-activity with empty blog_ids
      if (sortOpt.usesRecentActivityApi) {
        await this.loadRecentlyActiveBlogs();
        return;
      }

      const baseQuery = (this.effectiveQuery || this.query).trim();

      if (!baseQuery) {
        this.statusMessage = 'Enter a search term';
        return;
      }

      const buildRequest = (query: string, pageToken?: string | null) =>
        apiClient.blogs.searchCached({
          query,
          sort_field: sortOpt.field,
          order: sortOpt.order,
          page: {
            page_size: PAGE_SIZE,
            page_token: pageToken || undefined,
          },
        });

      let activeQuery = baseQuery;
      let resp = await buildRequest(activeQuery, this.backendCursor);

      let blogs = resp.blogs || [];
      let nextCursor = resp.page?.nextPageToken || null;

      const shouldTryPrefixFallback =
        blogs.length === 0 && this.blogs.length === 0 && !this.backendCursor;

      if (shouldTryPrefixFallback) {
        const prefixQuery = this.buildPrefixQuery(baseQuery);
        if (prefixQuery) {
          const fallbackResp = await buildRequest(prefixQuery);
          const fallbackBlogs = fallbackResp.blogs || [];
          if (fallbackBlogs.length > 0) {
            blogs = fallbackBlogs;
            nextCursor = fallbackResp.page?.nextPageToken || null;
            activeQuery = prefixQuery;
            this.statusMessage = `No exact matches. Showing blogs starting with "${baseQuery}".`;
          }
        }
      }

      this.effectiveQuery = activeQuery;
      this.backendCursor = nextCursor;
      this.exhausted = !this.backendCursor;

      if (blogs.length === 0 && this.blogs.length === 0) {
        this.exhausted = true;
        this.statusMessage = 'No blogs found';
      } else {
        this.blogs = [...this.blogs, ...blogs];
        this.totalCount = this.blogs.length;
      }
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load recently active blogs using list-blogs-recent-activity with empty blog_ids.
   * Extracts unique blogs from returned posts and enriches with getBlog metadata.
   */
  private async loadRecentlyActiveBlogs(): Promise<void> {
    try {
      // Call list-blogs-recent-activity with empty blog_ids to get globally active blogs
      const resp = await apiClient.recentActivity.listCached({
        blog_ids: [],
        global_merge: true,
        page: {
          page_size: PAGE_SIZE * 3, // Request more posts to find unique blogs
          page_token: this.backendCursor || undefined,
        },
      });

      const posts = resp.posts || [];
      const nextCursor = resp.page?.nextPageToken || null;

      // Extract unique blog IDs/names from posts
      const seenBlogIds = new Set(this.blogs.map((b) => b.id));
      const newBlogIds: number[] = [];
      const blogNameMap = new Map<number, string>();

      for (const post of posts) {
        if (post.blogId && !seenBlogIds.has(post.blogId)) {
          seenBlogIds.add(post.blogId);
          newBlogIds.push(post.blogId);
          if (post.blogName) {
            blogNameMap.set(post.blogId, post.blogName);
          }
        }
      }

      // Fetch full blog metadata for new blogs (with caching via getBlog)
      const newBlogs: Blog[] = [];
      for (const blogId of newBlogIds.slice(0, PAGE_SIZE)) {
        try {
          const blogResp = await apiClient.blogs.get({ blog_id: blogId });
          if (blogResp.blog) {
            newBlogs.push(blogResp.blog);
          }
        } catch (e) {
          // If getBlog fails, create minimal blog object from post data
          const blogName = blogNameMap.get(blogId);
          if (blogName) {
            newBlogs.push({
              id: blogId,
              name: blogName,
            });
          }
        }
      }

      this.backendCursor = nextCursor;
      this.exhausted = !this.backendCursor || newBlogs.length === 0;

      if (newBlogs.length === 0 && this.blogs.length === 0) {
        this.exhausted = true;
        this.statusMessage = 'No recently active blogs found';
      } else {
        this.blogs = [...this.blogs, ...newBlogs];
        this.totalCount = this.blogs.length;
        this.statusMessage = '';
      }
    } finally {
      this.loading = false;
    }
  }

  private async loadMore(): Promise<void> {
    if (this.loading || this.exhausted) return;
    await this.loadBlogs();
  }

  private handleSortChange(e: Event): void {
    this.sortValue = (e.target as HTMLSelectElement).value;
    const sortOpt = BLOG_SORT_OPTIONS.find((o) => o.value === this.sortValue) || BLOG_SORT_OPTIONS[0];

    // Always search if switching to "Recently Active", or if we've already searched
    if (this.hasSearched || sortOpt.usesRecentActivityApi) {
      this.search();
    }
  }

  private handleBlogClick(e: CustomEvent): void {
    const blog = e.detail.blog as Blog;
    if (blog.name) {
      window.location.href = buildBlogPageUrl(blog.name, 'archive');
    }
  }

  private handleKeyPress(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      this.search();
    }
  }

  render() {
    return html`
      <offline-banner></offline-banner>
      <shared-nav currentPage="blogs"></shared-nav>

      <div class="content">
        <div class="search-box">
          <input
            type="text"
            placeholder="Search blogs..."
            .value=${this.query}
            @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)}
            @keypress=${this.handleKeyPress}
          />
          <select .value=${this.sortValue} @change=${this.handleSortChange}>
            ${BLOG_SORT_OPTIONS.map(
              (opt) => html`<option value=${opt.value}>${opt.label}</option>`
            )}
          </select>
          <button ?disabled=${this.searching} @click=${() => this.search()}>Search</button>
        </div>

        ${this.searching && this.blogs.length === 0
          ? html`
              <skeleton-loader
                class="skeleton-container"
                variant="blog-card"
                count="8"
                trackTime
              ></skeleton-loader>
            `
          : ''}

        ${this.errorMessage && !this.searching
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

        ${this.statusMessage && !this.searching && !this.errorMessage
          ? html`<div class="status">${this.statusMessage}</div>`
          : ''}

        ${this.blogs.length > 0
          ? html`
              <div class="grid">
                ${this.blogs.map(
                  (blog) => html`
                    <blog-card
                      .blog=${blog}
                      @blog-click=${this.handleBlogClick}
                    ></blog-card>
                  `
                )}
              </div>

              <load-footer
                mode="archive"
                pageName="blogs"
                .stats=${{ loaded: this.totalCount, filtered: this.totalCount }}
                .loading=${this.loading}
                .exhausted=${this.exhausted}
                @load-more=${() => this.loadMore()}
              ></load-footer>
            `
          : ''}
      </div>
    `;
  }
}

// Initialize app (theme already initialized at top of module)
const app = document.createElement('blogs-page');
document.body.appendChild(app);
