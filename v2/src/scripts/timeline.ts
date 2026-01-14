import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { initTheme, injectGlobalStyles, baseStyles } from '../styles/theme.js';
import { listBlogPosts, checkImageExists } from '../services/api.js';
import { resolveIdentifierCached } from '../services/api.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { getBlogName, getUrlParam, setUrlParams, isBlogInPath, isDefaultTypes } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import {
  generatePaginationCursorKey,
  getCachedPaginationCursor,
  setCachedPaginationCursor,
} from '../services/storage.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import type { Post, PostType, PostSortField, Order, PostVariant, Blog } from '../types/api.js';
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
import '../components/blog-context.js';

// Initialize theme immediately to prevent FOUC (Flash of Unstyled Content)
injectGlobalStyles();
initTheme();

const PAGE_SIZE = 12;
const MAX_BACKEND_FETCHES = 20;

@customElement('timeline-page')
export class TimelinePage extends LitElement {
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

      .blog-meta a {
        color: var(--accent);
        text-decoration: none;
      }

      .blog-meta a:hover {
        text-decoration: underline;
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

      .feed-container {
        margin-bottom: 20px;
      }
    `,
  ];

  @state() private blogName = '';
  @state() private blogId: number | null = null;
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
  @state() private blogData: Blog | null = null;
  /** TOUT-001: Track auto-retry attempts for exponential backoff */
  @state() private autoRetryAttempt = 0;
  /** TOUT-001: Whether current error is retryable (timeout, network, server) */
  @state() private isRetryableError = false;

  private backendCursor: string | null = null;
  private seenIds = new Set<number>();
  private seenUrls = new Set<string>();
  private paginationKey = ''; // Cache key for pagination cursor persistence

  /**
   * TOUT-001: Show error with optional auto-retry for retryable errors.
   * @param message User-friendly error message
   * @param error Optional original error for retry detection
   */
  private showError(message: string, error?: unknown): void {
    this.errorMessage = message;
    this.statusMessage = '';
    this.loading = false;

    // Check if error is retryable (timeout, network, server error)
    if (error) {
      const apiError = isApiError(error) ? error : toApiError(error);
      this.isRetryableError = apiError.isRetryable;
    } else {
      this.isRetryableError = false;
    }
  }

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
    this.resetForNewBlog();
    const types = getUrlParam('types');

    // Get blog name from URL parameter
    this.blogName = getBlogName();

    if (types) {
      this.selectedTypes = types.split(',').map((t) => parseInt(t, 10) as PostType);
    }

    if (!this.blogName) {
      this.showError(ErrorMessages.VALIDATION.NO_BLOG_SPECIFIED);
      return;
    }

    // Resolve blog name to ID using cached resolver
    try {
      this.statusMessage = 'Resolving blog...';

      // Initialize blog theming (fetches blog metadata and applies custom colors)
      this.blogData = await initBlogTheme(this.blogName);

      const blogId = await resolveIdentifierCached(this.blogName);

      if (!blogId) {
        this.showError(ErrorMessages.BLOG.notFound(this.blogName));
        return;
      }

      this.blogId = blogId;
      this.statusMessage = '';
      await this.loadPosts();
    } catch (e) {
      // Use context-aware error messages for better user guidance
      this.showError(getContextualErrorMessage(e, 'resolve_blog', { blogName: this.blogName }), e);
    }
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
    this.posts = [];
    this.loadingCurrent = 0;
    this.statusMessage = '';
    this.errorMessage = '';
  }

  private resetForNewBlog(): void {
    this.resetState();
    this.blogName = '';
    this.blogId = null;
    this.blogData = null;
    this.loading = false;
    this.lightboxOpen = false;
    this.lightboxPost = null;
    this.lightboxIndex = -1;
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
      // Pass empty string for types if default, so it gets removed from URL
      types: isDefaultTypes(this.selectedTypes) ? '' : this.selectedTypes.join(','),
    };
    // Only set blog param if not already in URL path (URL-001)
    if (!isBlogInPath()) {
      params.blog = this.blogName;
    }
    setUrlParams(params);

    // Generate pagination key for cursor caching (CACHE-003)
    this.paginationKey = generatePaginationCursorKey('timeline', {
      blog: this.blogName,
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
      this.showError(getContextualErrorMessage(e, 'load_posts', { blogName: this.blogName }), e);
    }

    this.observeSentinel();
  }

  private async fillPage(): Promise<void> {
    if (!this.blogId) return;

    const buffer: ProcessedPost[] = [];
    let backendFetches = 0;

    this.loading = true;
    this.loadingCurrent = 0;

    // Timeline is always chronological (newest first)
    const sortField: PostSortField = 1; // CREATED_AT
    const order: Order = 0; // DESC

    try {
      while (buffer.length < PAGE_SIZE && !this.exhausted && backendFetches < MAX_BACKEND_FETCHES) {
        backendFetches++;

        const resp = await listBlogPosts({
          blog_id: this.blogId,
          sort_field: sortField,
          order: order,
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
          candidates.push(post);
        }

        const validationResults = await Promise.all(
          candidates.map(async (post) => {
            const media = extractMedia(post);
            if (media.type === 'video' || media.type === 'audio') {
              return { post, exists: true };
            }
            if (media.url) {
              const exists = await checkImageExists(media.url);
              return { post, exists };
            }
            return { post, exists: true };
          })
        );

        for (const { post, exists } of validationResults) {
          if (!exists) {
            continue;
          }

          const isDeleted = !!post.deletedAtUnix;

          if (isDeleted) {
            continue;
          }

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
      if (!this.blogId) {
        await this.loadFromUrl();
      } else {
        await this.loadPosts();
      }
      // Success - reset auto-retry counter
      this.autoRetryAttempt = 0;
    } catch {
      // Error already shown by loadFromUrl/loadPosts
      // If this was an auto-retry and we still have a retryable error,
      // increment attempt counter for next backoff
      if (isAutoRetry && this.isRetryableError) {
        this.autoRetryAttempt++;
      }
    }

    this.retrying = false;
  }

  render() {
    return html`
      <offline-banner></offline-banner>
      <shared-nav currentPage="timeline"></shared-nav>

      <div class="content">
        ${this.blogName
          ? html`
              <div class="blog-header">
                <h1 class="blog-name">@${this.blogName}</h1>
                ${this.blogData?.title ? html`<p class="blog-meta">${this.blogData.title}</p>` : ''}
                ${this.blogId
                  ? html`
                      <p class="blog-meta">
                        Timeline -
                        <a href="https://${this.blogName}.bdsmlr.com" target="_blank">Visit Blog</a>
                      </p>
                    `
                  : ''}
              </div>
              <blog-context page="timeline" .viewedBlog=${this.blogName}></blog-context>
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

        ${this.statusMessage && !this.errorMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}

        ${this.posts.length > 0
          ? html`
              <div class="feed-container">
                <post-feed .posts=${this.posts} @post-click=${this.handlePostClick}></post-feed>
              </div>

              <load-footer
                mode="timeline"
                pageName="timeline"
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

        ${this.loading && this.posts.length === 0 && !this.errorMessage
          ? html`<skeleton-loader variant="post-feed" count="4" trackTime></skeleton-loader>`
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
const app = document.createElement('timeline-page');
document.body.appendChild(app);
