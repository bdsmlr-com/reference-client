import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { initTheme, injectGlobalStyles, baseStyles } from '../styles/theme.js';
import {
  blogFollowGraphCached,
  listBlogsRecentActivityCached,
  checkImageExists,
  invalidateFollowGraphCache,
} from '../services/api.js';
import { resolveIdentifierCached } from '../services/api.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { getBlogName, setUrlParams, isBlogInPath } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import {
  generatePaginationCursorKey,
  getCachedPaginationCursor,
  setCachedPaginationCursor,
} from '../services/storage.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import type { PostType, PostVariant, Blog } from '../types/api.js';
import { BREAKPOINTS } from '../types/ui-constants.js';
import '../components/shared-nav.js';
import '../components/type-pills.js';
import '../components/variant-pills.js';
import '../components/post-feed.js';
import '../components/load-footer.js';
import '../components/post-lightbox.js';
import '../components/loading-spinner.js';
import '../components/skeleton-loader.js';
import '../components/error-state.js';
import '../components/offline-banner.js';

// Initialize theme immediately to prevent FOUC (Flash of Unstyled Content)
injectGlobalStyles();
initTheme();

const PAGE_SIZE = 20;

@customElement('following-page')
export class FollowingPage extends LitElement {
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

      .blog-input-section {
        max-width: 400px;
        margin: 0 auto 16px;
        padding: 0 16px;
      }

      .blog-input-section h2 {
        font-size: 14px;
        color: var(--text-primary);
        margin: 0 0 8px;
        text-align: center;
      }

      .input-row {
        display: flex;
        gap: 8px;
      }

      .blog-input-section input {
        flex: 1;
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: var(--text-primary);
        font-size: 14px;
        min-height: 32px;
      }

      .blog-input-section input:focus {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }

      .blog-input-section button {
        padding: 8px 16px;
        border-radius: 4px;
        background: var(--accent);
        color: white;
        font-size: 14px;
        min-height: 32px;
        transition: background 0.2s;
        white-space: nowrap;
      }

      .blog-input-section button:hover {
        background: var(--accent-hover);
      }

      .blog-input-section button:disabled {
        background: var(--text-muted);
        cursor: wait;
      }

      .blog-info {
        text-align: center;
        margin-top: 12px;
        color: var(--text-muted);
        font-size: 14px;
      }

      .blog-info .name {
        color: var(--accent);
        font-weight: 600;
      }

      .filters-container {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 20px;
        padding: 0 16px;
      }

      .pills-separator {
        color: var(--text-muted);
        font-size: 16px;
      }

      .status {
        text-align: center;
        color: var(--text-muted);
        padding: 40px 16px;
      }

      .feed-container {
        margin-bottom: 20px;
      }

      /* Mobile: max-width below BREAKPOINTS.MOBILE */
      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {
        .input-row {
          flex-direction: column;
        }
      }
    `,
  ];

  @state() private blogNameInput = '';
  @state() private resolvedBlogName = '';
  @state() private followingBlogIds: number[] = [];
  @state() private followingCount = 0;
  @state() private resolving = false;
  @state() private selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private selectedVariants: PostVariant[] = [];
  @state() private posts: ProcessedPost[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private loadingCurrent = 0;
  @state() private infiniteScroll = false;
  @state() private lightboxPost: ProcessedPost | null = null;
  @state() private lightboxOpen = false;
  @state() private lightboxIndex = -1;
  @state() private statusMessage = '';
  @state() private errorMessage = '';
  @state() private retrying = false;
  /** TOUT-001: Track auto-retry attempts for exponential backoff */
  @state() private autoRetryAttempt = 0;
  /** TOUT-001: Whether current error is retryable (timeout, network, server) */
  @state() private isRetryableError = false;
  @state() private blogData: Blog | null = null;
  /** FOL-008: Track if we should skip cache on next resolve (after showing empty/error state) */
  private skipCacheOnNextResolve = false;
  private emptyFollowingAttempts = 0;

  private backendCursor: string | null = null;
  private seenIds = new Set<number>();
  private seenUrls = new Set<string>();
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
    const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
    if (sentinel) {
      scrollObserver.unobserve(sentinel);
    }
    clearBlogTheme();
  }

  private savePaginationState = (): void => {
    if (this.paginationKey && this.posts.length > 0) {
      setCachedPaginationCursor(
        this.paginationKey,
        this.backendCursor,
        window.scrollY,
        this.posts.length,
        this.exhausted
      );
    }
  };

  private loadFromUrl(): void {
    // Use getBlogName() which checks subdomain > path > query param > localStorage
    // This properly handles path-based URLs like /nonnudecuties/following/ (FOL-005)
    const blog = getBlogName();
    if (blog) {
      this.blogNameInput = blog;
      this.resolveBlog();
    }
  }

  private observeSentinel(): void {
    requestAnimationFrame(() => {
      const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
      if (sentinel) {
        // Use shared observer - callback checks conditions each time
        scrollObserver.observe(sentinel, () => {
          if (this.infiniteScroll && !this.loading && !this.exhausted && this.followingBlogIds.length > 0) {
            this.loadMore();
          }
        });
      }
    });
  }

  private resetState(): void {
    this.backendCursor = null;
    this.exhausted = false;
    this.seenIds.clear();
    this.seenUrls.clear();
    this.posts = [];
    this.statusMessage = '';
  }

  private async resolveBlog(): Promise<void> {
    const name = this.blogNameInput.trim().replace(/^@/, '');
    if (!name) {
      this.statusMessage = 'Please enter a blog name';
      return;
    }

    if (this.resolvedBlogName && this.resolvedBlogName !== name) {
      this.emptyFollowingAttempts = 0;
    }

    this.resolving = true;
    this.statusMessage = `Resolving @${name}...`;

    try {
      // Initialize blog theming (fetches blog metadata and applies custom colors)
      this.blogData = await initBlogTheme(name);

      // Resolve blog name to ID using cached version
      const blogId = await resolveIdentifierCached(name);

      if (!blogId) {
        this.statusMessage = `Blog "@${name}" not found`;
        this.resolving = false;
        return;
      }

      this.resolvedBlogName = name;

      // Only set blog param if not already in URL path (URL-001)
      if (!isBlogInPath()) {
        setUrlParams({ blog: name });
      }

      // Get following list (cached for 30 minutes)
      // FOL-008: Skip cache if we previously showed an empty/error state (user clicked Load again)
      const shouldSkipCache = this.skipCacheOnNextResolve;
      this.skipCacheOnNextResolve = false; // Reset for next time

      const followGraph = await blogFollowGraphCached({
        blog_id: blogId,
        direction: 1,
        page_size: 1000, // Get up to 1000 followed blogs
      }, { skipCache: shouldSkipCache });

      const following = followGraph.following || [];
      // Handle both camelCase (blogId) and snake_case (blog_id) from API
      this.followingBlogIds = following
        .map((f) => (f as { blogId?: number; blog_id?: number }).blogId ?? (f as { blogId?: number; blog_id?: number }).blog_id)
        .filter((id): id is number => id !== undefined && id !== null);
      // Use API-reported count
      this.followingCount = followGraph.followingCount || this.followingBlogIds.length;

      if (this.followingBlogIds.length === 0) {
        // Only show "not following" if there are truly no entries
        if (following.length === 0 && this.followingCount === 0) {
          if (this.emptyFollowingAttempts === 0) {
            this.statusMessage = '';
            this.errorMessage = ErrorMessages.DATA.followDataEmptyRetryable(name, 'following');
            this.isRetryableError = true;
            this.skipCacheOnNextResolve = true;
            this.emptyFollowingAttempts++;
            this.resolving = false;
            return;
          }

          this.statusMessage = ErrorMessages.STATUS.notFollowingAnyone(name);
        } else {
          // FOL-008: API returned count but no usable blogIds - likely cached transient error
          // Invalidate the cache so retry can fetch fresh data
          console.warn(`FOL-008: Data mismatch for @${name} - invalidating follow graph cache`);
          invalidateFollowGraphCache(blogId);
          this.statusMessage = '';
          this.errorMessage = ErrorMessages.DATA.followDataMismatch(name, 'following', this.followingCount);
          this.isRetryableError = true; // Enable auto-retry
          this.skipCacheOnNextResolve = true;
        }
        this.resolving = false;
        return;
      }

      this.statusMessage = '';
      this.resolving = false;
      this.emptyFollowingAttempts = 0;

      // Load posts
      await this.loadPosts();
    } catch (e) {
      // Use context-aware error messages for better user guidance
      this.errorMessage = getContextualErrorMessage(e, 'load_following', { blogName: this.blogNameInput });
      // TOUT-001: Check if error is retryable
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
      // FOL-008: Skip cache on next retry after any error
      this.skipCacheOnNextResolve = true;
      this.statusMessage = '';
      this.resolving = false;
    }
  }

  private async handleRetry(e?: CustomEvent): Promise<void> {
    const isAutoRetry = e?.detail?.isAutoRetry ?? false;
    this.retrying = true;
    this.errorMessage = '';
    this.isRetryableError = false;
    this.statusMessage = '';

    try {
      await this.resolveBlog();
      this.autoRetryAttempt = 0; // reset on success
    } catch {
      if (isAutoRetry && this.isRetryableError) {
        this.autoRetryAttempt++;
      }
    }
    this.retrying = false;
  }

  private async loadPosts(): Promise<void> {
    if (this.followingBlogIds.length === 0) return;
    if (this.selectedTypes.length === 0) {
      this.statusMessage = ErrorMessages.VALIDATION.NO_TYPES_SELECTED;
      return;
    }

    this.resetState();

    // Generate pagination key for cursor caching (STOR-006)
    this.paginationKey = generatePaginationCursorKey('following', {
      blog: this.resolvedBlogName,
      types: this.selectedTypes.join(','),
      variants: this.selectedVariants.join(','),
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
      await this.fillPage();
    } catch (e) {
      // Use context-aware error messages for better user guidance
      this.errorMessage = getContextualErrorMessage(e, 'load_posts', { blogName: this.blogNameInput });
      // TOUT-001: Check if error is retryable
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
    }

    this.observeSentinel();
  }

  private async fillPage(): Promise<void> {
    if (this.followingBlogIds.length === 0) return;

    const buffer: ProcessedPost[] = [];
    this.loading = true;
    this.loadingCurrent = 0;

    try {
      // Use server-side merge with globalMerge=true
      // FOL-009: Per API spec, pass sort_field: 0 (UNSPECIFIED) and limit_per_blog: 0 for merged FYP behavior
      // FOL-010: Use order: 2 for DESC (0=UNSPECIFIED, 1=ASC, 2=DESC)
      const resp = await listBlogsRecentActivityCached({
        blog_ids: this.followingBlogIds,
        post_types: this.selectedTypes,
        variants: this.selectedVariants.length > 0 ? this.selectedVariants : undefined,
        global_merge: true,
        page: {
          page_size: PAGE_SIZE * 2, // Fetch more to account for filtering
          page_token: this.backendCursor || undefined,
        },
        sort_field: 0, // UNSPECIFIED - required for correct merged feed behavior
        order: 2, // DESC - newest first (0=UNSPECIFIED, 1=ASC, 2=DESC)
        limit_per_blog: 0, // Use 0 for merged feed (globalMerge=true)
      });

      const posts = resp.posts || [];
      this.backendCursor = resp.page?.nextPageToken || null;

      if (!this.backendCursor || posts.length === 0) {
        this.exhausted = true;
      }

      // Process posts
      for (const post of posts) {
        if (this.seenIds.has(post.id)) {
          continue;
        }

        const media = extractMedia(post);
        const mediaUrl = media.videoUrl || media.audioUrl || media.url;

        if (mediaUrl) {
          const normalizedUrl = mediaUrl.split('?')[0];
          if (this.seenUrls.has(normalizedUrl)) {
            this.seenIds.add(post.id);
            continue;
          }
          this.seenUrls.add(normalizedUrl);
        }

        this.seenIds.add(post.id);

        // Validate media existence for images
        if (media.type === 'image' && media.url) {
          const exists = await checkImageExists(media.url);
          if (!exists) continue;
        }

        // Skip deleted posts
        if (post.deletedAtUnix) continue;

        const processedPost: ProcessedPost = {
          ...post,
          _media: media,
        };

        buffer.push(processedPost);
        this.loadingCurrent = buffer.length;

        if (buffer.length >= PAGE_SIZE) break;
      }

      if (buffer.length > 0) {
        this.posts = [...this.posts, ...buffer];
      } else if (this.posts.length === 0 && this.exhausted) {
        this.statusMessage = 'No posts found';
      }
    } finally {
      this.loading = false;
    }
  }

  private async loadMore(): Promise<void> {
    if (this.loading || this.exhausted) return;
    await this.fillPage();
  }

  private handleTypesChange(e: CustomEvent): void {
    this.selectedTypes = e.detail.types;
    if (this.followingBlogIds.length > 0) {
      this.loadPosts();
    }
  }

  private handleVariantChange(e: CustomEvent): void {
    this.selectedVariants = e.detail.variants || [];
    if (this.followingBlogIds.length > 0) {
      this.loadPosts();
    }
  }

  private handlePostClick(e: CustomEvent): void {
    const post = e.detail.post as ProcessedPost;
    this.lightboxPost = post;
    this.lightboxIndex = this.posts.findIndex((p) => p.id === post.id);
    this.lightboxOpen = true;
  }

  private handleLightboxClose(): void {
    this.lightboxOpen = false;
  }

  private handleLightboxNavigate(e: CustomEvent): void {
    const index = e.detail.index as number;
    if (index >= 0 && index < this.posts.length) {
      this.lightboxPost = this.posts[index];
      this.lightboxIndex = index;
    }
  }

  private handleInfiniteToggle(e: CustomEvent): void {
    this.infiniteScroll = e.detail.enabled;
    if (this.infiniteScroll) {
      this.observeSentinel();
    }
  }

  private handleKeyPress(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      this.resolveBlog();
    }
  }

  render() {
    return html`
      <offline-banner></offline-banner>
      <shared-nav currentPage="following"></shared-nav>

      <div class="content">
        <div class="blog-input-section">
          <h2>View posts from blogs followed by:</h2>
          <div class="input-row">
            <input
              type="text"
              placeholder="Enter blog name..."
              .value=${this.blogNameInput}
              @input=${(e: Event) => (this.blogNameInput = (e.target as HTMLInputElement).value)}
              @keypress=${this.handleKeyPress}
            />
            <button ?disabled=${this.resolving} @click=${() => this.resolveBlog()}>
              ${this.resolving ? 'Loading...' : 'Load'}
            </button>
          </div>

          ${this.resolvedBlogName && this.followingBlogIds.length > 0
            ? html`
                <div class="blog-info">
                  ${this.blogData?.title ? html`<div style="margin-bottom: 4px;">${this.blogData.title}</div>` : ''}
                  Showing posts from ${this.followingCount} blogs followed by
                  <span class="name">@${this.resolvedBlogName}</span>
                </div>
              `
            : ''}
        </div>

        ${this.followingBlogIds.length > 0
          ? html`
              <div class="filters-container">
                <type-pills
                  .selectedTypes=${this.selectedTypes}
                  @types-change=${this.handleTypesChange}
                ></type-pills>
                <span class="pills-separator">|</span>
                <variant-pills
                  .loading=${this.loading}
                  @variant-change=${this.handleVariantChange}
                ></variant-pills>
              </div>
            `
          : ''}

        ${this.resolving && !this.errorMessage
          ? html`<loading-spinner message="Loading..." trackTime></loading-spinner>`
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

        ${this.statusMessage && !this.resolving ? html`<div class="status">${this.statusMessage}</div>` : ''}

        ${this.loading && this.posts.length === 0 && !this.errorMessage && !this.resolving
          ? html`<skeleton-loader variant="post-feed" count="4" trackTime></skeleton-loader>`
          : ''}

        ${this.posts.length > 0
          ? html`
              <div class="feed-container">
                <post-feed .posts=${this.posts} @post-click=${this.handlePostClick}></post-feed>
              </div>

              <load-footer
                mode="activity"
                pageName="following"
                .loading=${this.loading}
                .exhausted=${this.exhausted}
                .loadingCurrent=${this.loadingCurrent}
                .loadingTarget=${PAGE_SIZE}
                .infiniteScroll=${this.infiniteScroll}
                @load-more=${() => this.loadMore()}
                @infinite-toggle=${this.handleInfiniteToggle}
              ></load-footer>
            `
          : ''}

        <div id="scroll-sentinel" style="height:1px;"></div>
      </div>

      <post-lightbox
        ?open=${this.lightboxOpen}
        .post=${this.lightboxPost}
        .posts=${this.posts}
        .currentIndex=${this.lightboxIndex}
        @close=${this.handleLightboxClose}
        @navigate=${this.handleLightboxNavigate}
      ></post-lightbox>
    `;
  }
}

// Initialize app (theme already initialized at top of module)
const app = document.createElement('following-page');
document.body.appendChild(app);
