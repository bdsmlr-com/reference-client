import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { setUrlParams, isBlogInPath, isAdminMode } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { parsePostTypesParam, parseVariantsParam } from '../services/post-filter-url.js';
import { scrollObserver } from '../services/scroll-observer.js';
import {
  setCachedPaginationCursor,
  getVariantPreference,
} from '../services/storage.js';
import { normalizeSortValue, type ProcessedPost, type ViewStats, SORT_OPTIONS } from '../types/post.js';
import type { Blog, PostType, PostSortField, Order, PostVariant, Tag } from '../types/api.js';
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
import {
  getGalleryMode,
  PROFILE_EVENTS,
  normalizeGalleryModeForCapabilities,
  type GalleryMode,
  getArchiveSortPreference,
  setArchiveSortPreference,
} from '../services/profile.js';
import { getViewerCapabilities, viewerHasCapability } from '../services/viewer-capabilities.js';
import { getPageSlotConfig } from '../services/render-page.js';
import type { RenderSlotConfig } from '../config.js';
import { generatePaginationCursorKey } from '../services/storage.js';
import { materializeSearchResultUnits, type SearchResultUnit } from '../services/search-result-units.js';
import { type SortOptionLockedDetail, type VariantOptionLockedDetail } from '../types/events.js';

import '../components/control-panel.js';
import '../components/activity-grid.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/skeleton-loader.js';
import '../components/error-state.js';
import '../components/blog-header.js';
import '../components/archive-tag-cloud.js';
import '../components/render-card.js';
import '../components/route-shell-card.js';

const ARCHIVE_PAGE_SIZE = 20;

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
        width: 100%;
        display: flex;
        gap: 10px;
        align-items: stretch;
        justify-content: stretch;
      }

      .archive-tools {
        max-width: 900px;
        margin: 0 auto 20px;
        padding: 0 16px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 12px;
        align-items: stretch;
      }

      .archive-tools archive-tag-cloud {
        min-width: 0;
      }

      .roadblock-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 1000;
      }

      .roadblock-modal {
        width: min(520px, 100%);
        background: var(--bg-panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
        padding: 18px 18px 14px;
        display: grid;
        gap: 12px;
      }

      .roadblock-eyebrow {
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .roadblock-title {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        color: var(--text-primary);
      }

      .roadblock-copy {
        margin: 0;
        font-size: 14px;
        line-height: 1.5;
        color: var(--text-muted);
      }

      .roadblock-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
      }

      .roadblock-button {
        min-height: 36px;
        padding: 8px 14px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: transparent;
        color: var(--text-primary);
      }

      .roadblock-button.primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }

      .search-box input {
        flex: 1;
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

      @media (max-width: 720px) {
        .archive-tools {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  @property({ type: String }) blog = '';

  @state() private blogId: number | null = null;
  @state() private sortValue = 'newest';
  @state() private selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private selectedVariants: PostVariant[] = [];
  @state() private resultUnits: SearchResultUnit[] = [];
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
  @state() private searchSessionId = '';
  @state() private initialLoading = false;
  @state() private blogData: Blog | null = null;
  @state() private archiveTagItems: Tag[] = [];
  @state() private archiveTagsLoading = false;
  @state() private archiveTagsError = '';
  @state() private viewerCapabilities: string[] = getViewerCapabilities();
  @state() private archiveRoadblock: { kind: 'sort' | 'variant' | 'gallery' } | null = null;
  @state() private autoRetryAttempt = 0;
  @state() private isRetryableError = false;
  @state() private galleryMode: GalleryMode = normalizeGalleryModeForCapabilities(getGalleryMode('archive'), getViewerCapabilities());
  private readonly mainSlotConfig: RenderSlotConfig = getPageSlotConfig('archive', 'main_stream');

  private seenIds = new Set<number>();
  private forcedPaginatedFromUrl = false;
  private paginationKey = '';
  private replaceArchiveUrlOnPageBoundary = false;
  private activeArchiveLoadId = 0;

  private scheduleArchiveTagCloudLoad(): void {
    const run = () => {
      void this.loadArchiveTagCloud();
    };

    const maybeWindow = globalThis as typeof globalThis & {
      requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
      setTimeout: typeof setTimeout;
    };

    if (typeof maybeWindow.requestIdleCallback === 'function') {
      maybeWindow.requestIdleCallback(run, { timeout: 1500 });
      return;
    }

    maybeWindow.setTimeout(run, 250);
  }

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('blog')) {
      this.loadFromUrl();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('beforeunload', this.savePaginationState);
    window.addEventListener(PROFILE_EVENTS.galleryModeChanged, this.handleGalleryModeChanged as EventListener);
    window.addEventListener('auth-user-changed', this.handleAuthUserChanged as EventListener);
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
    window.removeEventListener('auth-user-changed', this.handleAuthUserChanged as EventListener);
    clearBlogTheme();
  }

  private handleGalleryModeChanged = (): void => {
    this.galleryMode = normalizeGalleryModeForCapabilities(getGalleryMode('archive'), getViewerCapabilities());
  };

  private handleAuthUserChanged = (): void => {
    const previousSort = this.sortValue;
    const previousVariants = [...this.selectedVariants];
    this.viewerCapabilities = getViewerCapabilities();
    this.galleryMode = normalizeGalleryModeForCapabilities(getGalleryMode('archive'), this.viewerCapabilities);
    this.sortValue = this.normalizeArchiveSortValue(this.sortValue, { showRoadblock: true });
    this.selectedVariants = this.normalizeArchiveVariants(this.selectedVariants, { showRoadblock: true });
    const sortChanged = previousSort !== this.sortValue;
    const variantsChanged = !this.sameVariants(previousVariants, this.selectedVariants);
    if ((sortChanged || variantsChanged) && this.blogId) {
      void this.loadPosts({ preserveNavigationState: true });
    }
  };

  private sameVariants(left: PostVariant[], right: PostVariant[]): boolean {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((value, index) => value === right[index]);
  }

  private hasCapability(capability: string): boolean {
    return this.viewerCapabilities.includes(capability);
  }

  private canUseArchiveSorts(): boolean {
    return this.hasCapability('use_archive_non_newest_sort');
  }

  private canUseArchiveVariantFilters(): boolean {
    return this.hasCapability('use_archive_variant_filters');
  }

  private canUseMasonry(): boolean {
    return viewerHasCapability('use_masonry');
  }

  private lockedGalleryModes(): Array<'grid' | 'masonry'> {
    return this.canUseMasonry() ? [] : ['masonry'];
  }

  private normalizeGalleryModeForArchive(mode: GalleryMode): GalleryMode {
    return normalizeGalleryModeForCapabilities(mode, this.viewerCapabilities);
  }

  private normalizeArchiveSortValue(value: string, options: { showRoadblock?: boolean } = {}): string {
    const normalized = normalizeSortValue(value);
    if (this.canUseArchiveSorts()) {
      return normalized;
    }
    if (normalized !== 'newest' && options.showRoadblock) {
      this.openArchiveRoadblock('sort');
    }
    return 'newest';
  }

  private normalizeArchiveVariants(variants: PostVariant[], options: { showRoadblock?: boolean } = {}): PostVariant[] {
    const values = Array.isArray(variants) ? [...variants] : [];
    if (this.canUseArchiveVariantFilters()) {
      return values;
    }
    if (values.length > 0 && options.showRoadblock) {
      this.openArchiveRoadblock('variant');
    }
    return [];
  }

  private variantSelectionToPostVariants(selection: string | null | undefined): PostVariant[] {
    switch (selection) {
      case 'original':
        return [1];
      case 'reblog':
        return [2];
      default:
        return [];
    }
  }

  private lockedArchiveSortValues(): string[] {
    if (this.canUseArchiveSorts()) {
      return [];
    }
    return SORT_OPTIONS.filter((option) => option.value !== 'newest').map((option) => option.value);
  }

  private lockedArchiveVariantSelections(): Array<'all' | 'original' | 'reblog'> {
    return this.canUseArchiveVariantFilters() ? [] : ['original', 'reblog'];
  }

  private openArchiveRoadblock(kind: 'sort' | 'variant' | 'gallery'): void {
    this.archiveRoadblock = { kind };
  }

  private closeArchiveRoadblock = (): void => {
    this.archiveRoadblock = null;
  };

  private savePaginationState = (): void => {
    if (this.paginationKey && this.resultUnits.length > 0) {
      setCachedPaginationCursor(
        this.paginationKey,
        this.searchSessionId,
        window.scrollY,
        this.resultUnits.length,
        this.exhausted
      );
    }
  };

  private buildArchiveUrlParams(): Record<string, string> {
    return buildContentRouteUrlParams({
      query: this.query,
      sortValue: this.sortValue,
      selectedTypes: this.selectedTypes,
      selectedVariants: this.selectedVariants,
      whenValue: this.archiveWhen,
      currentPage: this.currentPage,
      navigationMode: this.navigationMode,
      replaceUrlOnPageBoundary: this.replaceArchiveUrlOnPageBoundary,
      sessionId: this.currentPage > 1 ? this.searchSessionId : '',
      extraParams: !isBlogInPath() ? { blog: this.blog } : {},
    });
  }

  private syncArchiveUrlState(): void {
    setUrlParams(this.buildArchiveUrlParams());
  }

  private buildArchiveScopedQuery(): string {
    const trimmed = this.query.trim();
    if (!trimmed) {
      return `blog:${this.blog}`;
    }
    return `(${trimmed}) blog:${this.blog}`;
  }

  private formatArchiveTagQuery(tag: string): string {
    const trimmed = tag.trim();
    if (!trimmed) {
      return '';
    }
    if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      return `tag:${trimmed}`;
    }
    const escaped = trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `tag:"${escaped}"`;
  }

  async loadArchiveTagCloud(): Promise<void> {
    if (!this.blog) {
      this.archiveTagItems = [];
      this.archiveTagsError = '';
      return;
    }
    this.archiveTagsLoading = true;
    this.archiveTagsError = '';
    try {
      const response = await apiClient.blogs.getTopTags({
        blog_name: this.blog,
        page_size: 150,
      });
      this.archiveTagItems = response.tags || [];
    } catch (error) {
      this.archiveTagItems = [];
      this.archiveTagsError = getContextualErrorMessage(error, 'load_posts', { blogName: this.blog });
    } finally {
      this.archiveTagsLoading = false;
    }
  }

  private async fetchArchivePageResponse(targetPage: number) {
    if (!this.blog || !this.blogId) {
      return null;
    }

    const sortOpt = SORT_OPTIONS.find((o) => o.value === this.sortValue) || SORT_OPTIONS[0];
    const sessionId = targetPage > 1 ? this.searchSessionId || undefined : undefined;

    return apiClient.posts.list({
      blog_id: this.blogId,
      blog_name: this.blog,
      q: this.query.trim() || undefined,
      activity_kinds: ['post', 'reblog'],
      session_id: sessionId,
      page_number: targetPage,
      page_size: ARCHIVE_PAGE_SIZE,
      sort_field: sortOpt.field as PostSortField,
      order: sortOpt.order as Order,
      post_types: this.selectedTypes,
      variants: this.selectedVariants.length > 0 ? this.selectedVariants : undefined,
      when: this.archiveWhen || undefined,
      page: {
        page_size: ARCHIVE_PAGE_SIZE,
      },
    });
  }

  private async loadFromUrl(): Promise<void> {
    const {
      query,
      sort,
      types,
      variants,
      when,
      infinitePref,
      forcePaginatedFromUrl,
      routeState,
    } = readContentRouteUrlState({
      pageName: 'archive',
      normalizeWhen: parseArchiveWhenParam,
      forcePaginatedOnWhen: true,
    });

    const sortSource = sort || getArchiveSortPreference();
    const resolvedSort = this.normalizeArchiveSortValue(normalizeSortValue(sortSource), {
      showRoadblock: Boolean(sortSource && sortSource !== 'newest'),
    });
    this.sortValue = resolvedSort;
    this.query = query;
    this.infiniteScroll = infinitePref;
    this.archiveWhen = when;
    this.forcedPaginatedFromUrl = forcePaginatedFromUrl;
    this.navigationMode = routeState.navigationMode;
    this.currentPage = routeState.currentPage;
    this.searchSessionId = routeState.sessionId;
    this.replaceArchiveUrlOnPageBoundary = routeState.replaceUrlOnPageBoundary;
    this.hasNextPage = false;
    this.galleryMode = this.normalizeGalleryModeForArchive(getGalleryMode('archive'));
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
        this.selectedVariants = this.normalizeArchiveVariants(parsedVariants, { showRoadblock: true });
      }
    } else {
      const savedVariants = getVariantPreference('archive');
      this.selectedVariants = this.normalizeArchiveVariants(this.variantSelectionToPostVariants(savedVariants), {
        showRoadblock: savedVariants !== 'all' && savedVariants !== null,
      });
    }

    if (!this.blog) {
      this.errorMessage = ErrorMessages.VALIDATION.NO_BLOG_SPECIFIED;
      return;
    }

    this.initialLoading = true;
    this.errorMessage = '';
    this.archiveTagsError = '';
    try {
      this.blogData = await initBlogTheme(this.blog, { includeArchiveBounds: true });
      const blogId = this.blogData?.id || await apiClient.identity.resolveNameToId(this.blog);

      if (!blogId) {
        this.errorMessage = ErrorMessages.BLOG.notFound(this.blog);
        this.isRetryableError = false;
        return;
      }

      this.blogId = blogId;
      await this.loadPosts({ preserveNavigationState: true });
      this.scheduleArchiveTagCloudLoad();
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
    const nextLoadState = buildContentRouteLoadState({
      preserveNavigationState,
      infinitePref: this.infiniteScroll,
      forcePaginated: this.forcedPaginatedFromUrl,
      currentPage: this.currentPage,
      currentSessionId: this.searchSessionId,
      currentNavigationMode: this.navigationMode,
      currentReplaceUrlOnPageBoundary: this.replaceArchiveUrlOnPageBoundary,
    });
    this.currentPage = nextLoadState.currentPage;
    this.searchSessionId = nextLoadState.sessionId;
    this.navigationMode = nextLoadState.navigationMode;
    this.replaceArchiveUrlOnPageBoundary = nextLoadState.replaceUrlOnPageBoundary;
    this.exhausted = nextLoadState.exhausted;
    this.hasNextPage = nextLoadState.hasNextPage;
    this.seenIds.clear();
    this.stats = nextLoadState.stats;
    this.resultUnits = nextLoadState.resultUnits;
    this.statusMessage = nextLoadState.statusMessage;
    this.errorMessage = '';
    this.syncArchiveUrlState();
    this.paginationKey = generatePaginationCursorKey('archive', buildContentPaginationSignature({
      query: this.buildArchiveScopedQuery(),
      sortValue: this.sortValue,
      selectedTypes: this.selectedTypes,
      selectedVariants: this.selectedVariants,
      whenValue: this.archiveWhen,
      extra: { blog: this.blog },
    }));

    const loadId = ++this.activeArchiveLoadId;

    try {
      await this.fillPage(this.currentPage, loadId);
    } catch (e) {
      if (loadId === this.activeArchiveLoadId) {
        this.errorMessage = getContextualErrorMessage(e, 'load_posts', { blogName: this.blog });
      }
    }

    if (this.navigationMode === 'infinite') {
      this.observeSentinel();
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
          if (this.infiniteScroll && !this.loading && !this.exhausted && this.blogId) {
            this.loadMore();
          }
        });
      }
    });
  }

  private async fillPage(targetPage: number = this.currentPage, loadId: number = this.activeArchiveLoadId): Promise<void> {
    this.loading = true;

    try {
      const resp = await this.fetchArchivePageResponse(targetPage);
      if (loadId !== this.activeArchiveLoadId) {
        return;
      }
      if (!resp) {
        return;
      }

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
        allowDuplicateIds: isAdminMode(),
      });

      if (targetPage === 1) {
        this.statusMessage = newUnits.length === 0 ? 'No posts found' : '';
        if (newUnits.length === 0) {
          this.hasNextPage = false;
          this.exhausted = true;
        }
      }

      this.resultUnits = mergeContentPageUnits({
        navigationMode: this.navigationMode,
        targetPage,
        existingUnits: this.resultUnits,
        newUnits,
      });
      if (shouldSyncContentUrlAfterPageLoad({
        navigationMode: this.navigationMode,
        replaceUrlOnPageBoundary: this.replaceArchiveUrlOnPageBoundary,
        currentPage: this.currentPage,
      })) {
        this.syncArchiveUrlState();
      }
    } finally {
      if (loadId === this.activeArchiveLoadId) {
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
    await this.fillPage(this.currentPage + 1);
  }

  private handleSortChange(e: CustomEvent): void {
    const nextValue = normalizeSortValue(e.detail.value);
    if (!this.canUseArchiveSorts() && nextValue !== 'newest') {
      this.openArchiveRoadblock('sort');
      return;
    }
    this.sortValue = this.normalizeArchiveSortValue(nextValue);
    setArchiveSortPreference(this.sortValue);
    void this.loadPosts();
  }

  private handleSortOptionLocked(e: CustomEvent<SortOptionLockedDetail>): void {
    e.stopPropagation();
    this.openArchiveRoadblock('sort');
  }

  private handleTypesChange(e: CustomEvent): void {
    this.selectedTypes = e.detail.types;
    void this.loadPosts();
  }

  private handleVariantChange(e: CustomEvent): void {
    const nextVariants = this.normalizeArchiveVariants(e.detail.variants || []);
    if (!this.canUseArchiveVariantFilters() && (e.detail.variants || []).length > 0) {
      this.openArchiveRoadblock('variant');
      return;
    }
    this.selectedVariants = nextVariants;
    void this.loadPosts();
  }

  private handleVariantOptionLocked(e: CustomEvent<VariantOptionLockedDetail>): void {
    e.stopPropagation();
    this.openArchiveRoadblock('variant');
  }

  private handleWhenChange(e: CustomEvent<{ value: string }>): void {
    this.archiveWhen = parseArchiveWhenParam(e.detail.value);
    this.forcedPaginatedFromUrl = this.archiveWhen.length > 0;
    const routeState = forcePaginatedContentRouteNavigation(this.infiniteScroll);
    this.currentPage = routeState.currentPage;
    this.searchSessionId = routeState.sessionId;
    this.hasNextPage = false;
    this.navigationMode = routeState.navigationMode;
    this.replaceArchiveUrlOnPageBoundary = routeState.replaceUrlOnPageBoundary;
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

  private async handleArchiveTagSelect(e: CustomEvent<{ tag: string }>): Promise<void> {
    this.query = this.formatArchiveTagQuery(e.detail.tag);
    await this.loadPosts();
  }

  private handlePostClick(e: CustomEvent): void {
    e.stopPropagation();
    const post = e.detail.post as ProcessedPost;
    const allPosts = flattenContentResultPosts(this.resultUnits);
    const index = allPosts.findIndex((p) => p.id === post.id);

    this.dispatchEvent(new CustomEvent('post-click', {
      detail: { post, posts: allPosts, index: index >= 0 ? index : 0, from: e.detail?.from || 'archive' },
      bubbles: true,
      composed: true
    }));
  }

  private handleInfiniteToggle(e: CustomEvent): void {
    this.infiniteScroll = e.detail.enabled;
    const nextMode = resolveToggledContentNavigationMode({
      infiniteEnabled: this.infiniteScroll,
      forcedPaginatedFromUrl: this.forcedPaginatedFromUrl,
    });
    if (this.forcedPaginatedFromUrl) {
      return;
    }
    if (nextMode !== this.navigationMode) {
      this.navigationMode = nextMode;
      void this.loadPosts();
      return;
    }
    if (this.infiniteScroll) this.observeSentinel();
  }

  private handleGalleryModeChange(e: CustomEvent): void {
    this.galleryMode = this.normalizeGalleryModeForArchive(e.detail.value);
    if (e.detail.value === 'masonry' && !this.canUseMasonry()) {
      this.openArchiveRoadblock('gallery');
    }
  }

  private handleGalleryModeLocked(): void {
    this.openArchiveRoadblock('gallery');
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
    await this.loadPosts({ preserveNavigationState: true });
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
    await this.loadPosts({ preserveNavigationState: true });
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
          .blogId=${this.blogData?.id || 0}
          .blogName=${this.blog}
          .blogTitle=${this.blogData?.title || ''}
          .blogDescription=${this.blogData?.description || ''}
          .avatarUrl=${this.blogData?.avatarUrl || ''}
          .identityDecorations=${this.blogData?.identityDecorations || []}
        ></blog-header>

        ${this.initialLoading && !this.blogId ? html`<loading-spinner message="Loading archive..."></loading-spinner>` : ''}

        ${this.blogId ? html`
          <route-shell-card wide compact>
            <div class="archive-tools">
              <div class="search-box">
                <input
                  type="text"
                  placeholder="Filter this archive with free text or tag:..."
                  .value=${this.query}
                  @input=${this.handleArchiveQueryInput}
                  @keypress=${this.handleArchiveQueryKeyPress}
                />
                <button ?disabled=${this.loading} @click=${() => this.loadPosts()}>
                  ${this.loading ? 'Filtering...' : 'Filter'}
                </button>
              </div>

              <archive-tag-cloud
                .blogId=${this.blogData?.id || 0}
          .blogName=${this.blog}
                .tags=${this.archiveTagItems}
                .loading=${this.archiveTagsLoading}
                .error=${this.archiveTagsError}
                @tag-select=${this.handleArchiveTagSelect}
              ></archive-tag-cloud>
            </div>

            <control-panel
              .framed=${false}
              .pageName=${'archive'}
              .sortValue=${this.sortValue}
              .selectedTypes=${this.selectedTypes}
              .selectedVariants=${this.selectedVariants}
              .whenValue=${this.archiveWhen}
              .blog=${this.blogData}
              .galleryMode=${this.galleryMode}
              .lockedGalleryModes=${this.lockedGalleryModes()}
              .infiniteScroll=${this.infiniteScroll}
              .lockedSortValues=${this.lockedArchiveSortValues()}
              .lockedVariantSelections=${this.lockedArchiveVariantSelections()}
              .showSort=${true}
              .showTypes=${true}
              .showVariants=${true}
              .showWhen=${true}
              .showGalleryMode=${true}
              .showInfiniteScroll=${true}
              .settingsHref=${'/settings/you#archive'}
              .loading=${this.loading}
              @sort-change=${this.handleSortChange}
              @sort-option-locked=${this.handleSortOptionLocked}
              @types-change=${this.handleTypesChange}
              @variant-change=${this.handleVariantChange}
              @variant-option-locked=${this.handleVariantOptionLocked}
              @when-change=${this.handleWhenChange}
              @gallery-mode-change=${this.handleGalleryModeChange}
              @gallery-mode-locked=${this.handleGalleryModeLocked}
              @infinite-toggle=${this.handleInfiniteToggle}
            ></control-panel>
          </route-shell-card>
        ` : ''}

        ${this.archiveRoadblock ? html`
          <div class="roadblock-backdrop" @click=${this.closeArchiveRoadblock}>
            <section
              class="roadblock-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Upgrade to unlock archive controls"
              @click=${(event: Event) => event.stopPropagation()}
            >
              <div class="roadblock-eyebrow">Archive controls limited</div>
              <h3 class="roadblock-title">
                ${this.archiveRoadblock.kind === 'sort'
                  ? 'Non-newest archive sorts are locked'
                  : this.archiveRoadblock.kind === 'variant'
                    ? 'Archive variant filters are locked'
                    : 'Masonry layout is locked'}
              </h3>
              <p class="roadblock-copy">
                ${this.archiveRoadblock.kind === 'sort'
                  ? 'This archive stays on newest until the viewer is entitled to unlock additional sort orders.'
                  : this.archiveRoadblock.kind === 'variant'
                    ? 'This archive stays on all posts until the viewer is entitled to unlock original/reblog filtering.'
                    : 'This archive stays on grid until the viewer is entitled to unlock masonry.'}
              </p>
              <p class="roadblock-copy">
                Upgrade to unlock this control and keep browsing without restrictions.
              </p>
              <div class="roadblock-actions">
                <button class="roadblock-button" type="button" @click=${this.closeArchiveRoadblock}>Not now</button>
                <button class="roadblock-button primary" type="button" @click=${this.closeArchiveRoadblock}>Learn more</button>
              </div>
            </section>
          </div>
        ` : ''}

        ${this.errorMessage ? html`<error-state title="Error" message=${this.errorMessage} @retry=${this.handleRetry}></error-state>` : ''}
        ${this.statusMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}
 ${this.resultUnits.length > 0
  ? html`
      <div class="grid-container">
        <activity-grid 
          .mode=${this.galleryMode}
          .page=${'archive'}
          .showBlogChip=${false}
          .items=${contentGridItems(this.resultUnits)}
          @activity-click=${this.handlePostClick}
        ></activity-grid>
        </div>
        `
        : ''}
        ${this.loading && this.resultUnits.length === 0 && !this.errorMessage
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
          .hasPreviousPage=${this.currentPage > 1}
          .hasNextPage=${this.hasNextPage}
          @load-more=${() => this.loadMore()}
          @previous-page=${() => this.handlePreviousPage()}
          @next-page=${() => this.handleNextPage()}
        ></load-footer>

        <div id="scroll-sentinel" style="height:1px;"></div>
      </div>
    `;
  }
}
