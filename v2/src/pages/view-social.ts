import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { getPrimaryBlogName, getUrlParam } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import { getSocialSortPreference, setSocialSortPreference } from '../services/profile.js';
import { normalizeSocialSortValue, SOCIAL_SORT_OPTIONS } from '../services/social-sort.js';
import {
  generatePaginationCursorKey,
  getCachedPaginationCursor,
  getInfiniteScrollPreference,
  setCachedPaginationCursor,
} from '../services/storage.js';
import {
  mergeFollowEdges,
  countNewFollowEdges,
  shouldStopFollowPagination,
  fingerprintFollowEdges,
} from '../services/follow-pagination.js';
import { getPageSlotConfig } from '../services/render-page.js';
import type { RenderSlotConfig } from '../config.js';
import type { FollowEdge, Blog, Post } from '../types/api.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import '../components/control-panel.js';
import '../components/blog-list.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/error-state.js';
import '../components/blog-header.js';
import '../components/render-card.js';

const PAGE_SIZE = 100;
type Tab = 'recommended' | 'followers' | 'following' | 'siblings';

@customElement('view-social')
export class ViewSocial extends LitElement {
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

      .tabs {
        display: flex;
        justify-content: center;
        gap: 6px;
        padding: 0 16px;
        margin-bottom: 16px;
      }

      .tab {
        padding: 6px 14px;
        border-radius: 4px;
        background: var(--bg-panel);
        color: var(--text-muted);
        font-size: 13px;
        min-height: 30px;
        transition: all 0.2s;
        border: 1px solid var(--border);
      }

      .tab:hover {
        background: var(--bg-panel-alt);
      }

      .tab.active {
        background: var(--accent);
        color: white;
        border-color: var(--accent);
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

      .list-container {
        margin-bottom: 20px;
      }

      .section-heading {
        max-width: 1200px;
        margin: 0 auto 12px;
        padding: 0 16px;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
      }
    `,
  ];

  @property({ type: String }) blog = '';
  @property({ type: String }) initialTab: Tab = 'followers';
  @property({ type: Boolean }) rootMode = false;

  @state() private blogId: number | null = null;
  @state() private activeTab: Tab = 'followers';
  @state() private followers: FollowEdge[] = [];
  @state() private following: FollowEdge[] = [];
  @state() private siblings: FollowEdge[] = [];
  @state() private recommendedBlogs: FollowEdge[] = [];
  @state() private followersCount = 0;
  @state() private followingCount = 0;
  @state() private siblingsCount = 0;
  @state() private followersCursor: string | null = null;
  @state() private followingCursor: string | null = null;
  @state() private followersExhausted = false;
  @state() private followingExhausted = false;
  @state() private loading = false;
  @state() private infiniteScroll = getInfiniteScrollPreference('social');
  @state() private sortValue = 'default';
  @state() private statusMessage = '';
  @state() private errorMessage = '';
  @state() private retrying = false;
  @state() private autoRetryAttempt = 0;
  @state() private isRetryableError = false;
  @state() private blogData: Blog | null = null;
  private readonly mainSlotConfig: RenderSlotConfig = getPageSlotConfig('social', 'main_stream');
  /** SOC-019: Bypass cached follow graph on next fetch after mismatch */
  private skipCacheOnNextFetch = false;

  private followersPaginationKey = '';
  private followingPaginationKey = '';
  private lastFollowersPageFingerprint: string | null = null;
  private lastFollowingPageFingerprint: string | null = null;
  private seenFollowersCursors = new Set<string>();
  private seenFollowingCursors = new Set<string>();
  private followersPageAttempts = 0;
  private followingPageAttempts = 0;
  private readonly maxPageAttempts = 32;

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
    if (this.followersPaginationKey && this.followers.length > 0) {
      setCachedPaginationCursor(
        this.followersPaginationKey,
        this.followersCursor,
        window.scrollY,
        this.followers.length,
        this.followersExhausted
      );
    }
    if (this.followingPaginationKey && this.following.length > 0) {
      setCachedPaginationCursor(
        this.followingPaginationKey,
        this.followingCursor,
        window.scrollY,
        this.following.length,
        this.followingExhausted
      );
    }
  };

  private async loadFromUrl(): Promise<void> {
    this.lastFollowersPageFingerprint = null;
    this.lastFollowingPageFingerprint = null;
    this.seenFollowersCursors.clear();
    this.seenFollowingCursors.clear();
    this.followersPageAttempts = 0;
    this.followingPageAttempts = 0;
    const pathTab = window.location.pathname.split('/').filter(Boolean)[2] as Tab | undefined;
    const tab = pathTab || (getUrlParam('tab') as Tab) || this.initialTab;
    this.sortValue = getUrlParam('sort') || getSocialSortPreference() || 'default';
    this.sortValue = normalizeSocialSortValue(this.sortValue);
    if (tab === 'followers' || tab === 'following' || tab === 'siblings') {
      this.activeTab = tab;
    }

    if (!this.blog) {
      this.errorMessage = ErrorMessages.VALIDATION.NO_BLOG_SPECIFIED;
      return;
    }
    this.infiniteScroll = getInfiniteScrollPreference('social');

    try {
      this.statusMessage = 'Resolving blog...';
      this.blogData = await initBlogTheme(this.blog);
      const blogId = await apiClient.identity.resolveNameToId(this.blog);

      if (!blogId) {
        this.errorMessage = ErrorMessages.BLOG.notFound(this.blog);
        this.statusMessage = '';
        return;
      }

      this.blogId = blogId;
      this.statusMessage = '';
      await this.loadData();
    } catch (e) {
      this.errorMessage = getContextualErrorMessage(e, 'resolve_blog', { blogName: this.blog });
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
      this.statusMessage = '';
    }
  }

  private observeSentinel(): void {
    requestAnimationFrame(() => {
      const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
      if (sentinel) {
        scrollObserver.observe(sentinel, () => {
          if (this.infiniteScroll && !this.loading && !this.isExhausted && this.blogId) {
            this.loadMore();
          }
        });
      }
    });
  }

  private get isExhausted(): boolean {
    if (this.rootMode) return true;
    if (this.activeTab === 'followers') return this.followersExhausted;
    if (this.activeTab === 'following') return this.followingExhausted;
    return true;
  }

  private get currentList(): FollowEdge[] {
    return this.activeTab === 'followers'
      ? this.followers
      : this.activeTab === 'following'
      ? this.following
      : this.siblings;
  }

  private async loadData(): Promise<void> {
    if (!this.blogId) return;
    if (this.rootMode) {
      this.activeTab = 'recommended';
      try {
        await this.loadRecommendedBlogs();
      } catch {
        this.recommendedBlogs = [];
      }
      return;
    }
    const normalizedBlog = (this.blog || 'you').trim() || 'you';
    const targetPath = `/social/${encodeURIComponent(normalizedBlog)}/${this.activeTab}`;
    const url = new URL(window.location.href);
    if (url.pathname !== targetPath || url.search) {
      url.pathname = targetPath;
      url.search = '';
      window.history.replaceState({}, '', url.toString());
    }

    this.followersPaginationKey = generatePaginationCursorKey('social-followers', {
      blog: this.blog,
    });
    this.followingPaginationKey = generatePaginationCursorKey('social-following', {
      blog: this.blog,
    });

    if (this.activeTab !== 'siblings') {
      const activeKey = this.activeTab === 'followers'
        ? this.followersPaginationKey
        : this.followingPaginationKey;
      const cachedState = getCachedPaginationCursor(activeKey);
      if (cachedState && cachedState.itemCount > 0) {
        if (this.activeTab === 'followers') {
          this.followersCursor = cachedState.cursor;
          this.followersExhausted = cachedState.exhausted;
        } else {
          this.followingCursor = cachedState.cursor;
          this.followingExhausted = cachedState.exhausted;
        }
        const scrollTarget = cachedState.scrollPosition;
        requestAnimationFrame(() => {
          setTimeout(() => {
            window.scrollTo({ top: scrollTarget, behavior: 'auto' });
          }, 100);
        });
      }
    }

    try {
      await Promise.all([this.fetchPage(), this.loadRecommendedBlogs()]);
    } catch (e) {
      const operation = this.activeTab === 'followers' ? 'load_followers' : 'load_following';
      this.errorMessage = getContextualErrorMessage(e, operation, { blogName: this.blog });
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
    }

    this.observeSentinel();
  }

  private async fetchPage(): Promise<void> {
    if (!this.blogId) return;

    this.loading = true;

    try {
      if (this.activeTab === 'siblings') {
        await this.fetchSiblingBlogs();
        return;
      }
      const direction = this.activeTab === 'followers' ? 'followers' : 'following';
      const cursor = this.activeTab === 'followers' ? this.followersCursor : this.followingCursor;
      const cursorKey = cursor || '__first_page__';

      if (this.activeTab === 'followers') {
        if (this.seenFollowersCursors.has(cursorKey)) {
          this.followersExhausted = true;
          return;
        }
        if (this.followersPageAttempts >= this.maxPageAttempts) {
          this.followersExhausted = true;
          return;
        }
        this.seenFollowersCursors.add(cursorKey);
        this.followersPageAttempts += 1;
      } else {
        if (this.seenFollowingCursors.has(cursorKey)) {
          this.followingExhausted = true;
          return;
        }
        if (this.followingPageAttempts >= this.maxPageAttempts) {
          this.followingExhausted = true;
          return;
        }
        this.seenFollowingCursors.add(cursorKey);
        this.followingPageAttempts += 1;
      }

      const shouldSkipCache = this.skipCacheOnNextFetch;
      this.skipCacheOnNextFetch = false;

      const resp = await apiClient.followGraph.getCached({
        blog_id: this.blogId,
        direction: direction === 'followers' ? 2 : 1,
        page_size: PAGE_SIZE,
        page_token: cursor || undefined,
        sortValue: this.sortValue,
      }, { skipCache: shouldSkipCache });

      const rawResp = resp as unknown as Record<string, unknown>;
      const followersCountFromApi = (resp.followersCount ?? rawResp['followers_count'] ?? 0) as number;
      const followingCountFromApi = (resp.followingCount ?? rawResp['following_count'] ?? 0) as number;
      const nextPageTokenFromApi = (resp.nextPageToken ?? rawResp['next_page_token'] ?? null) as string | null;

      if (followersCountFromApi > 0) {
        this.followersCount = followersCountFromApi;
      }
      if (followingCountFromApi > 0) {
        this.followingCount = followingCountFromApi;
      }

      if (this.activeTab === 'followers') {
        const items = resp.followers || [];
        const hydratedItems = await this.attachRecentPostsToEdges(items);
        const pageFingerprint = fingerprintFollowEdges(items);
        const repeatedPage = !!cursor && this.lastFollowersPageFingerprint === pageFingerprint;
        const newlyAddedCount = countNewFollowEdges(this.followers, hydratedItems);
        this.followers = mergeFollowEdges(this.followers, hydratedItems);
        this.lastFollowersPageFingerprint = pageFingerprint;
        const shouldStop = shouldStopFollowPagination({
          previousCursor: cursor,
          nextCursor: nextPageTokenFromApi,
          incomingCount: items.length,
          newlyAddedCount,
          repeatedPage,
          totalCount: this.followersCount,
          loadedCount: this.followers.length,
        });
        this.followersCursor = shouldStop ? null : nextPageTokenFromApi;
        if (this.followersCount > 0) {
          const expectedPages = Math.ceil(this.followersCount / PAGE_SIZE) + 1;
          if (this.followersPageAttempts >= expectedPages) {
            this.followersCursor = null;
            this.followersExhausted = true;
          }
        }

        if (this.followersCount === 0 && this.followers.length > 0) {
          this.followersCount = this.followers.length;
        }

        if (!cursor && this.followersCount > 0 && items.length === 0) {
          this.errorMessage = ErrorMessages.DATA.followDataMismatch(
            this.blog,
            'followers',
            this.followersCount
          );
          this.isRetryableError = true;
          this.skipCacheOnNextFetch = true;
          apiClient.followGraph.invalidateCache(this.blogId);
          return;
        }

        if (shouldStop) {
          this.followersExhausted = true;
        }
      } else {
        const items = resp.following || [];
        const hydratedItems = await this.attachRecentPostsToEdges(items);
        const pageFingerprint = fingerprintFollowEdges(items);
        const repeatedPage = !!cursor && this.lastFollowingPageFingerprint === pageFingerprint;
        const newlyAddedCount = countNewFollowEdges(this.following, hydratedItems);
        this.following = mergeFollowEdges(this.following, hydratedItems);
        this.lastFollowingPageFingerprint = pageFingerprint;
        const shouldStop = shouldStopFollowPagination({
          previousCursor: cursor,
          nextCursor: nextPageTokenFromApi,
          incomingCount: items.length,
          newlyAddedCount,
          repeatedPage,
          totalCount: this.followingCount,
          loadedCount: this.following.length,
        });
        this.followingCursor = shouldStop ? null : nextPageTokenFromApi;
        if (this.followingCount > 0) {
          const expectedPages = Math.ceil(this.followingCount / PAGE_SIZE) + 1;
          if (this.followingPageAttempts >= expectedPages) {
            this.followingCursor = null;
            this.followingExhausted = true;
          }
        }

        if (this.followingCount === 0 && this.following.length > 0) {
          this.followingCount = this.following.length;
        }

        if (!cursor && this.followingCount > 0 && items.length === 0) {
          this.errorMessage = ErrorMessages.DATA.followDataMismatch(
            this.blog,
            'following',
            this.followingCount
          );
          this.isRetryableError = true;
          this.skipCacheOnNextFetch = true;
          apiClient.followGraph.invalidateCache(this.blogId);
          return;
        }

        if (shouldStop) {
          this.followingExhausted = true;
        }
      }
    } catch (e) {
      const operation = this.activeTab === 'followers' ? 'load_followers' : 'load_following';
      this.errorMessage = getContextualErrorMessage(e, operation, { blogName: this.blog });
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
    } finally {
      this.loading = false;
    }
  }

  private async fetchSiblingBlogs(): Promise<void> {
    if (!this.blogId) return;
    const response = await apiClient.blogs.listFamily({ blog_id: this.blogId });
    const blogs = (response.blogs || []).filter((blog) => blog.id && blog.id !== this.blogId);
    const siblingEdges = blogs.map((blog) => ({
      blogId: blog.id,
      blogName: blog.name,
      userId: blog.ownerUserId,
      ownerUserId: blog.ownerUserId,
      title: blog.title,
      description: blog.description,
      avatarUrl: blog.avatarUrl,
      followersCount: blog.followersCount,
      postsCount: blog.postsCount,
      identityDecorations: blog.identityDecorations,
      createdAt: blog.createdAt,
    })) satisfies FollowEdge[];
    this.siblings = await this.attachRecentPostsToEdges(siblingEdges);
    this.siblingsCount = this.siblings.length;
  }

  private async loadRecommendedBlogs(): Promise<void> {
    if (!this.blog) {
      this.recommendedBlogs = [];
      return;
    }

    try {
      const response = await apiClient.blogs.listRecommended({ blog_name: this.blog, limit: 12 });
      const blogs = (response.blogs || []).filter((blog) => blog.id && blog.name);
      const edges = blogs.map((blog) => ({
        blogId: blog.id,
        blogName: blog.name,
        userId: blog.ownerUserId,
        ownerUserId: blog.ownerUserId,
        title: blog.title,
        description: blog.description,
        avatarUrl: blog.avatarUrl,
        followersCount: blog.followersCount,
        postsCount: blog.postsCount,
        identityDecorations: blog.identityDecorations,
        createdAt: blog.createdAt,
      })) satisfies FollowEdge[];
      this.recommendedBlogs = await this.attachRecentPostsToEdges(edges);
    } catch {
      this.recommendedBlogs = [];
    }
  }

  private async loadMore(): Promise<void> {
    if (this.loading || this.isExhausted) return;
    await this.fetchPage();
  }

  private async switchTab(tab: Tab): Promise<void> {
    const normalizedBlog = (this.blog || 'you').trim() || 'you';
    const primaryBlog = (getPrimaryBlogName() || '').trim().toLowerCase();
    const isPrimaryPerspective = !!primaryBlog && normalizedBlog.toLowerCase() === primaryBlog;
    if (tab === 'recommended') {
      window.location.href = isPrimaryPerspective ? '/social' : `/social/${encodeURIComponent(normalizedBlog)}`;
      return;
    }
    if (!this.rootMode && tab === this.activeTab) return;
    window.location.href = `/social/${encodeURIComponent(normalizedBlog)}/${tab}`;
  }

  private handleInfiniteToggle(e: CustomEvent): void {
    this.infiniteScroll = e.detail.enabled;
    if (this.infiniteScroll) {
      this.observeSentinel();
    }
  }

  private async handleSortChange(e: CustomEvent): Promise<void> {
    this.sortValue = normalizeSocialSortValue(e.detail.value);
    setSocialSortPreference(this.sortValue);
    if (this.rootMode) {
      this.requestUpdate();
      return;
    }
    this.followers = [];
    this.following = [];
    this.followersCursor = null;
    this.followingCursor = null;
    this.followersExhausted = false;
    this.followingExhausted = false;
    this.lastFollowersPageFingerprint = null;
    this.lastFollowingPageFingerprint = null;
    this.seenFollowersCursors.clear();
    this.seenFollowingCursors.clear();
    this.followersPageAttempts = 0;
    this.followingPageAttempts = 0;
    this.errorMessage = '';
    this.statusMessage = '';
    await this.fetchPage();
    this.requestUpdate();
  }

  private async attachRecentPostsToEdges(items: FollowEdge[]): Promise<FollowEdge[]> {
    const ids = [...new Set(items.map((item) => item.blogId).filter((value): value is number => typeof value === 'number' && value > 0))];
    if (!ids.length) {
      return items;
    }
    const response = await apiClient.recentActivity.listCached({
      blog_ids: ids,
      global_merge: false,
      page_size: ids.length,
      limit_per_blog: 3,
    });
    const latestByBlog = new Map<number, number>();
    for (const item of response.items || []) {
      if (typeof item.blogId === 'number') {
        latestByBlog.set(item.blogId, item.latestCreatedAtUnix || 0);
      }
    }
    const postsByBlog = new Map<number, ProcessedPost[]>();
    for (const post of response.posts || []) {
      if (!post.blogId) continue;
      const current = postsByBlog.get(post.blogId) || [];
      if (current.length >= 3) continue;
      current.push({
        ...post,
        _media: extractMedia(post as Post),
      } as ProcessedPost);
      postsByBlog.set(post.blogId, current);
    }
    return items.map((item) => ({
      ...item,
      recentPosts: postsByBlog.get(item.blogId) || item.recentPosts || [],
      latestPostCreatedAtUnix: latestByBlog.get(item.blogId) || item.latestPostCreatedAtUnix || 0,
    }));
  }

  private async handleRetry(e?: CustomEvent): Promise<void> {
    const isAutoRetry = e?.detail?.isAutoRetry ?? false;
    this.retrying = true;
    this.errorMessage = '';
    this.isRetryableError = false;

    try {
      if (!this.blogId) {
        await this.loadFromUrl();
      } else if (this.rootMode) {
        await this.loadRecommendedBlogs();
      } else {
        await this.fetchPage();
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
    const showControlPanel = !this.rootMode;
    const showList = !this.rootMode && this.currentList.length > 0;
    const showEmptyList = !this.rootMode && this.blogId && !this.loading && !this.errorMessage;
    const primaryBlog = (getPrimaryBlogName() || '').trim().toLowerCase();
    const normalizedBlog = (this.blog || '').trim();
    const isPrimaryPerspective = !!primaryBlog && normalizedBlog.toLowerCase() === primaryBlog;
    const recommendedLabel = isPrimaryPerspective || !normalizedBlog ? 'For You' : `For @${normalizedBlog}`;

    return html`
      <div class="content">
        ${this.blog
          ? html`
              <blog-header
                page="social"
                .blogName=${this.blog}
                .blogTitle=${this.blogData?.title || ''}
                .blogDescription=${this.blogData?.description || ''}
                .avatarUrl=${this.blogData?.avatarUrl || ''}
                .identityDecorations=${this.blogData?.identityDecorations || []}
              ></blog-header>
            `
          : ''}

        ${this.blogId
          ? html`
              <div class="tabs">
                <button
                  class="tab ${this.rootMode ? 'active' : ''}"
                  @click=${() => this.switchTab('recommended')}
                >
                  ${recommendedLabel}
                </button>
                <button
                  class="tab ${this.activeTab === 'followers' ? 'active' : ''}"
                  @click=${() => this.switchTab('followers')}
                >
                  Followers ${this.followersCount > 0 ? `(${this.followersCount})` : this.followers.length > 0 ? `(${this.followers.length})` : ''}
                </button>
                <button
                  class="tab ${this.activeTab === 'following' ? 'active' : ''}"
                  @click=${() => this.switchTab('following')}
                >
                  Following ${this.followingCount > 0 ? `(${this.followingCount})` : this.following.length > 0 ? `(${this.following.length})` : ''}
                </button>
                <button
                  class="tab ${this.activeTab === 'siblings' ? 'active' : ''}"
                  @click=${() => this.switchTab('siblings')}
                >
                  Sibling Blogs ${this.siblingsCount > 0 ? `(${this.siblingsCount})` : ''}
                </button>
              </div>
            `
          : ''}

        ${this.statusMessage && !this.errorMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}

        ${showControlPanel
          ? html`
              <control-panel
                .pageName=${'social'}
                .sortValue=${this.sortValue}
                .sortOptions=${SOCIAL_SORT_OPTIONS}
                .showSort=${true}
                .showInfiniteScroll=${true}
                .infiniteScroll=${this.infiniteScroll}
                .settingsHref=${'/settings/you#social'}
                @sort-change=${this.handleSortChange}
                @infinite-toggle=${this.handleInfiniteToggle}
              ></control-panel>
            `
          : ''}

        ${this.recommendedBlogs.length > 0
          ? html`
              <div class="section-heading">Blogs you may like</div>
              <div class="list-container">
                <blog-list .items=${this.recommendedBlogs}></blog-list>
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

        ${showList
          ? html`
              <div class="list-container">
        <blog-list
          .items=${this.currentList}
        ></blog-list>
              </div>

              <load-footer
                mode="list"
                pageName="social"
                .totalCount=${this.currentList.length}
                .loading=${this.loading}
                .exhausted=${this.isExhausted}
                .infiniteScroll=${this.infiniteScroll}
                @load-more=${() => this.loadMore()}
              ></load-footer>
            `
          : showEmptyList
          ? html`<div class="status">No ${this.activeTab} found</div>`
          : ''}

        ${this.rootMode && !this.loading && this.recommendedBlogs.length === 0 && !this.errorMessage
          ? html`<div class="status">No blog recommendations available yet</div>`
          : ''}

        ${this.loading && (this.rootMode ? this.recommendedBlogs.length === 0 : this.currentList.length === 0)
          ? html`
              <render-card
                cardType=${this.mainSlotConfig.loading?.cardType || ''}
                count=${this.mainSlotConfig.loading?.count}
                loading
              ></render-card>
            `
          : ''}

        <div id="scroll-sentinel" style="height:1px;"></div>
      </div>
    `;
  }
}
