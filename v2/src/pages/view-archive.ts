import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { getUrlParam, setUrlParams, isBlogInPath, isDefaultTypes } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import {
  
  
  setCachedPaginationCursor,
} from '../services/storage.js';
import type { Blog } from '../types/api.js';
import { extractMedia, normalizeSortValue, type ProcessedPost, type ViewStats, SORT_OPTIONS } from '../types/post.js';
import type { PostType, PostSortField, Order } from '../types/api.js';
import '../components/sort-controls.js';
import '../components/type-pills.js';
import '../components/variant-pills.js';
import '../components/activity-grid.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/skeleton-loader.js';
import '../components/error-state.js';
import '../components/blog-header.js';

const PAGE_SIZE = 48; // Higher density
const MAX_BACKEND_FETCHES = 3;

@customElement('view-archive')
export class ViewArchive extends LitElement {
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

      .status {
        text-align: center;
        color: var(--text-muted);
        padding: 40px 16px;
      }

      .grid-container {
        margin-bottom: 20px;
        padding: 0 16px;
      }
    `,
  ];

  @property({ type: String }) blog = '';

  @state() private blogId: number | null = null;
  @state() private sortValue = 'newest';
  @state() private selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private posts: ProcessedPost[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private stats: ViewStats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
  
  @state() private infiniteScroll = false;
  @state() private statusMessage = '';
  @state() private errorMessage = '';
  
  @state() private initialLoading = false;
  @state() private blogData: Blog | null = null;
  @state() private autoRetryAttempt = 0;
  @state() private isRetryableError = false;

  private backendCursor: string | null = null;
  private seenIds = new Set<number>();
  private paginationKey = '';

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
    const sort = getUrlParam('sort');
    const types = getUrlParam('types');

    this.sortValue = normalizeSortValue(sort);
    if (types) {
      this.selectedTypes = types.split(',').map((t) => parseInt(t, 10) as PostType);
    }

    if (!this.blog) {
      this.errorMessage = ErrorMessages.VALIDATION.NO_BLOG_SPECIFIED;
      return;
    }

    this.initialLoading = true;
    this.errorMessage = '';
    try {
      this.blogData = await initBlogTheme(this.blog);
      const blogId = await apiClient.identity.resolveNameToId(this.blog);

      if (!blogId) {
        this.errorMessage = ErrorMessages.BLOG.notFound(this.blog);
        this.isRetryableError = false;
        return;
      }

      this.blogId = blogId;
      await this.loadPosts();
    } catch (e) {
      this.errorMessage = getContextualErrorMessage(e, 'resolve_blog', { blogName: this.blog });
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
    } finally {
      this.initialLoading = false;
    }
  }

  private async loadPosts(): Promise<void> {
    if (!this.blogId) return;
    if (this.selectedTypes.length === 0) {
      this.statusMessage = ErrorMessages.VALIDATION.NO_TYPES_SELECTED;
      return;
    }

    this.backendCursor = null;
    this.exhausted = false;
    this.seenIds.clear();
    this.stats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
    this.posts = [];
    this.statusMessage = '';

    const params: Record<string, string> = {
      sort: this.sortValue,
      types: isDefaultTypes(this.selectedTypes) ? '' : this.selectedTypes.join(','),
    };
    if (!isBlogInPath()) {
      params.blog = this.blog;
    }
    setUrlParams(params);

    try {
      await this.fillPage();
    } catch (e) {
      this.errorMessage = getContextualErrorMessage(e, 'load_posts', { blogName: this.blog });
    }

    this.observeSentinel();
  }

  private observeSentinel(): void {
    requestAnimationFrame(() => {
      const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
      if (sentinel) {
        scrollObserver.observe(sentinel, () => {
          if (this.infiniteScroll && !this.loading && !this.exhausted && this.blogId) {
            this.loadMore();
          }
        });
      }
    });
  }

  private async fillPage(): Promise<void> {
    if (!this.blogId) return;

    const buffer: ProcessedPost[] = [];
    let backendFetches = 0;
    this.loading = true;

    const sortOpt = SORT_OPTIONS.find((o) => o.value === this.sortValue) || SORT_OPTIONS[0];

    try {
      while (buffer.length < PAGE_SIZE && !this.exhausted && backendFetches < MAX_BACKEND_FETCHES) {
        backendFetches++;

        const resp = await apiClient.posts.list({
          blog_id: this.blogId,
          sort_field: sortOpt.field as PostSortField,
          order: sortOpt.order as Order,
          post_types: this.selectedTypes,
          page: {
            page_size: 48,
            page_token: this.backendCursor || undefined,
          },
        });

        const posts = resp.posts || [];
        this.backendCursor = resp.page?.nextPageToken || null;
        if (!this.backendCursor) this.exhausted = true;
        if (posts.length === 0) { this.exhausted = true; break; }

        for (const post of posts) {
          if (this.seenIds.has(post.id)) {
            this.stats = { ...this.stats, dupes: this.stats.dupes + 1 };
            continue;
          }

          const isDeleted = !!post.deletedAtUnix;
          const isReblog = post.originPostId && post.originPostId !== post.id;
          const isRedacted = isDeleted || (!post.blogName && isReblog);

          if (isDeleted || isRedacted) {
            this.stats = { ...this.stats, deleted: this.stats.deleted + 1 };
            this.seenIds.add(post.id);
            continue;
          }

          const media = extractMedia(post);
          const mediaUrl = media.url || media.videoUrl || media.audioUrl;
          const cleanUrl = mediaUrl?.split('?')[0];

          if (cleanUrl) {
            const match = buffer.find(p => p._media.url?.split('?')[0] === cleanUrl) || 
                          this.posts.find(p => p._media.url?.split('?')[0] === cleanUrl);

            if (match) {
              match._reblog_variants = match._reblog_variants || [];
              match._reblog_variants.push({ id: post.id, blogName: post.blogName });
              this.stats = { ...this.stats, dupes: this.stats.dupes + 1 };
              this.seenIds.add(post.id);
              continue;
            }
          }

          const processed: ProcessedPost = { ...post, _media: media };
          this.seenIds.add(post.id);
          buffer.push(processed);
          this.stats = { ...this.stats, found: this.stats.found + 1 };
          

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
    this.loadPosts();
  }

  private handleTypesChange(e: CustomEvent): void {
    this.selectedTypes = e.detail.types;
    this.loadPosts();
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
    if (this.infiniteScroll) this.observeSentinel();
  }

  private async handleRetry(e?: CustomEvent): Promise<void> {
    const isAutoRetry = e?.detail?.isAutoRetry ?? false;
    
    this.errorMessage = '';
    try {
      await this.loadFromUrl();
      this.autoRetryAttempt = 0;
    } catch {
      if (isAutoRetry && this.isRetryableError) this.autoRetryAttempt++;
    }
    
  }

  render() {
    return html`
      <div class="content">
        <blog-header page="archive" .blogName=${this.blog} .blogTitle=${this.blogData?.title || ''}></blog-header>

        ${this.initialLoading ? html`<loading-spinner message="Loading archive..."></loading-spinner>` : ''}

        ${this.blogId ? html`
          <div class="controls">
            <sort-controls .value=${this.sortValue} @sort-change=${this.handleSortChange}></sort-controls>
          </div>
          <div class="type-pills-container">
            <type-pills .selectedTypes=${this.selectedTypes} @types-change=${this.handleTypesChange}></type-pills>
          </div>
        ` : ''}

        ${this.errorMessage ? html`<error-state title="Error" message=${this.errorMessage} @retry=${this.handleRetry}></error-state>` : ''}
        ${this.statusMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}

        <div class="grid-container">
          <activity-grid 
            .items=${this.posts.map(p => ({ 
              post: p, 
              type: (p.originPostId && p.originPostId !== p.id) ? 'reblog' : 'post' 
            }))} 
            @activity-click=${this.handlePostClick}
          ></activity-grid>
        </div>

        <load-footer
          mode="archive"
          pageName="archive"
          .stats=${this.stats}
          .loading=${this.loading}
          .exhausted=${this.exhausted}
          .infiniteScroll=${this.infiniteScroll}
          @load-more=${() => this.loadMore()}
          @infinite-toggle=${this.handleInfiniteToggle}
        ></load-footer>

        <div id="scroll-sentinel" style="height:1px;"></div>
      </div>
    `;
  }
}
