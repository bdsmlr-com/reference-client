import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { buildPageUrl, getBlogNameFromPath, getPrimaryBlogName, getUrlParam, setUrlParams } from '../services/blog-resolver.js';
import { normalizeArchiveWhenValue } from '../services/archive-when.js';
import { scrollObserver } from '../services/scroll-observer.js';
import {
  generatePaginationCursorKey,
  setCachedPaginationCursor,
} from '../services/storage.js';
import { normalizeSortValue, type ProcessedPost, type ViewStats, SORT_OPTIONS } from '../types/post.js';
import type { PostType, PostSortField, Order, PostVariant } from '../types/api.js';
import { parsePostTypesParam, parseVariantsParam } from '../services/post-filter-url.js';
import { materializeSearchResultUnits, type SearchResultUnit } from '../services/search-result-units.js';
import { contentGridItems, flattenContentResultPosts, prepareContentResultUnits } from '../services/content-results.js';
import {
  forcePaginatedContentRouteNavigation,
  readContentRouteUrlState,
} from '../services/content-route-state.js';
import { buildContentRouteLoadState } from '../services/content-route-controller.js';
import {
  applyContentPageResponseState,
  mergeContentPageUnits,
  resolveToggledContentNavigationMode,
} from '../services/content-route-pagination.js';
import {
  canLoadMoreContentPage,
  getAdjacentContentPageTarget,
  shouldObserveContentSentinel,
  shouldSyncContentUrlAfterPageLoad,
} from '../services/content-route-behavior.js';
import {
  buildContentPaginationSignature,
  buildContentRouteUrlParams,
} from '../services/content-route-serialization.js';
import { BREAKPOINTS } from '../types/ui-constants.js';
import {
  getGalleryMode,
  PROFILE_EVENTS,
  type GalleryMode,
  getSearchSortPreference,
  setSearchSortPreference,
} from '../services/profile.js';
import { getPageSlotConfig } from '../services/render-page.js';
import type { RenderSlotConfig } from '../config.js';
import { ACTIVE_ENV } from '../config.js';
import { materializeRecommendedPosts, recService } from '../services/recommendation-api.js';
import '../components/control-panel.js';
import '../components/activity-grid.js';
import '../components/post-grid.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/skeleton-loader.js';
import '../components/error-state.js';
import '../components/render-card.js';
import '../components/result-group.js';

const SEARCH_PAGE_SIZE = 20;

@customElement('view-search')
export class ViewSearch extends LitElement {
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

      .help {
        text-align: center;
        color: var(--text-muted);
        font-size: 12px;
        margin-bottom: 20px;
        padding: 0 16px;
      }

      .help button {
        background: transparent;
        border: 1px solid var(--border);
        color: var(--text-muted);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
      }

      .syntax-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 1000;
      }

      .syntax-modal {
        width: min(720px, 100%);
        max-height: min(80vh, 760px);
        overflow: auto;
        background: var(--bg-panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
        padding: 18px 18px 14px;
      }

      .syntax-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .syntax-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--text-primary);
      }

      .syntax-close {
        background: transparent;
        border: 1px solid var(--border);
        border-radius: 999px;
        color: var(--text-muted);
        padding: 4px 10px;
        font-size: 12px;
      }

      .syntax-grid {
        display: grid;
        gap: 14px;
      }

      .syntax-section {
        display: grid;
        gap: 8px;
      }

      .syntax-section h4 {
        margin: 0;
        font-size: 13px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .syntax-section p {
        margin: 0;
        font-size: 13px;
        color: var(--text-muted);
        line-height: 1.4;
      }

      .syntax-list {
        display: grid;
        gap: 8px;
      }

      .syntax-row {
        display: grid;
        grid-template-columns: minmax(0, 240px) minmax(0, 1fr);
        gap: 10px;
        align-items: start;
      }

      .syntax-row code,
      .syntax-example code {
        background: var(--bg-panel-alt);
        padding: 4px 6px;
        border-radius: 6px;
        font-size: 12px;
        color: var(--text-primary);
        white-space: nowrap;
      }

      .syntax-row span,
      .syntax-example span {
        font-size: 13px;
        color: var(--text-primary);
        line-height: 1.4;
      }

      .syntax-example {
        display: grid;
        gap: 4px;
        padding: 10px 12px;
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        background: var(--bg-panel-alt);
        text-decoration: none;
      }

      .syntax-example:hover {
        border-color: var(--accent);
      }

      .syntax-example-label {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
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

      .match-box {
        max-width: 600px;
        margin: 0 auto 20px;
        padding: 0 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .match-copy {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .match-label {
        color: var(--text-primary);
        font-size: 13px;
        font-weight: 600;
      }

      .match-help {
        color: var(--text-muted);
        font-size: 12px;
      }

      .match-select {
        min-width: 120px;
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: var(--text-primary);
        font-size: 14px;
        min-height: 32px;
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

      .grid-container {
        margin-bottom: 20px;
        padding: 0 16px;
      }

      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {
        .search-box {
          flex-direction: column;
        }

        .search-box input {
          width: 100%;
        }

        .search-box button {
          width: 100%;
        }

        .match-box {
          align-items: stretch;
        }

        .match-select {
          width: 100%;
        }
      }
    `,
  ];

  @state() private query = '';
  @state() private sortValue = 'newest';
  @state() private matchMode: 'off' | 'soft' | 'hard' = 'off';
  @state() private selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private selectedVariants: PostVariant[] = [1];
  @state() private searchWhen = '';
  @state() private resultUnits: SearchResultUnit[] = [];
  @state() private loading = false;
  @state() private searching = false;
  @state() private exhausted = false;
  @state() private stats: ViewStats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
  @state() private loadingCurrent = 0;
  @state() private infiniteScroll = false;
  @state() private searchSessionId = '';
  @state() private currentPage = 1;
  @state() private navigationMode: 'infinite' | 'paginated' = 'infinite';
  @state() private statusMessage = '';
  @state() private hasSearched = false;
  @state() private errorMessage = '';
  @state() private retrying = false;
  @state() private autoRetryAttempt = 0;
  @state() private isRetryableError = false;
  @state() private galleryMode: GalleryMode = getGalleryMode('search');
  @state() private teaserPosts: ProcessedPost[] = [];
  @state() private teaserLoading = false;
  @state() private hasNextPage = false;
  @state() private showSyntaxGuide = false;
  private readonly mainSlotConfig: RenderSlotConfig = getPageSlotConfig('search', 'main_stream');

  private backendCursor: string | null = null;
  private seenIds = new Set<number>();
  private paginationKey = '';
  private activeSearchToken = 0;
  private currentSearchSignature = '';
  private sortExplicitInUrl = false;
  private replaceSearchUrlOnPageBoundary = false;

  private parseDevFacetTuning(): Record<string, number | string> {
    if (ACTIVE_ENV !== 'dev') return {};

    const readNumber = (key: string): number | undefined => {
      const raw = getUrlParam(key);
      if (!raw) return undefined;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const facetMode = getUrlParam('facet_mode') || getUrlParam('facetMode');
    const tuning: Record<string, number | string> = {};
    if (facetMode) {
      tuning.facetMode = facetMode;
    }
    const numericKeys = [
      'viewerInterestMatchWeight',
      'viewerPersonalMatchWeight',
      'viewerInterestMissWeight',
      'viewerPersonalMissWeight',
      'seedInterestMatchWeight',
      'seedPersonalMatchWeight',
      'seedInterestMissWeight',
      'seedPersonalMissWeight',
    ] as const;
    for (const key of numericKeys) {
      const value = readNumber(key);
      if (value !== undefined) tuning[key] = value;
    }
    return tuning;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.loadFromUrl();
    void this.loadTeasers();
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
  }

  private handleGalleryModeChanged = (): void => {
    this.galleryMode = getGalleryMode('search');
  };

  private savePaginationState = (): void => {
    if (this.paginationKey && this.resultUnits.length > 0) {
      setCachedPaginationCursor(
        this.paginationKey,
        this.backendCursor,
        window.scrollY,
        this.resultUnits.length,
        this.exhausted
      );
    }
  };

  private syncSearchUrlState(): void {
    const routePerspectiveBlog = getBlogNameFromPath();
    setUrlParams(buildContentRouteUrlParams({
      query: this.query,
      sortValue: this.sortValue,
      includeSort: this.sortExplicitInUrl,
      selectedTypes: this.selectedTypes,
      selectedVariants: this.selectedVariants,
      whenValue: this.searchWhen,
      currentPage: this.currentPage,
      navigationMode: this.navigationMode,
      replaceUrlOnPageBoundary: this.replaceSearchUrlOnPageBoundary,
      sessionId: this.searchSessionId,
      matchValue: routePerspectiveBlog && this.matchMode !== 'off' ? this.matchMode : '',
      emptyVariantsToken: 'all',
    }));
  }

  private loadFromUrl(): void {
    const { query, sort, types, variants, when, infinitePref, routeState } = readContentRouteUrlState({
      pageName: 'search',
      normalizeWhen: normalizeArchiveWhenValue,
      forcePaginatedOnWhen: true,
    });
    const match = getUrlParam('match');

    this.infiniteScroll = infinitePref;
    this.currentPage = routeState.currentPage;
    this.searchSessionId = routeState.sessionId;
    this.navigationMode = routeState.navigationMode;
    this.replaceSearchUrlOnPageBoundary = routeState.replaceUrlOnPageBoundary;

    if (query) this.query = query;
    this.searchWhen = when;
    if (match === 'soft' || match === 'hard' || match === 'off') this.matchMode = match;
    this.sortExplicitInUrl = !!sort;
    const resolvedSort = normalizeSortValue(sort || getSearchSortPreference());
    this.sortValue = resolvedSort;
    if (!sort) {
      setSearchSortPreference(resolvedSort);
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

    if (this.query) {
      void this.search({ preserveNavigationState: this.navigationMode === 'paginated' });
    }
  }

  private async loadTeasers(): Promise<void> {
    const routePerspectiveBlog = getBlogNameFromPath();
    const subjectBlog = routePerspectiveBlog || getPrimaryBlogName() || '';
    if (!subjectBlog) return;
    this.teaserLoading = true;
    try {
      const response = await recService.getRecommendedPostsForUser(subjectBlog, 6);
      this.teaserPosts = materializeRecommendedPosts(response);
    } catch {
      this.teaserPosts = [];
    } finally {
      this.teaserLoading = false;
    }
  }

  private observeSentinel(): void {
    if (!shouldObserveContentSentinel(this.navigationMode)) {
      return;
    }
    requestAnimationFrame(() => {
      const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
      if (sentinel) {
        scrollObserver.observe(sentinel, () => {
          if (this.infiniteScroll && !this.loading && !this.exhausted && this.hasSearched) {
            this.loadMore();
          }
        });
      }
    });
  }

  private async search(options: { preserveNavigationState?: boolean } = {}): Promise<void> {
    if (!this.query.trim()) return;
    if (this.selectedTypes.length === 0) {
      this.statusMessage = ErrorMessages.VALIDATION.NO_TYPES_SELECTED;
      return;
    }

    const preserveNavigationState = options.preserveNavigationState ?? false;
    this.searching = true;
    const nextLoadState = buildContentRouteLoadState({
      preserveNavigationState,
      infinitePref: this.infiniteScroll,
      currentPage: this.currentPage,
      currentSessionId: this.searchSessionId,
      currentNavigationMode: this.navigationMode,
      currentReplaceUrlOnPageBoundary: this.replaceSearchUrlOnPageBoundary,
    });
    this.currentPage = nextLoadState.currentPage;
    this.searchSessionId = nextLoadState.sessionId;
    this.navigationMode = nextLoadState.navigationMode;
    this.replaceSearchUrlOnPageBoundary = nextLoadState.replaceUrlOnPageBoundary;
    this.backendCursor = null;
    this.exhausted = nextLoadState.exhausted;
    this.hasNextPage = nextLoadState.hasNextPage;
    this.seenIds.clear();
    this.stats = nextLoadState.stats;
    this.resultUnits = nextLoadState.resultUnits;
    this.statusMessage = nextLoadState.statusMessage;
    this.errorMessage = '';
    this.hasSearched = true;
    const searchToken = ++this.activeSearchToken;
    const normalizedQuery = this.query.trim();
    const routePerspectiveBlog = getBlogNameFromPath();

    setUrlParams(buildContentRouteUrlParams({
      query: this.query,
      sortValue: this.sortValue,
      includeSort: this.sortExplicitInUrl,
      selectedTypes: this.selectedTypes,
      selectedVariants: this.selectedVariants,
      whenValue: this.searchWhen,
      currentPage: this.currentPage,
      navigationMode: this.navigationMode,
      replaceUrlOnPageBoundary: false,
      sessionId: this.navigationMode === 'paginated' ? this.searchSessionId : '',
      matchValue: routePerspectiveBlog && this.matchMode !== 'off' ? this.matchMode : '',
      emptyVariantsToken: 'all',
    }));

    this.paginationKey = generatePaginationCursorKey('search', buildContentPaginationSignature({
      query: normalizedQuery,
      sortValue: this.sortValue,
      selectedTypes: this.selectedTypes,
      selectedVariants: this.selectedVariants,
      emptyVariantsToken: 'all',
    }));
    this.currentSearchSignature = this.paginationKey;

    try {
      await this.fillPage(searchToken, this.currentSearchSignature, this.currentPage);
    } catch (e) {
      if (searchToken !== this.activeSearchToken) {
        return;
      }
      this.errorMessage = getContextualErrorMessage(e, 'search', { query: this.query });
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
    }

    if (searchToken === this.activeSearchToken) {
      this.searching = false;
      if (this.navigationMode === 'infinite') {
        this.observeSentinel();
      }
    }
  }

  private async handleRetry(e?: CustomEvent): Promise<void> {
    const isAutoRetry = e?.detail?.isAutoRetry ?? false;
    this.retrying = true;
    this.errorMessage = '';
    this.isRetryableError = false;

    try {
      await this.search();
      this.autoRetryAttempt = 0;
    } catch {
      if (isAutoRetry && this.isRetryableError) {
        this.autoRetryAttempt++;
      }
    }

    this.retrying = false;
  }

  private renderSearchResultUnits() {
    return html`
      <div class="grid-container">
        <activity-grid
          .mode=${this.galleryMode}
          .page=${'search'}
          .items=${contentGridItems(this.resultUnits)}
          @activity-click=${this.handlePostClick}
        ></activity-grid>
      </div>
    `;
  }

  private async fillPage(
    searchToken: number = this.activeSearchToken,
    signature: string = this.currentSearchSignature,
    targetPage: number = this.currentPage,
  ): Promise<void> {
    this.loading = true;
    const sortOpt = SORT_OPTIONS.find((o) => o.value === this.sortValue) || SORT_OPTIONS[0];
    const routePerspectiveBlog = getBlogNameFromPath();
    const explicitSort = !!getUrlParam('sort');
    const facetTuning = this.parseDevFacetTuning();
    const hasFacetTuning = Object.keys(facetTuning).length > 0;
    const matchMode = routePerspectiveBlog ? this.matchMode : 'off';
    const facetMode = matchMode === 'hard'
      ? 'require'
      : matchMode === 'soft' ? (explicitSort ? 'require' : 'boost') : undefined;
    const perspectiveBlogName = (facetMode || hasFacetTuning) ? (routePerspectiveBlog || undefined) : undefined;

    try {
      const resp = await apiClient.posts.searchCached({
        tag_name: this.query,
        session_id: this.searchSessionId || undefined,
        page_number: targetPage,
        page_size: SEARCH_PAGE_SIZE,
        perspective_blog_name: perspectiveBlogName,
        facetMode,
        sort_field: sortOpt.field as PostSortField,
        order: sortOpt.order as Order,
        post_types: this.selectedTypes,
        variants: this.selectedVariants.length > 0 ? this.selectedVariants : undefined,
        when: this.searchWhen || undefined,
        page: {
          page_size: SEARCH_PAGE_SIZE,
        },
        ...facetTuning,
      });
      if (searchToken !== this.activeSearchToken || signature !== this.currentSearchSignature) {
        return;
      }

      this.backendCursor = resp.page?.nextPageToken || null;
      const nextState = applyContentPageResponseState({
        responseSessionId: resp.sessionId,
        currentSessionId: this.searchSessionId,
        responsePageNumber: resp.pageNumber,
        targetPage,
        hasMore: resp.hasMore,
      });
      this.searchSessionId = nextState.sessionId;
      this.currentPage = nextState.currentPage;
      this.hasNextPage = nextState.hasNextPage;
      this.exhausted = nextState.exhausted;

      const newUnits = prepareContentResultUnits({
        units: materializeSearchResultUnits(resp),
        seenIds: this.seenIds,
        stats: this.stats,
      });

      this.resultUnits = mergeContentPageUnits({
        navigationMode: this.navigationMode,
        targetPage,
        existingUnits: this.resultUnits,
        newUnits,
      });

      if (shouldSyncContentUrlAfterPageLoad({
        navigationMode: this.navigationMode,
        replaceUrlOnPageBoundary: this.replaceSearchUrlOnPageBoundary,
        currentPage: this.currentPage,
      })) {
        this.syncSearchUrlState();
      }
    } finally {
      if (searchToken === this.activeSearchToken && signature === this.currentSearchSignature) {
        this.loading = false;
      }
    }
  }

  private async loadMore(): Promise<void> {
    if (!canLoadMoreContentPage({
      navigationMode: this.navigationMode,
      loading: this.loading,
      exhausted: this.exhausted,
    })) return;
    await this.fillPage(this.activeSearchToken, this.currentSearchSignature, this.currentPage + 1);
  }

  private async handlePreviousPage(): Promise<void> {
    const targetPage = getAdjacentContentPageTarget({
      direction: 'previous',
      currentPage: this.currentPage,
      hasNextPage: this.hasNextPage,
      loading: this.loading,
    });
    if (targetPage === null) return;
    this.currentPage = targetPage;
    this.navigationMode = 'paginated';
    await this.search({ preserveNavigationState: true });
  }

  private async handleNextPage(): Promise<void> {
    const targetPage = getAdjacentContentPageTarget({
      direction: 'next',
      currentPage: this.currentPage,
      hasNextPage: this.hasNextPage,
      loading: this.loading,
    });
    if (targetPage === null) return;
    this.currentPage = targetPage;
    this.navigationMode = 'paginated';
    await this.search({ preserveNavigationState: true });
  }

  private handleSortChange(e: CustomEvent): void {
    this.sortValue = e.detail.value;
    this.sortExplicitInUrl = true;
    setSearchSortPreference(this.sortValue);
    if (this.hasSearched) {
      this.search();
    }
  }

  private handleWhenChange(e: CustomEvent<{ value: string }>): void {
    this.searchWhen = normalizeArchiveWhenValue(e.detail.value);
    const routeState = forcePaginatedContentRouteNavigation(this.infiniteScroll);
    this.currentPage = routeState.currentPage;
    this.searchSessionId = routeState.sessionId;
    this.navigationMode = routeState.navigationMode;
    this.replaceSearchUrlOnPageBoundary = routeState.replaceUrlOnPageBoundary;
    if (this.hasSearched) {
      void this.search({ preserveNavigationState: true });
    } else {
      this.syncSearchUrlState();
    }
  }

  private handleMatchChange(e: Event): void {
    const value = (e.target as HTMLSelectElement).value;
    if (value === 'soft' || value === 'hard' || value === 'off') {
      this.matchMode = value;
      if (this.hasSearched) {
        this.search();
      }
    }
  }

  private handleTypesChange(e: CustomEvent): void {
    this.selectedTypes = e.detail.types;
    if (this.hasSearched) {
      this.search();
    }
  }

  private handleVariantChange(e: CustomEvent): void {
    this.selectedVariants = e.detail.variants || [];
    if (this.hasSearched) {
      this.search();
    }
  }

  private handleGalleryModeChange(e: CustomEvent): void {
    this.galleryMode = e.detail.value;
  }

  private handlePostClick(e: CustomEvent): void {
    e.stopPropagation();
    const post = e.detail.post as ProcessedPost;
    const allPosts = flattenContentResultPosts(this.resultUnits);

    const index = allPosts.findIndex(p => p.id === post.id);

    this.dispatchEvent(new CustomEvent('post-click', {
      detail: { post, posts: allPosts, index: index >= 0 ? index : 0, from: e.detail?.from || 'search' },
      bubbles: true,
      composed: true
    }));
  }

  private handleSearchGroupClick(e: CustomEvent): void {
    const originPostId = Number(e.detail?.originPostId || 0);
    if (!originPostId) return;
    window.location.href = buildPageUrl('search', undefined, {
      q: `post:${originPostId}`,
      variants: 'reblog',
    });
  }

  private handleInfiniteToggle(e: CustomEvent): void {
    this.infiniteScroll = e.detail.enabled;
    this.navigationMode = resolveToggledContentNavigationMode({
      infiniteEnabled: this.infiniteScroll,
      forcedPaginatedFromUrl: false,
    });
    if (this.navigationMode === 'infinite' && this.infiniteScroll) {
      this.observeSentinel();
    }
  }

  private handleKeyPress(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      this.search();
    }
  }

  private renderSyntaxGuide() {
    const examples = [
      {
        label: 'Open a specific post thread',
        query: 'post:43110814',
      },
      {
        label: 'Filter to a blog plus media kind',
        query: 'blog:Inner-Indulgence media:image',
      },
      {
        label: 'Exact legacy tag with spaces',
        query: 'tag:"best served hot"',
      },
      {
        label: 'Combine OR groups with implicit AND',
        query: '(tag:latex | tag:rubber) (media:image | media:video)',
      },
      {
        label: 'Require both text ideas explicitly',
        query: 'bikini & ddlg',
      },
      {
        label: 'Phrase search with a calendar window',
        query: '"best served hot" when:2024-12',
      },
    ];

    return html`
      <div class="syntax-backdrop" @click=${() => (this.showSyntaxGuide = false)}>
        <section class="syntax-modal" role="dialog" aria-label="Search syntax" @click=${(e: Event) => e.stopPropagation()}>
          <div class="syntax-header">
            <div class="syntax-title">Search syntax</div>
            <button class="syntax-close" @click=${() => (this.showSyntaxGuide = false)}>Close</button>
          </div>

          <div class="syntax-grid">
            <div class="syntax-section">
              <h4>Core rules</h4>
              <div class="syntax-list">
                <div class="syntax-row"><code>words here</code><span>Free text across post text fields and tags.</span></div>
                <div class="syntax-row"><code>"exact phrase"</code><span>Phrase search across that same text space.</span></div>
                <div class="syntax-row"><code>a b</code><span>Bare text stays broad and relevance-ranked.</span></div>
                <div class="syntax-row"><code>a &amp; b</code><span>Require both sides explicitly.</span></div>
                <div class="syntax-row"><code>a | b</code><span>Use <strong>OR</strong> explicitly.</span></div>
                <div class="syntax-row"><code>-term</code><span>Exclude a term or group with <strong>NOT</strong>.</span></div>
                <div class="syntax-row"><code>(a | b) c</code><span>Parentheses group boolean logic.</span></div>
              </div>
            </div>

            <div class="syntax-section">
              <h4>Typed filters</h4>
              <div class="syntax-list">
                <div class="syntax-row"><code>post:43110814</code><span>Specific post or origin-post thread.</span></div>
                <div class="syntax-row"><code>blog:SomeBlog</code><span>Posting blog, scoped further by the existing Original / Reblog / All controls.</span></div>
                <div class="syntax-row"><code>tag:latex</code><span>Exact tag filter.</span></div>
                <div class="syntax-row"><code>tag:"best served hot"</code><span>Exact legacy tag with spaces.</span></div>
                <div class="syntax-row"><code>media:image</code><span>Media kind filter. Use <code>|</code> for multiple kinds.</span></div>
                <div class="syntax-row"><code>when:2024</code><span>Year filter. Also supports <code>YYYY-MM</code> and <code>YYYY-MM-DD</code>.</span></div>
              </div>
            </div>

            <div class="syntax-section">
              <h4>Try it</h4>
              <p>These open in a new tab so you can test-drive the language without losing your current search.</p>
              <div class="syntax-list">
                ${examples.map((example) => html`
                  <a
                    class="syntax-example"
                    href=${buildPageUrl('search', undefined, { q: example.query })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div class="syntax-example-label">${example.label}</div>
                    <code>${example.query}</code>
                  </a>
                `)}
              </div>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  render() {
    const routePerspectiveBlog = getBlogNameFromPath();
    const matchHelp = routePerspectiveBlog === 'you'
      ? 'Use your profile to shape results.'
      : routePerspectiveBlog ? `Use @${routePerspectiveBlog}'s profile to shape results.` : '';
    return html`
      <div class="content">
        <p class="help">
          <button @click=${() => (this.showSyntaxGuide = true)}>Search syntax</button>
        </p>

        <div class="search-box">
          <input
            type="text"
            placeholder="Search posts, tags, blog:foo, media:image..."
            .value=${this.query}
            @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)}
            @keypress=${this.handleKeyPress}
          />
          <button ?disabled=${this.searching} @click=${() => this.search()}>
            ${this.searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        ${routePerspectiveBlog ? html`
          <div class="match-box">
            <div class="match-copy">
              <div class="match-label">Match</div>
              <div class="match-help">${matchHelp}</div>
            </div>
            <select class="match-select" .value=${this.matchMode} @change=${this.handleMatchChange}>
              <option value="off">Off</option>
              <option value="soft">Soft</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        ` : ''}

        <control-panel
          .pageName=${'search'}
          .sortValue=${this.sortValue}
          .selectedTypes=${this.selectedTypes}
          .selectedVariants=${this.selectedVariants}
          .whenValue=${this.searchWhen}
          .galleryMode=${this.galleryMode}
          .infiniteScroll=${this.infiniteScroll}
          .showSort=${true}
          .showTypes=${true}
          .showVariants=${true}
          .showWhen=${true}
          .showGalleryMode=${true}
          .showInfiniteScroll=${true}
          .settingsHref=${'/settings/you#search'}
          .loading=${this.loading}
          @sort-change=${this.handleSortChange}
          @types-change=${this.handleTypesChange}
          @variant-change=${this.handleVariantChange}
          @when-change=${this.handleWhenChange}
          @gallery-mode-change=${this.handleGalleryModeChange}
          @infinite-toggle=${this.handleInfiniteToggle}
        ></control-panel>

        ${!this.hasSearched
          ? html`
              ${this.teaserPosts.length > 0
                ? html`
                    <result-group
                      wide
                      bare
                      .title=${'For You'}
                      .description=${'A teaser of personalized results while you refine your search.'}
                      .actionHref=${buildPageUrl('for', getBlogNameFromPath() || getPrimaryBlogName() || '')}
                      .actionLabel=${'See more'}
                    >
                      <post-grid .posts=${this.teaserPosts} .page=${'search'} .mode=${this.galleryMode}></post-grid>
                    </result-group>
                  `
                : this.teaserLoading
                ? html`<div class="status">Loading recommendations…</div>`
                : ''}
            `
          : ''}

        ${this.searching && this.resultUnits.length === 0
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

        ${this.statusMessage && !this.searching && !this.errorMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}

        ${this.resultUnits.length > 0
          ? html`
              <div @search-group-click=${this.handleSearchGroupClick}>
                ${this.renderSearchResultUnits()}
              </div>
              <load-footer
                mode="search"
                pageName="search"
                .stats=${this.stats}
                .loading=${this.loading}
                .exhausted=${this.exhausted}
                .loadingCurrent=${this.loadingCurrent}
                .loadingTarget=${SEARCH_PAGE_SIZE}
                .infiniteScroll=${this.infiniteScroll}
                .navigationMode=${this.navigationMode}
                .currentPage=${this.currentPage}
                .hasPreviousPage=${this.currentPage > 1}
                .hasNextPage=${this.hasNextPage}
                @load-more=${() => this.loadMore()}
                @previous-page=${() => this.handlePreviousPage()}
                @next-page=${() => this.handleNextPage()}
              ></load-footer>
            `
          : ''}

        <div id="scroll-sentinel" style="height:1px;"></div>
        ${this.showSyntaxGuide ? this.renderSyntaxGuide() : ''}
      </div>
    `;
  }
}
