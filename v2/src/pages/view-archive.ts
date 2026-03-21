import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { getUrlParam, setUrlParams, isBlogInPath, isDefaultTypes, isAdminMode } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import {
  
  
  setCachedPaginationCursor,
} from '../services/storage.js';
import { extractMedia, normalizeSortValue, type ProcessedPost, type ViewStats, SORT_OPTIONS } from '../types/post.js';
import type { Blog, PostType, PostSortField, Order, TimelineItem, PostVariant } from '../types/api.js';

import '../components/filter-bar.js';
import '../components/activity-grid.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/skeleton-loader.js';
import '../components/error-state.js';
import '../components/blog-header.js';

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
  @state() private selectedVariants: PostVariant[] = [];
  @state() private timelineItems: TimelineItem[] = [];
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
  private renderedMediaKeys = new Set<string>(); // Authoritative uniqueness
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
    if (this.paginationKey && this.timelineItems.length > 0) {
      setCachedPaginationCursor(
        this.paginationKey,
        this.backendCursor,
        window.scrollY,
        this.timelineItems.length,
        this.exhausted
      );
    }
  };

  private async loadFromUrl(): Promise<void> {
    const sort = getUrlParam('sort');
    const types = getUrlParam('types');
    const variants = getUrlParam('variants');

    this.sortValue = normalizeSortValue(sort);
    if (types) {
      this.selectedTypes = types.split(',').map((t) => parseInt(t, 10) as PostType);
    }
    if (variants) {
      this.selectedVariants = variants.split(',').map((v) => parseInt(v, 10) as PostVariant);
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
    this.renderedMediaKeys.clear();
    this.stats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
    this.timelineItems = [];
    this.statusMessage = '';

    const params: Record<string, string> = {
      sort: this.sortValue,
      types: isDefaultTypes(this.selectedTypes) ? '' : this.selectedTypes.join(','),
      variants: this.selectedVariants.length > 0 ? this.selectedVariants.join(',') : '',
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

    this.loading = true;
    const sortOpt = SORT_OPTIONS.find((o) => o.value === this.sortValue) || SORT_OPTIONS[0];
    const isAdmin = isAdminMode();

    try {
      const resp = await apiClient.posts.list({
        blog_id: this.blogId,
        sort_field: sortOpt.field as PostSortField,
        order: sortOpt.order as Order,
        post_types: this.selectedTypes,
        variants: this.selectedVariants.length > 0 ? this.selectedVariants : undefined,
        page: {
          page_size: 48,
          page_token: this.backendCursor || undefined,
        },
      });

      this.backendCursor = resp.page?.nextPageToken || null;
      if (!this.backendCursor) this.exhausted = true;

      // DUMB FRONTEND: Just append the pre-processed timeline items
      const newItems: TimelineItem[] = [];
      (resp.timelineItems || []).forEach(item => {
        if (item.type === 1 && item.post) { // ITEM_TYPE_POST
          const post = item.post as ProcessedPost;
          const media = extractMedia(post);
          
          // AUTHORITATIVE DEDUPLICATION: Key is either Origin ID or normalized Media URL
          const mediaUrl = media.url || media.videoUrl || media.audioUrl;
          const contentKey = post.originPostId ? `oid:${post.originPostId}` : (mediaUrl ? `url:${mediaUrl.split('?')[0]}` : `pid:${post.id}`);

          if (!isAdmin && (this.seenIds.has(post.id) || this.renderedMediaKeys.has(contentKey))) {
            this.stats.dupes++;
            return;
          }
          
          this.seenIds.add(post.id);
          this.renderedMediaKeys.add(contentKey);
          post._media = media;
          newItems.push(item);
        } else if (item.type === 2 && item.cluster) { // ITEM_TYPE_CLUSTER
          const uniqueInteractions: ProcessedPost[] = [];
          item.cluster.interactions?.forEach(post => {
            const p = post as ProcessedPost;
            const media = extractMedia(p);
            const mediaUrl = media.url || media.videoUrl || media.audioUrl;
            const contentKey = p.originPostId ? `oid:${p.originPostId}` : (mediaUrl ? `url:${mediaUrl.split('?')[0]}` : `pid:${p.id}`);

            if (!isAdmin && (this.seenIds.has(p.id) || this.renderedMediaKeys.has(contentKey))) {
              return;
            }
            
            this.seenIds.add(p.id);
            this.renderedMediaKeys.add(contentKey);
            p._media = media;
            uniqueInteractions.push(p);
          });
          if (uniqueInteractions.length > 0) {
            item.cluster.interactions = uniqueInteractions;
            newItems.push(item);
          }
        }
      });

      this.timelineItems = [...this.timelineItems, ...newItems];
      if (newItems.length === 0) this.exhausted = true;
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

  private handleVariantChange(e: CustomEvent): void {
    this.selectedVariants = e.detail.variants || [];
    this.loadPosts();
  }

  private handlePostClick(e: CustomEvent): void {
    const post = e.detail.post as ProcessedPost;
    
    const allPosts: ProcessedPost[] = [];
    this.timelineItems.forEach(item => {
      if (item.type === 1 && item.post) {
        allPosts.push(item.post as ProcessedPost);
      } else if (item.type === 2 && item.cluster) {
        item.cluster.interactions?.forEach(p => {
          allPosts.push(p as ProcessedPost);
        });
      }
    });

    const index = allPosts.findIndex(p => p.id === post.id);

    this.dispatchEvent(new CustomEvent('post-click', {
      detail: { post, posts: allPosts, index: index >= 0 ? index : 0 },
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
          <filter-bar
            .sortValue=${this.sortValue}
            .selectedTypes=${this.selectedTypes}
            .selectedVariants=${this.selectedVariants}
            .showSort=${true}
            .showVariants=${true}
            .loading=${this.loading}
            @sort-change=${this.handleSortChange}
            @types-change=${this.handleTypesChange}
            @variant-change=${this.handleVariantChange}
          ></filter-bar>
        ` : ''}

        ${this.errorMessage ? html`<error-state title="Error" message=${this.errorMessage} @retry=${this.handleRetry}></error-state>` : ''}
        ${this.statusMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}
${this.timelineItems.length > 0
  ? html`
      <div class="grid-container">
        <activity-grid 
          .items=${this.timelineItems.flatMap(entry => {
            if (entry.type === 1 && entry.post) {
              return [{ 
                post: entry.post as ProcessedPost, 
                type: (entry.post.originPostId && entry.post.originPostId !== entry.post.id) ? 'reblog' : 'post' 
              }];
            } else if (entry.type === 2 && entry.cluster) {
              return (entry.cluster.interactions || []).map((post: any) => ({ 
                post: post as ProcessedPost, 
                type: 'like' 
              }));
            }

            return [];
          })} 
          @activity-click=${this.handlePostClick}
        ></activity-grid>
        </div>
        `
        : ''}
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
