import { LitElement, html, css, unsafeCSS, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { setUrlParams, isBlogInPath } from '../services/blog-resolver.js';
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
import '../components/type-pills.js';
import '../components/variant-pills.js';
import '../components/post-feed.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/skeleton-loader.js';
import '../components/error-state.js';

const PAGE_SIZE = 20;
const MAX_BACKEND_FETCHES = 3;

@customElement('view-feed')
export class ViewFeed extends LitElement {
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

      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {
        .input-row {
          flex-direction: column;
        }
      }
    `,
  ];

  @property({ type: String }) blog = '';

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
  @state() private statusMessage = '';
  @state() private errorMessage = '';
  @state() private retrying = false;
  @state() private autoRetryAttempt = 0;
  @state() private isRetryableError = false;
  @state() private blogData: Blog | null = null;
  private skipCacheOnNextResolve = false;
  private emptyFollowingAttempts = 0;

  private backendCursor: string | null = null;
  private seenIds = new Set<number>();
  private seenUrls = new Set<string>();
  private paginationKey = '';

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('blog')) {
      if (this.blog) {
        this.blogNameInput = this.blog;
        this.resolveBlog();
      }
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

  private observeSentinel(): void {
    requestAnimationFrame(() => {
      const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
      if (sentinel) {
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
      this.blogData = await initBlogTheme(name);
      const blogId = await apiClient.identity.resolveNameToId(name);

      if (!blogId) {
        this.statusMessage = `Blog "@${name}" not found`;
        this.resolving = false;
        return;
      }

      this.resolvedBlogName = name;

      if (!isBlogInPath()) {
        setUrlParams({ blog: name });
      }

      const shouldSkipCache = this.skipCacheOnNextResolve;
      this.skipCacheOnNextResolve = false;

      const followGraph = await apiClient.followGraph.getCached({
        blog_id: blogId,
        direction: 1,
        page_size: 1000,
      }, { skipCache: shouldSkipCache });

      const following = followGraph.following || [];
      this.followingBlogIds = following
        .map((f) => (f as { blogId?: number; blog_id?: number }).blogId ?? (f as { blogId?: number; blog_id?: number }).blog_id)
        .filter((id): id is number => id !== undefined && id !== null);
      this.followingCount = followGraph.followingCount || this.followingBlogIds.length;

      if (this.followingBlogIds.length === 0) {
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
          if (followGraph.fromCache) {
            this.skipCacheOnNextResolve = true;
          }

          this.statusMessage = ErrorMessages.STATUS.notFollowingAnyone(name);
        } else {
          // FOL-008: API returned count but no usable blogIds - likely cached transient error
          // Invalidate the cache so retry can fetch fresh data
          console.warn(`FOL-008: Data mismatch for @${name} - invalidating follow graph cache`);
          apiClient.followGraph.invalidateCache(blogId);
          this.statusMessage = '';
          this.errorMessage = ErrorMessages.DATA.followDataMismatch(name, 'following', this.followingCount);
          this.isRetryableError = true;
          this.skipCacheOnNextResolve = true;
        }
        this.resolving = false;
        return;
      }

      this.statusMessage = '';
      this.resolving = false;
      this.emptyFollowingAttempts = 0;

      await this.loadPosts();
    } catch (e) {
      this.errorMessage = getContextualErrorMessage(e, 'load_following', { blogName: this.blogNameInput });
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
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
      this.autoRetryAttempt = 0;
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

    this.paginationKey = generatePaginationCursorKey('following', {
      blog: this.resolvedBlogName,
      types: this.selectedTypes.join(','),
      variants: this.selectedVariants.join(','),
    });

    const cachedState = getCachedPaginationCursor(this.paginationKey);
    if (cachedState && cachedState.itemCount > 0) {
      this.backendCursor = cachedState.cursor;
      this.exhausted = cachedState.exhausted;
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
      this.errorMessage = getContextualErrorMessage(e, 'load_posts', { blogName: this.blogNameInput });
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
    }

    this.observeSentinel();
  }

  private async fillPage(): Promise<void> {
    if (this.followingBlogIds.length === 0) return;

    const buffer: ProcessedPost[] = [];
    let backendFetches = 0;
    this.loading = true;
    this.loadingCurrent = 0;

    const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';

    try {
      while (buffer.length < PAGE_SIZE && !this.exhausted && backendFetches < MAX_BACKEND_FETCHES) {
        backendFetches++;

        // Use server-side merge with globalMerge=true
        // FOL-009: Per API spec, pass sort_field: 0 (UNSPECIFIED) and limit_per_blog: 0 for merged FYP behavior
        // FOL-010: Use order: 2 for DESC (0=UNSPECIFIED, 1=ASC, 2=DESC)
        const resp = await apiClient.recentActivity.listCached({
          blog_ids: this.followingBlogIds,
          post_types: this.selectedTypes,
          variants: this.selectedVariants.length > 0 ? this.selectedVariants : undefined,
          global_merge: true,
          page: {
            page_size: 48, // Increase batch size to find content faster
            page_token: this.backendCursor || undefined,
          },
          sort_field: 0,
          order: 2,
          limit_per_blog: 0,
        });

        const posts = resp.posts || [];
        this.backendCursor = resp.page?.nextPageToken || null;

        if (!this.backendCursor || posts.length === 0) {
          this.exhausted = true;
        }

        for (const post of posts) {
          if (this.seenIds.has(post.id)) {
            continue;
          }

          const media = extractMedia(post);
          const mediaUrl = media.videoUrl || media.audioUrl || media.url;

          // Deduplicate by URL only for regular users
          if (mediaUrl && !isAdmin) {
            const normalizedUrl = mediaUrl.split('?')[0];
            if (this.seenUrls.has(normalizedUrl)) {
              this.seenIds.add(post.id);
              continue;
            }
            this.seenUrls.add(normalizedUrl);
          }

          this.seenIds.add(post.id);
          if (post.deletedAtUnix) continue;

          const processedPost: ProcessedPost = {
            ...post,
            _media: media,
          };

          buffer.push(processedPost);
          this.loadingCurrent = buffer.length;

          if (buffer.length >= PAGE_SIZE) break;
        }

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
    this.dispatchEvent(new CustomEvent('post-click', {
      detail: { post, posts: this.posts, index: this.posts.findIndex(p => p.id === post.id) },
      bubbles: true,
      composed: true
    }));
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
    `;
  }
}
