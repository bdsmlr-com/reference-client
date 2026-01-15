import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { initTheme, injectGlobalStyles, baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { getBlogName, getUrlParam, setUrlParams, isBlogInPath, isDefaultTypes } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import {
  generatePaginationCursorKey,
  getCachedPaginationCursor,
  setCachedPaginationCursor,
} from '../services/storage.js';
import type { Blog } from '../types/api.js';
import { extractMedia, type ProcessedPost, type ViewStats, SORT_OPTIONS } from '../types/post.js';
import type { Post, PostType, PostSortField, Order, PostVariant } from '../types/api.js';
import '../components/shared-nav.js';
import '../components/sort-controls.js';
import '../components/type-pills.js';
import '../components/variant-pills.js';
import '../components/post-grid.js';
import '../components/load-footer.js';
import '../components/post-lightbox.js';
import '../components/loading-spinner.js';
import '../components/skeleton-loader.js';
import '../components/error-state.js';
import '../components/offline-banner.js';
import '../components/blog-header.js';

// Initialize theme immediately to prevent FOUC (Flash of Unstyled Content)
injectGlobalStyles();
initTheme();

const PAGE_SIZE = 12;
const MAX_BACKEND_FETCHES = 20;

@customElement('archive-page')
export class ArchivePage extends LitElement {
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

      .controls {
        max-width: 600px;
        margin: 0 auto 20px;
        padding: 0 16px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
      }

      .type-pills-container {
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

      .error {
        text-align: center;
        color: var(--error);
        padding: 40px 16px;
      }

      .grid-container {
        margin-bottom: 20px;
      }
    `,
  ];

  @state() private blogName = '';
  @state() private blogId: number | null = null;
  @state() private sortValue = '1:0';
  @state() private selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private selectedVariants: PostVariant[] = [];
  @state() private posts: ProcessedPost[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private stats: ViewStats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
  @state() private loadingCurrent = 0;
  @state() private infiniteScroll = false;
  @state() private lightboxPost: ProcessedPost | null = null;
  @state() private lightboxOpen = false;
  @state() private lightboxIndex = -1;
  @state() private statusMessage = '';
  @state() private errorMessage = '';
  @state() private retrying = false;
  @state() private initialLoading = false;
  @state() private blogData: Blog | null = null;
  /** TOUT-001: Track auto-retry attempts for exponential backoff */
  @state() private autoRetryAttempt = 0;
  /** TOUT-001: Whether current error is retryable (timeout, network, server) */
  @state() private isRetryableError = false;

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

  private async loadFromUrl(): Promise<void> {
    // Get blog name from URL parameter
    this.blogName = getBlogName();

    const sort = getUrlParam('sort');
    const types = getUrlParam('types');

    if (sort) this.sortValue = sort;
    if (types) {
      this.selectedTypes = types.split(',').map((t) => parseInt(t, 10) as PostType);
    }

    if (!this.blogName) {
      this.errorMessage = ErrorMessages.VALIDATION.NO_BLOG_SPECIFIED;
      return;
    }

    // Resolve blog name to ID using cached resolver
    this.initialLoading = true;
    this.errorMessage = '';
    try {
      // Initialize blog theming (fetches blog metadata and applies custom colors)
      this.blogData = await initBlogTheme(this.blogName);

      const blogId = await apiClient.identity.resolveNameToId(this.blogName);

      if (!blogId) {
        this.errorMessage = ErrorMessages.BLOG.notFound(this.blogName);
        this.isRetryableError = false;
        this.initialLoading = false;
        return;
      }

      this.blogId = blogId;
      await this.loadPosts();
    } catch (e) {
      // Use context-aware error messages for better user guidance
      this.errorMessage = getContextualErrorMessage(e, 'resolve_blog', { blogName: this.blogName });
      // TOUT-001: Check if error is retryable
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
    } finally {
      this.initialLoading = false;
    }
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
      await this.loadFromUrl();
      // Success - reset auto-retry counter
      this.autoRetryAttempt = 0;
    } catch {
      // Error already shown by loadFromUrl
      // If this was an auto-retry and we still have a retryable error,
      // increment attempt counter for next backoff
      if (isAutoRetry && this.isRetryableError) {
        this.autoRetryAttempt++;
      }
    }

    this.retrying = false;
  }

  private observeSentinel(): void {
    requestAnimationFrame(() => {
      const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
      if (sentinel) {
        // Use shared observer - callback checks conditions each time
        scrollObserver.observe(sentinel, () => {
          if (this.infiniteScroll && !this.loading && !this.exhausted && this.blogId) {
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
    this.stats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
    this.posts = [];
    this.statusMessage = '';
  }

  private async loadPosts(): Promise<void> {
    if (!this.blogId) return;
    if (this.selectedTypes.length === 0) {
      this.statusMessage = ErrorMessages.VALIDATION.NO_TYPES_SELECTED;
      return;
    }

    this.resetState();

    // Build URL params, only including non-default values (URL-002)
    const params: Record<string, string> = {
      sort: this.sortValue,
      // Pass empty string for types if default, so it gets removed from URL
      types: isDefaultTypes(this.selectedTypes) ? '' : this.selectedTypes.join(','),
    };
    // Only set blog param if not already in URL path (URL-001)
    if (!isBlogInPath()) {
      params.blog = this.blogName;
    }
    setUrlParams(params);

    // Generate pagination key for cursor caching (CACHE-003)
    this.paginationKey = generatePaginationCursorKey('archive', {
      blog: this.blogName,
      sort: this.sortValue,
      types: this.selectedTypes.join(','),
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
      this.errorMessage = getContextualErrorMessage(e, 'load_posts', { blogName: this.blogName });
      // TOUT-001: Check if error is retryable
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
    }

    this.observeSentinel();
  }

  private async fillPage(): Promise<void> {
    if (!this.blogId) return;

    const buffer: ProcessedPost[] = [];
    let backendFetches = 0;

    this.loading = true;
    this.loadingCurrent = 0;

    const sortOpt = SORT_OPTIONS.find((o) => o.value === this.sortValue) || SORT_OPTIONS[0];

    try {
      while (buffer.length < PAGE_SIZE && !this.exhausted && backendFetches < MAX_BACKEND_FETCHES) {
        backendFetches++;

        const resp = await apiClient.posts.list({
          blog_id: this.blogId,
          sort_field: sortOpt.field as PostSortField,
          order: sortOpt.order as Order,
          post_types: this.selectedTypes,
          variants: this.selectedVariants.length > 0 ? this.selectedVariants : undefined,
          page: {
            page_size: 100,
            page_token: this.backendCursor || undefined,
          },
        });

        const posts = resp.posts || [];
        this.backendCursor = resp.page?.nextPageToken || null;

        if (!this.backendCursor) {
          this.exhausted = true;
        }

        if (posts.length === 0) {
          this.exhausted = true;
          break;
        }

        const candidates: Post[] = [];
        for (const post of posts) {
          if (this.seenIds.has(post.id)) {
            this.stats = { ...this.stats, dupes: this.stats.dupes + 1 };
            continue;
          }

          const media = extractMedia(post);
          const mediaUrl = media.videoUrl || media.audioUrl || media.url;

          if (mediaUrl) {
            const normalizedUrl = mediaUrl.split('?')[0];
            if (this.seenUrls.has(normalizedUrl)) {
              this.stats = { ...this.stats, dupes: this.stats.dupes + 1 };
              this.seenIds.add(post.id);
              continue;
            }
            this.seenUrls.add(normalizedUrl);
          }

          this.seenIds.add(post.id);
          candidates.push(post);
        }

        const validationResults = await Promise.all(
          candidates.map(async (post) => {
            const media = extractMedia(post);
            if (media.type === 'video' || media.type === 'audio') {
              return { post, exists: true };
            }
            if (media.url) {
              const exists = await apiClient.media.checkImageExists(media.url);
              return { post, exists };
            }
            return { post, exists: true };
          })
        );

        for (const { post, exists } of validationResults) {
          if (!exists) {
            this.stats = { ...this.stats, notFound: this.stats.notFound + 1 };
            continue;
          }

          const isDeleted = !!post.deletedAtUnix;

          if (isDeleted) {
            this.stats = { ...this.stats, deleted: this.stats.deleted + 1 };
            continue;
          }

          this.stats = { ...this.stats, found: this.stats.found + 1 };

          const processedPost: ProcessedPost = {
            ...post,
            _media: extractMedia(post),
          };

          buffer.push(processedPost);
          this.loadingCurrent = buffer.length;

          if (buffer.length >= PAGE_SIZE) break;
        }

        if (buffer.length >= PAGE_SIZE) break;
      }

      if (buffer.length > 0) {
        this.posts = [...this.posts, ...buffer];
      } else if (this.stats.found === 0 && this.exhausted) {
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

  private handleSortChange(e: CustomEvent): void {
    this.sortValue = e.detail.value;
    if (this.blogId) {
      this.loadPosts();
    }
  }

  private handleTypesChange(e: CustomEvent): void {
    this.selectedTypes = e.detail.types;
    if (this.blogId) {
      this.loadPosts();
    }
  }

  private handleVariantChange(e: CustomEvent): void {
    this.selectedVariants = e.detail.variants || [];
    if (this.blogId) {
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

  render() {
    return html`
      <offline-banner></offline-banner>
      <shared-nav currentPage="archive"></shared-nav>

      <div class="content">
        ${this.blogName
          ? html`
              <blog-header
                page="archive"
                .blogName=${this.blogName}
                .blogTitle=${this.blogData?.title || ''}
              ></blog-header>
            `
          : ''}

        ${this.initialLoading && !this.blogId
          ? html`<loading-spinner message="Loading..." trackTime></loading-spinner>`
          : ''}

        ${this.blogId
          ? html`
              <div class="controls">
                <sort-controls .value=${this.sortValue} @sort-change=${this.handleSortChange}></sort-controls>
              </div>

              <div class="type-pills-container">
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

        ${this.statusMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}

        ${this.loading && this.posts.length === 0 && !this.errorMessage && this.blogId
          ? html`<div class="grid-container"><skeleton-loader variant="post-card" count="8" trackTime></skeleton-loader></div>`
          : ''}

        ${this.posts.length > 0
          ? html`
              <div class="grid-container">
                <post-grid .posts=${this.posts} @post-click=${this.handlePostClick}></post-grid>
              </div>

              <load-footer
                mode="archive"
                pageName="archive"
                .stats=${this.stats}
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
const app = document.createElement('archive-page');
document.body.appendChild(app);
