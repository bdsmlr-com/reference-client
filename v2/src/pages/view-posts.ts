import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { getUrlParam, setUrlParams, isBlogInPath, isDefaultTypes } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import {
  generatePaginationCursorKey,
  getCachedPaginationCursor,
  setCachedPaginationCursor,
} from '../services/storage.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import type { PostType, Blog } from '../types/api.js';
import '../components/type-pills.js';
import '../components/variant-pills.js';
import '../components/post-feed.js';
import '../components/activity-grid.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/skeleton-loader.js';
import '../components/error-state.js';
import '../components/blog-header.js';

const PAGE_SIZE = 12;

@customElement('view-posts')
export class ViewPosts extends LitElement {
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

  @property({ type: String }) blog = '';

  @state() private blogId: number | null = null;
  @state() private selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private posts: ProcessedPost[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private loadingCurrent = 0;
  @state() private infiniteScroll = false;
  @state() private statusMessage = '';
  @state() private errorMessage = '';
  @state() private retrying = false;
  @state() private blogData: Blog | null = null;
  @state() private autoRetryAttempt = 0;
  @state() private isRetryableError = false;

  private backendCursor: string | null = null;
  private seenIds = new Set<number>();
  private seenUrls = new Set<string>();
  private paginationKey = '';

  private showError(message: string, error?: unknown): void {
    this.errorMessage = message;
    this.statusMessage = '';
    this.loading = false;

    if (error) {
      const apiError = isApiError(error) ? error : toApiError(error);
      this.isRetryableError = apiError.isRetryable;
    } else {
      this.isRetryableError = false;
    }
  }

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
    this.resetForNewBlog();
    const types = getUrlParam('types');

    if (types) {
      this.selectedTypes = types.split(',').map((t) => parseInt(t, 10) as PostType);
    }

    if (!this.blog) {
      this.showError(ErrorMessages.VALIDATION.NO_BLOG_SPECIFIED);
      return;
    }

    try {
      this.statusMessage = 'Resolving blog...';
      this.blogData = await initBlogTheme(this.blog);
      const blogId = await apiClient.identity.resolveNameToId(this.blog);

      if (!blogId) {
        this.showError(ErrorMessages.BLOG.notFound(this.blog));
        return;
      }

      this.blogId = blogId;
      this.statusMessage = '';
      await this.loadPosts();
    } catch (e) {
      this.showError(getContextualErrorMessage(e, 'resolve_blog', { blogName: this.blog }), e);
    }
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
    this.blogId = null;
    this.blogData = null;
    this.loading = false;
  }

  private async loadPosts(): Promise<void> {
    if (!this.blogId) return;
    if (this.selectedTypes.length === 0) {
      this.statusMessage = ErrorMessages.VALIDATION.NO_TYPES_SELECTED;
      return;
    }

    this.resetState();

    const params: Record<string, string> = {
      types: isDefaultTypes(this.selectedTypes) ? '' : this.selectedTypes.join(','),
    };
    if (!isBlogInPath()) {
      params.blog = this.blog;
    }
    setUrlParams(params);

    this.paginationKey = generatePaginationCursorKey('timeline', {
      blog: this.blog,
      types: this.selectedTypes.join(','),
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
      this.showError(getContextualErrorMessage(e, 'load_posts', { blogName: this.blog }), e);
    }

    this.observeSentinel();
  }

  private async fillPage(): Promise<void> {
    if (!this.blogId) return;

    this.loading = true;
    try {
      // 1. Fetch Posts
      const postsResp = await apiClient.posts.list({
        blog_id: this.blogId,
        sort_field: 1, // CreatedAt
        order: 2, // DESC
        post_types: this.selectedTypes,
        page: { page_size: 15, page_token: this.backendCursor || undefined }
      });

      // 2. Fetch Recent Activity (Likes/Comments)
      const activityResp = await apiClient.recentActivity.list({
        blog_ids: [this.blogId],
        page: { page_size: 30 }, // Fetch more because we cluster them
        global_merge: true,
        sort_field: 0,
        order: 2,
        limit_per_blog: 0
      });

      this.backendCursor = postsResp.page?.nextPageToken || null;
      if (!this.backendCursor) this.exhausted = true;

      const posts = (postsResp.posts || []).map(p => ({ ...p, _media: extractMedia(p), _interactionType: (p.originPostId && p.originPostId !== p.id) ? 'reblog' : 'post' }));
      const activities = (activityResp.posts || []).map(p => ({ ...p, _media: extractMedia(p), _interactionType: 'like' })); // Simple mapping for now

      // 3. Merge and Sort
      const merged = [...posts, ...activities].sort((a, b) => (b.createdAtUnix || 0) - (a.createdAtUnix || 0));
      
      // 4. Filter duplicates
      const unique = merged.filter(p => {
        if (this.seenIds.has(p.id)) return false;
        this.seenIds.add(p.id);
        return true;
      });

      this.posts = [...this.posts, ...unique as ProcessedPost[]];
      if (merged.length === 0) this.exhausted = true;

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
                page="timeline"
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
              <div class="type-pills-container">
                <type-pills
                  .selectedTypes=${this.selectedTypes}
                  @types-change=${this.handleTypesChange}
                ></type-pills>
              </div>
            `
          : ''}

        ${this.statusMessage && !this.errorMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}

        ${this.posts.length > 0
          ? html`
              <div class="feed-container">
                ${this.posts.map((p: any) => {
                  if (p._interactionType === 'post' || p._interactionType === 'reblog') {
                    return html`<post-feed-item .post=${p} @post-select=${this.handlePostClick}></post-feed-item>`;
                  } else {
                    // Small interaction (Like/Comment) - show in a smaller grid
                    return html`
                      <div style="max-width: 600px; margin: 0 auto 20px auto;">
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">Interaction</div>
                        <activity-grid compact .items=${[{ post: p, type: p._interactionType }]} @activity-click=${this.handlePostClick}></activity-grid>
                      </div>
                    `;
                  }
                })}
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
    `;
  }
}
