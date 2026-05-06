import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { getUrlParam, setUrlParams, isBlogInPath, isAdminMode } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { parsePostTypesParam, parseVariantsParam } from '../services/post-filter-url.js';
import { scrollObserver } from '../services/scroll-observer.js';
import {
  getInfiniteScrollPreference,
  setCachedPaginationCursor,
} from '../services/storage.js';
import { extractMedia, normalizeSortValue, type ProcessedPost, type ViewStats, SORT_OPTIONS } from '../types/post.js';
import type { Blog, PostType, PostSortField, Order, PostVariant } from '../types/api.js';
import {
  buildContentNavigationState,
  buildSharedContentRouteParams,
  parseOpaqueParam,
  parsePositivePageParam,
} from '../services/search-session.js';
import {
  getGalleryMode,
  PROFILE_EVENTS,
  type GalleryMode,
  getArchiveSortPreference,
  setArchiveSortPreference,
} from '../services/profile.js';
import { toPresentationModel } from '../services/post-presentation.js';
import { getPageSlotConfig } from '../services/render-page.js';
import { applyRetrievalPostPolicies, type RetrievalPostPolicyMap } from '../services/retrieval-presentation.js';
import type { RenderSlotConfig } from '../config.js';

import '../components/control-panel.js';
import '../components/activity-grid.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/skeleton-loader.js';
import '../components/error-state.js';
import '../components/blog-header.js';
import '../components/render-card.js';

const ARCHIVE_PAGE_SIZE = 48;

function parseArchiveWhenParam(raw: string | null): string {
  const value = (raw || '').trim();
  return /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value) ? value : '';
}

@customElement('view-archive')
export class ViewArchive extends LitElement {
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

      .status {
        text-align: center;
        color: var(--text-muted);
        padding: 40px 16px;
      }

      .grid-container {
        margin-bottom: 20px;
        padding: 0 16px;
      }

      .search-box {
        max-width: 600px;
        margin: 0 auto 20px;
        padding: 0 16px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
      }

      .search-box input {
        flex: 1;
        min-width: 200px;
        max-width: 300px;
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
    `,
  ];

  @property({ type: String }) blog = '';

  @state() private blogId: number | null = null;
  @state() private sortValue = 'newest';
  @state() private selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private selectedVariants: PostVariant[] = [];
  @state() private posts: ProcessedPost[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private stats: ViewStats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
  @state() private currentPage = 1;
  @state() private infiniteScroll = false;
  @state() private navigationMode: 'infinite' | 'paginated' = 'infinite';
  @state() private statusMessage = '';
  @state() private errorMessage = '';
  @state() private hasNextPage = false;
  @state() private archiveWhen = '';
  @state() private query = '';
  @state() private initialLoading = false;
  @state() private blogData: Blog | null = null;
  @state() private autoRetryAttempt = 0;
  @state() private isRetryableError = false;
  @state() private galleryMode: GalleryMode = getGalleryMode();
  private readonly mainSlotConfig: RenderSlotConfig = getPageSlotConfig('archive', 'main_stream');

  private backendCursor: string | null = null;
  private currentPageCursor: string | null = null;
  private seenIds = new Set<number>();
  private renderedMediaKeys = new Set<string>(); // Authoritative uniqueness
  private forcedPaginatedFromUrl = false;
  private pageStartCursors = new Map<number, string | null>([[1, null]]);
  private paginationKey = '';

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('blog')) {
      this.loadFromUrl();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('beforeunload', this.savePaginationState);
    window.addEventListener(PROFILE_EVENTS.galleryModeChanged, this.handleGalleryModeChanged as EventListener);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('beforeunload', this.savePaginationState);
    this.savePaginationState();
    const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
    if (sentinel) {
      scrollObserver.unobserve(sentinel);
    }
    window.removeEventListener(PROFILE_EVENTS.galleryModeChanged, this.handleGalleryModeChanged as EventListener);
    clearBlogTheme();
  }

  private handleGalleryModeChanged = (): void => {
    this.galleryMode = getGalleryMode();
  };

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

  private buildArchiveUrlParams(): Record<string, string> {
    const params: Record<string, string> = {
      q: this.query,
      ...buildSharedContentRouteParams({
        sortValue: this.sortValue,
        selectedTypes: this.selectedTypes,
        selectedVariants: this.selectedVariants,
        whenValue: this.archiveWhen,
      }),
      page: this.navigationMode === 'paginated' ? String(this.currentPage) : '',
      cursor: this.navigationMode === 'paginated' && this.currentPage > 1 ? this.currentPageCursor || '' : '',
    };
    if (!isBlogInPath()) {
      params.blog = this.blog;
    }
    return params;
  }

  private syncArchiveUrlState(): void {
    setUrlParams(this.buildArchiveUrlParams());
  }

  private async fetchArchivePageResponse(pageToken: string | null) {
    if (!this.blogId) {
      return null;
    }

    const sortOpt = SORT_OPTIONS.find((o) => o.value === this.sortValue) || SORT_OPTIONS[0];
    return apiClient.posts.list({
      blog_id: this.blogId,
      q: this.query || undefined,
      sort_field: sortOpt.field as PostSortField,
      order: sortOpt.order as Order,
      post_types: this.selectedTypes,
      variants: this.selectedVariants.length > 0 ? this.selectedVariants : undefined,
      activity_kinds: ['post', 'reblog'],
      when: this.archiveWhen || undefined,
      page: {
        page_size: ARCHIVE_PAGE_SIZE,
        page_token: pageToken || undefined,
      },
    });
  }

  private async resolveArchivePageCursor(targetPage: number): Promise<{ resolvedPage: number; resolvedCursor: string | null }> {
    let resolvedPage = 1;
    let resolvedCursor: string | null = null;

    this.pageStartCursors = new Map([[1, null]]);

    while (resolvedPage < targetPage) {
      const resp = await this.fetchArchivePageResponse(resolvedCursor);
      const nextCursor = resp?.page?.nextPageToken || null;
      if (!nextCursor) {
        break;
      }
      resolvedPage += 1;
      resolvedCursor = nextCursor;
      this.pageStartCursors.set(resolvedPage, resolvedCursor);
    }

    return { resolvedPage, resolvedCursor };
  }

  private async loadFromUrl(): Promise<void> {
    const q = getUrlParam('q');
    const sort = getUrlParam('sort');
    const types = getUrlParam('types');
    const variants = getUrlParam('variants');
    const explicitPage = parsePositivePageParam(getUrlParam('page'));
    const explicitCursor = parseOpaqueParam(getUrlParam('cursor'));
    const explicitWhen = parseArchiveWhenParam(getUrlParam('when'));
    const infinitePref = getInfiniteScrollPreference('archive');
    const hasExplicitPaginationState = explicitPage !== undefined || !!explicitCursor || !!explicitWhen;
    const routeState = buildContentNavigationState({
      infinitePref,
      page: explicitPage,
      cursor: explicitCursor,
      forcePaginated: hasExplicitPaginationState,
    });

    const resolvedSort = normalizeSortValue(sort || getArchiveSortPreference());
    this.sortValue = resolvedSort;
    this.query = q;
    this.infiniteScroll = infinitePref;
    this.archiveWhen = explicitWhen;
    this.forcedPaginatedFromUrl = hasExplicitPaginationState;
    this.navigationMode = routeState.navigationMode;
    this.currentPage = routeState.currentPage;
    this.currentPageCursor = routeState.currentCursor;
    this.hasNextPage = false;
    this.pageStartCursors = new Map([[1, null]]);
    if (explicitCursor) {
      this.pageStartCursors.set(this.currentPage, explicitCursor);
    }
    if (!sort) {
      setArchiveSortPreference(resolvedSort);
    }
    if (types) {
      const parsedTypes = parsePostTypesParam(types);
      if (parsedTypes && parsedTypes.length > 0) {
        this.selectedTypes = parsedTypes;
      }
    }
    if (variants) {
      const parsedVariants = parseVariantsParam(variants);
      if (parsedVariants) {
        this.selectedVariants = parsedVariants;
      }
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
      if (!explicitCursor && explicitPage && explicitPage > 1) {
        const { resolvedPage, resolvedCursor } = await this.resolveArchivePageCursor(explicitPage);
        this.currentPage = resolvedPage;
        this.currentPageCursor = resolvedCursor;
      } else {
        this.currentPage = explicitPage ?? 1;
      }
      await this.loadPosts({ preserveNavigationState: true });
    } catch (e) {
      this.errorMessage = getContextualErrorMessage(e, 'resolve_blog', { blogName: this.blog });
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
    } finally {
      this.initialLoading = false;
    }
  }

  private async loadPosts(options: { preserveNavigationState?: boolean } = {}): Promise<void> {
    if (!this.blogId) return;
    if (this.selectedTypes.length === 0) {
      this.statusMessage = ErrorMessages.VALIDATION.NO_TYPES_SELECTED;
      return;
    }

    const preserveNavigationState = options.preserveNavigationState ?? false;
    if (!preserveNavigationState) {
      const routeState = buildContentNavigationState({
        infinitePref: this.infiniteScroll,
        page: undefined,
        cursor: null,
        forcePaginated: this.forcedPaginatedFromUrl,
      });
      this.currentPage = routeState.currentPage;
      this.currentPageCursor = routeState.currentCursor;
      this.pageStartCursors = new Map([[1, null]]);
      this.navigationMode = routeState.navigationMode;
    }

    this.backendCursor = null;
    this.exhausted = false;
    this.hasNextPage = false;
    this.seenIds.clear();
    this.renderedMediaKeys.clear();
    this.stats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
    this.posts = [];
    this.statusMessage = '';
    this.syncArchiveUrlState();

    try {
      await this.fillPage(this.currentPageCursor);
    } catch (e) {
      this.errorMessage = getContextualErrorMessage(e, 'load_posts', { blogName: this.blog });
    }

    if (this.navigationMode === 'infinite') {
      this.observeSentinel();
    }
  }

  private observeSentinel(): void {
    if (this.navigationMode !== 'infinite') {
      return;
    }
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

  private async fillPage(pageToken: string | null = this.currentPageCursor): Promise<void> {
    if (!this.blogId) return;

    this.loading = true;
    const isAdmin = isAdminMode();

    try {
      const resp = await this.fetchArchivePageResponse(pageToken);
      if (!resp) {
        return;
      }

      this.backendCursor = resp.page?.nextPageToken || null;
      this.hasNextPage = !!this.backendCursor;
      if (!this.backendCursor) this.exhausted = true;

      const postPolicies = (resp as { postPolicies?: RetrievalPostPolicyMap }).postPolicies;
      const retrievedPosts = applyRetrievalPostPolicies(
        (resp.posts || []).map((rawPost) => rawPost as ProcessedPost),
        postPolicies,
      );

      const newPosts: ProcessedPost[] = [];
      retrievedPosts.forEach(post => {
        const media = extractMedia(post);
        const mediaUrl = media.url || media.videoUrl || media.audioUrl;
        const contentKey = post.originPostId ? `oid:${post.originPostId}` : (mediaUrl ? `url:${mediaUrl.split('?')[0]}` : `pid:${post.id}`);

        if (!isAdmin && (this.seenIds.has(post.id) || this.renderedMediaKeys.has(contentKey))) {
          this.stats.dupes++;
          return;
        }

        this.seenIds.add(post.id);
        this.renderedMediaKeys.add(contentKey);
        post._media = media;
        newPosts.push(post);
      });

      if (this.navigationMode === 'paginated') {
        this.posts = newPosts;
      } else {
        this.posts = [...this.posts, ...newPosts];
      }
      if (newPosts.length === 0) {
        this.exhausted = true;
        this.hasNextPage = false;
      }
      if (this.navigationMode === 'paginated') {
        this.pageStartCursors.set(this.currentPage, this.currentPageCursor);
        if (this.backendCursor) {
          this.pageStartCursors.set(this.currentPage + 1, this.backendCursor);
        }
        this.syncArchiveUrlState();
      }
    } finally {
      this.loading = false;
    }
  }

  private async loadMore(): Promise<void> {
    if (this.navigationMode !== 'infinite' || this.loading || this.exhausted) return;
    await this.fillPage(this.backendCursor);
  }

  private handleSortChange(e: CustomEvent): void {
    this.sortValue = e.detail.value;
    setArchiveSortPreference(this.sortValue);
    void this.loadPosts();
  }

  private handleTypesChange(e: CustomEvent): void {
    this.selectedTypes = e.detail.types;
    void this.loadPosts();
  }

  private handleVariantChange(e: CustomEvent): void {
    this.selectedVariants = e.detail.variants || [];
    void this.loadPosts();
  }

  private handleWhenChange(e: CustomEvent<{ value: string }>): void {
    this.archiveWhen = parseArchiveWhenParam(e.detail.value);
    this.forcedPaginatedFromUrl = this.archiveWhen.length > 0;
    const routeState = buildContentNavigationState({
      infinitePref: this.infiniteScroll,
      page: 1,
      cursor: null,
      forcePaginated: this.forcedPaginatedFromUrl,
    });
    this.currentPage = routeState.currentPage;
    this.currentPageCursor = routeState.currentCursor;
    this.hasNextPage = false;
    this.pageStartCursors = new Map([[1, null]]);
    this.navigationMode = routeState.navigationMode;
    void this.loadPosts();
  }

  private handleArchiveQueryInput(e: Event): void {
    this.query = (e.target as HTMLInputElement).value;
  }

  private handleArchiveQueryKeyPress(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      void this.loadPosts();
    }
  }

  private handlePostClick(e: CustomEvent): void {
    const post = e.detail.post as ProcessedPost;
    const index = this.posts.findIndex((p) => p.id === post.id);

    this.dispatchEvent(new CustomEvent('post-click', {
      detail: { post, posts: this.posts, index: index >= 0 ? index : 0 },
      bubbles: true,
      composed: true
    }));
  }

  private handleInfiniteToggle(e: CustomEvent): void {
    this.infiniteScroll = e.detail.enabled;
    if (this.forcedPaginatedFromUrl) {
      return;
    }
    const nextMode = this.infiniteScroll ? 'infinite' : 'paginated';
    if (nextMode !== this.navigationMode) {
      this.navigationMode = nextMode;
      void this.loadPosts();
      return;
    }
    if (this.infiniteScroll) this.observeSentinel();
  }

  private async handlePreviousPage(): Promise<void> {
    if (this.loading || this.currentPage <= 1) return;
    const previousPage = this.currentPage - 1;
    const previousCursor = this.pageStartCursors.get(previousPage);
    if (previousPage > 1 && previousCursor === undefined) {
      return;
    }
    this.currentPage = previousPage;
    this.currentPageCursor = previousCursor ?? null;
    await this.loadPosts({ preserveNavigationState: true });
  }

  private async handleNextPage(): Promise<void> {
    if (this.loading || !this.hasNextPage) return;
    const nextPage = this.currentPage + 1;
    const nextCursor = this.pageStartCursors.get(nextPage) ?? this.backendCursor;
    if (!nextCursor) {
      return;
    }
    this.currentPage = nextPage;
    this.currentPageCursor = nextCursor;
    await this.loadPosts({ preserveNavigationState: true });
  }

  private toActivityItem(post: ProcessedPost): { post: ProcessedPost; type: 'post' | 'reblog' } {
    const presentation = toPresentationModel(post, { surface: 'card', page: 'activity' });
    return {
      post,
      type: presentation.identity.isReblog ? 'reblog' : 'post',
    };
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
        <blog-header
          page="archive"
          .blogName=${this.blog}
          .blogTitle=${this.blogData?.title || ''}
          .blogDescription=${this.blogData?.description || ''}
          .avatarUrl=${this.blogData?.avatarUrl || ''}
          .identityDecorations=${this.blogData?.identityDecorations || []}
        ></blog-header>

        ${this.initialLoading ? html`<loading-spinner message="Loading archive..."></loading-spinner>` : ''}

        ${this.blogId ? html`
          <div class="search-box">
            <input
              type="text"
              placeholder="Filter this archive with blog:, tag:, media:, when..."
              .value=${this.query}
              @input=${this.handleArchiveQueryInput}
              @keypress=${this.handleArchiveQueryKeyPress}
            />
            <button ?disabled=${this.loading} @click=${() => this.loadPosts()}>
              ${this.loading ? 'Filtering...' : 'Filter'}
            </button>
          </div>

          <control-panel
            .pageName=${'archive'}
            .sortValue=${this.sortValue}
            .selectedTypes=${this.selectedTypes}
            .selectedVariants=${this.selectedVariants}
            .whenValue=${this.archiveWhen}
            .blog=${this.blogData}
            .showSort=${true}
            .showTypes=${true}
            .showVariants=${true}
            .showWhen=${true}
            .loading=${this.loading}
            @sort-change=${this.handleSortChange}
            @types-change=${this.handleTypesChange}
            @variant-change=${this.handleVariantChange}
            @when-change=${this.handleWhenChange}
          ></control-panel>
        ` : ''}

        ${this.errorMessage ? html`<error-state title="Error" message=${this.errorMessage} @retry=${this.handleRetry}></error-state>` : ''}
        ${this.statusMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}
 ${this.posts.length > 0
  ? html`
      <div class="grid-container">
        <activity-grid 
          .mode=${this.galleryMode}
          .showBlogChip=${false}
          .items=${this.posts.map((post) => this.toActivityItem(post))}
          @activity-click=${this.handlePostClick}
        ></activity-grid>
        </div>
        `
        : ''}
        ${this.loading && this.posts.length === 0 && !this.errorMessage
          ? html`
              <div class="grid-container">
                <render-card
                  cardType=${this.mainSlotConfig.loading?.cardType || ''}
                  count=${this.mainSlotConfig.loading?.count}
                  loading
                ></render-card>
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
          .navigationMode=${this.navigationMode}
          .currentPage=${this.currentPage}
          .hasPreviousPage=${this.currentPage > 1 && (this.currentPage === 2 || this.pageStartCursors.has(this.currentPage - 1))}
          .hasNextPage=${this.hasNextPage}
          @load-more=${() => this.loadMore()}
          @previous-page=${() => this.handlePreviousPage()}
          @next-page=${() => this.handleNextPage()}
          @infinite-toggle=${this.handleInfiniteToggle}
        ></load-footer>

        <div id="scroll-sentinel" style="height:1px;"></div>
      </div>
    `;
  }
}
