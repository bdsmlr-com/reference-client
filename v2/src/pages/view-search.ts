import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { buildPageUrl, getBlogNameFromPath, getPrimaryBlogName, getUrlParam, setUrlParams, isDefaultTypes } from '../services/blog-resolver.js';
import { scrollObserver } from '../services/scroll-observer.js';
import {
  generatePaginationCursorKey,
  setCachedPaginationCursor,
} from '../services/storage.js';
import { extractMedia, normalizeSortValue, type ProcessedPost, type ViewStats, SORT_OPTIONS } from '../types/post.js';
import type { PostType, PostSortField, Order, PostVariant, TimelineItem } from '../types/api.js';
import { BREAKPOINTS } from '../types/ui-constants.js';
import {
  getGalleryMode,
  PROFILE_EVENTS,
  type GalleryMode,
  getSearchSortPreference,
  setSearchSortPreference,
} from '../services/profile.js';
import { toPresentationModel } from '../services/post-presentation.js';
import { getPageSlotConfig } from '../services/render-page.js';
import type { RenderSlotConfig } from '../config.js';
import { ACTIVE_ENV } from '../config.js';
import { materializeRecommendedPosts, recService } from '../services/recommendation-api.js';
import '../components/filter-bar.js';
import '../components/activity-grid.js';
import '../components/post-grid.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/skeleton-loader.js';
import '../components/error-state.js';
import '../components/type-pills.js'; // Might still be used elsewhere or redundant but keeping imports safe
import '../components/render-card.js';
import '../components/result-group.js';

const PAGE_SIZE = 12;

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

      .help code {
        background: var(--bg-panel-alt);
        padding: 2px 6px;
        border-radius: 4px;
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
  @state() private selectedVariants: PostVariant[] = [];
  @state() private timelineItems: TimelineItem[] = [];
  @state() private loading = false;
  @state() private searching = false;
  @state() private exhausted = false;
  @state() private stats: ViewStats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
  @state() private loadingCurrent = 0;
  @state() private infiniteScroll = false;
  @state() private statusMessage = '';
  @state() private hasSearched = false;
  @state() private errorMessage = '';
  @state() private retrying = false;
  @state() private autoRetryAttempt = 0;
  @state() private isRetryableError = false;
  @state() private galleryMode: GalleryMode = getGalleryMode();
  @state() private teaserPosts: ProcessedPost[] = [];
  @state() private teaserLoading = false;
  private readonly mainSlotConfig: RenderSlotConfig = getPageSlotConfig('search', 'main_stream');

  private backendCursor: string | null = null;
  private seenIds = new Set<number>();
  private renderedMediaKeys = new Set<string>(); // Authoritative uniqueness
  private paginationKey = '';
  private activeSearchToken = 0;
  private currentSearchSignature = '';
  private sortExplicitInUrl = false;

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
    this.galleryMode = getGalleryMode();
  };

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

  private loadFromUrl(): void {
    const q = getUrlParam('q');
    const sort = getUrlParam('sort');
    const match = getUrlParam('match');
    const types = getUrlParam('types');
    const variants = getUrlParam('variants');

    if (q) this.query = q;
    if (match === 'soft' || match === 'hard' || match === 'off') this.matchMode = match;
    this.sortExplicitInUrl = !!sort;
    const resolvedSort = normalizeSortValue(sort || getSearchSortPreference());
    this.sortValue = resolvedSort;
    if (!sort) {
      setSearchSortPreference(resolvedSort);
    }
    if (types) {
      this.selectedTypes = types.split(',').map((t) => parseInt(t, 10) as PostType);
    }
    if (variants) {
      this.selectedVariants = variants.split(',').map((v) => parseInt(v, 10) as PostVariant);
    }

    if (this.query) {
      this.search();
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

  private resetState(): void {
    this.backendCursor = null;
    this.exhausted = false;
    this.seenIds.clear();
    this.renderedMediaKeys.clear();
    this.stats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
    this.timelineItems = [];
    this.statusMessage = '';
    this.errorMessage = '';
  }

  private async search(): Promise<void> {
    if (!this.query.trim()) return;
    if (this.selectedTypes.length === 0) {
      this.statusMessage = ErrorMessages.VALIDATION.NO_TYPES_SELECTED;
      return;
    }

    this.searching = true;
    this.resetState();
    this.hasSearched = true;
    const searchToken = ++this.activeSearchToken;
    const normalizedQuery = this.query.trim();
    const routePerspectiveBlog = getBlogNameFromPath();

    const params: Record<string, string> = {
      q: this.query,
      sort: this.sortExplicitInUrl ? this.sortValue : '',
      match: routePerspectiveBlog && this.matchMode !== 'off' ? this.matchMode : '',
      types: isDefaultTypes(this.selectedTypes) ? '' : this.selectedTypes.join(','),
      variants: this.selectedVariants.length > 0 ? this.selectedVariants.join(',') : '',
    };
    setUrlParams(params);

    this.paginationKey = generatePaginationCursorKey('search', {
      q: normalizedQuery,
      sort: this.sortValue,
      types: this.selectedTypes.join(','),
      variants: this.selectedVariants.join(','),
    });
    this.currentSearchSignature = this.paginationKey;

    try {
      await this.fillPage(searchToken, this.currentSearchSignature);
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
      this.observeSentinel();
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

  private toActivityItem(post: ProcessedPost): { post: ProcessedPost; type: 'post' | 'reblog' } {
    const presentation = toPresentationModel(post, { surface: 'card', page: 'activity' });
    return {
      post,
      type: presentation.identity.isReblog ? 'reblog' : 'post',
    };
  }

  private async fillPage(searchToken: number = this.activeSearchToken, signature: string = this.currentSearchSignature): Promise<void> {
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
        perspective_blog_name: perspectiveBlogName,
        facetMode,
        sort_field: sortOpt.field as PostSortField,
        order: sortOpt.order as Order,
        post_types: this.selectedTypes,
        variants: this.selectedVariants.length > 0 ? this.selectedVariants : undefined,
        page: {
          page_size: 48,
          page_token: this.backendCursor || undefined,
        },
        ...facetTuning,
      });
      if (searchToken !== this.activeSearchToken || signature !== this.currentSearchSignature) {
        return;
      }

      this.backendCursor = resp.page?.nextPageToken || null;
      if (!this.backendCursor) this.exhausted = true;

      const newItems: TimelineItem[] = [];
      (resp.posts || []).forEach(rawPost => {
        const post = rawPost as ProcessedPost;
        const media = extractMedia(post);
        const mediaUrl = media.url || media.videoUrl || media.audioUrl;
        const contentKey = post.originPostId ? `oid:${post.originPostId}` : (mediaUrl ? `url:${mediaUrl.split('?')[0]}` : `pid:${post.id}`);

        if (this.seenIds.has(post.id) || this.renderedMediaKeys.has(contentKey)) {
          this.stats.dupes++;
          return;
        }

        this.seenIds.add(post.id);
        this.renderedMediaKeys.add(contentKey);
        post._media = media;
        newItems.push({ type: 1, post });
      });

      this.timelineItems = [...this.timelineItems, ...newItems];
      if (newItems.length === 0) this.exhausted = true;
    } finally {
      if (searchToken === this.activeSearchToken && signature === this.currentSearchSignature) {
        this.loading = false;
      }
    }
  }

  private async loadMore(): Promise<void> {
    if (this.loading || this.exhausted) return;
    await this.fillPage(this.activeSearchToken, this.currentSearchSignature);
  }

  private handleSortChange(e: CustomEvent): void {
    this.sortValue = e.detail.value;
    this.sortExplicitInUrl = true;
    setSearchSortPreference(this.sortValue);
    if (this.hasSearched) {
      this.search();
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
    if (this.infiniteScroll) {
      this.observeSentinel();
    }
  }

  private handleKeyPress(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      this.search();
    }
  }

  render() {
    const routePerspectiveBlog = getBlogNameFromPath();
    const matchHelp = routePerspectiveBlog === 'you'
      ? 'Use your profile to shape results.'
      : routePerspectiveBlog ? `Use @${routePerspectiveBlog}'s profile to shape results.` : '';
    return html`
      <div class="content">
        <p class="help">
          Boolean: <code>tag1 tag2</code> = AND, <code>"exact phrase"</code> = literal,
          <code>-tag</code> = NOT, <code>(a b) c</code> = groups
        </p>

        <div class="search-box">
          <input
            type="text"
            placeholder="Enter tags..."
            .value=${this.query}
            @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)}
            @keypress=${this.handleKeyPress}
          />
          <sort-controls .value=${this.sortValue} @sort-change=${this.handleSortChange}></sort-controls>
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

        <filter-bar
          .selectedTypes=${this.selectedTypes}
          .selectedVariants=${this.selectedVariants}
          .showVariants=${true}
          .loading=${this.loading}
          @types-change=${this.handleTypesChange}
          @variant-change=${this.handleVariantChange}
        ></filter-bar>

        ${!this.hasSearched
          ? html`
              <div class="status">Enter a query to begin searching.</div>
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

        ${this.searching && this.timelineItems.length === 0
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

        ${this.timelineItems.length > 0
          ? html`
              <div class="grid-container">
                <activity-grid 
                  .mode=${this.galleryMode}
                  .items=${this.timelineItems.flatMap(entry => {
                    if (entry.type === 1 && entry.post) {
                      return [this.toActivityItem(entry.post as ProcessedPost)];
                    } else if (entry.type === 2 && entry.cluster) {
                      return (entry.cluster.interactions || []).map((post: any) => this.toActivityItem(post as ProcessedPost));
                    }
                    return [];
                  })} 
                  @activity-click=${this.handlePostClick}
                ></activity-grid>
              </div>

              <load-footer
                mode="search"
                pageName="search"
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
    `;
  }
}
