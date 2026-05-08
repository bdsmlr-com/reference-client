import { LitElement, html, css, unsafeCSS, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, ErrorMessages, isApiError, toApiError } from '../services/api-error.js';
import { getUrlParam, setUrlParams, isBlogInPath, isAdminMode } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import type { PostType, PostVariant, Blog, TimelineItem } from '../types/api.js';
import {
  type ActivityKind,
} from '../services/profile.js';
import {
  buildTimelineRouteQueryParams,
  getTimelineRouteDefinition,
  readTimelineRouteQueryState,
  shouldLoadMoreTimeline,
} from '../services/timeline-route-controller.js';
import { getPageSlotConfig } from '../services/render-page.js';
import type { RenderSlotConfig } from '../config.js';
import { BREAKPOINTS } from '../types/ui-constants.js';
import { resolveLink } from '../services/link-resolver.js';
import { toPresentationModel } from '../services/post-presentation.js';
import { ALL_POST_TYPES } from '../services/post-filter-url.js';
import { buildPageUrl } from '../services/blog-resolver.js';
import { getInfiniteScrollPreference } from '../services/storage.js';
import '../components/control-panel.js';
import '../components/blog-header.js';
import '../components/route-shell-card.js';
import '../components/timeline-stream.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/error-state.js';
import '../components/render-card.js';

const PAGE_SIZE = 20;
const MAX_BACKEND_FETCHES = 3;
const MAX_CLUSTER_FETCH_BLOGS = 6;

@customElement('view-feed')
export class ViewFeed extends LitElement {
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

      .feed-container {
        margin-bottom: 20px;
      }

      .feed-summary {
        text-align: center;
        color: var(--text-muted);
        font-size: 13px;
      }

      .feed-summary a {
        color: var(--accent);
        text-decoration: none;
      }

      .feed-summary a:hover {
        text-decoration: underline;
      }

      .feed-summary strong {
        color: var(--text-primary);
        font-weight: 600;
      }

      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {}
    `,
  ];

  @property({ type: String }) blog = '';
  @property({ type: String }) mode: 'following' | 'followers' = 'following';

  @state() private blogNameInput = '';
  @state() private resolvedBlogName = '';
  @state() private sourceBlogIds: number[] = [];
  @state() private sourceCount = 0;
  @state() private resolving = false;
  @state() private selectedTypes: PostType[] = [...ALL_POST_TYPES];
  @state() private selectedVariants: PostVariant[] = [];
  @state() private timelineItems: TimelineItem[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private loadingCurrent = 0;
  @state() private infiniteScroll = getInfiniteScrollPreference('following');
  @state() private statusMessage = '';
  @state() private errorMessage = '';
  @state() private retrying = false;
  @state() private autoRetryAttempt = 0;
  @state() private isRetryableError = false;
  @state() private activityKinds: ActivityKind[] = getTimelineRouteDefinition('following').readStoredActivityKinds();
  @state() private blogData: Blog | null = null;
  private readonly mainSlotConfig: RenderSlotConfig = getPageSlotConfig('feed', 'main_stream');
  private skipCacheOnNextResolve = false;
  private emptySourceAttempts = 0;

  private backendCursor: string | null = null;
  private seenIds = new Set<number>();
  private seenUrls = new Set<string>();
  private seenClusterKeys = new Set<string>();
  private blogTimelineCursors = new Map<number, string | null>();

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('blog')) {
      if (this.blog) {
        this.blogNameInput = this.blog;
        this.resolveBlog();
      }
    }
  }

  private get isFollowerFeed(): boolean {
    return this.mode === 'followers';
  }

  private get relationshipDirection(): 1 | 2 {
    return this.isFollowerFeed ? 2 : 1;
  }

  private get relationshipLabel(): 'followers' | 'following' {
    return this.isFollowerFeed ? 'followers' : 'following';
  }
  private get relationshipLabelParticaple(): 'followers' | 'followed' {
    return this.isFollowerFeed ? 'followers' : 'followed';
  }

  private get relationshipSummarySuffix(): string {
    return this.isFollowerFeed ? 'of' : 'by';
  }

  private get emptyRelationshipStatus(): string {
    return this.isFollowerFeed
      ? ErrorMessages.STATUS.noFollowers(this.resolvedBlogName)
      : ErrorMessages.STATUS.notFollowingAnyone(this.resolvedBlogName);
  }

  private get relationshipLinkContext(): 'feed_following_list' | 'feed_followers_list' {
    return this.isFollowerFeed ? 'feed_followers_list' : 'feed_following_list';
  }

  private get timelineRoute() {
    return getTimelineRouteDefinition(this.isFollowerFeed ? 'followers' : 'following');
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
    // Relationship feeds currently use multi-source cursors; skip cursor persistence for now.
  };

  private observeSentinel(): void {
    requestAnimationFrame(() => {
      const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
      if (sentinel) {
        scrollObserver.observe(sentinel, () => {
          if (shouldLoadMoreTimeline({
            infiniteScroll: this.infiniteScroll,
            loading: this.loading,
            exhausted: this.exhausted,
            hasSourceData: this.sourceBlogIds.length > 0,
          })) {
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
    this.seenClusterKeys.clear();
    this.blogTimelineCursors.clear();
    this.timelineItems = [];
    this.statusMessage = '';
  }

  private async resolveBlog(): Promise<void> {
    const name = this.blogNameInput.trim().replace(/^@/, '');
    if (!name) {
      this.statusMessage = 'Please enter a blog name';
      return;
    }

    if (this.resolvedBlogName && this.resolvedBlogName !== name) {
      this.emptySourceAttempts = 0;
    }

    this.resolving = true;
    this.statusMessage = `Resolving @${name}...`;
    this.sourceBlogIds = [];
    this.sourceCount = 0;
    this.timelineItems = [];
    this.resetState();

    try {
      this.blogData = await initBlogTheme(name);
      const blogId = await apiClient.identity.resolveNameToId(name);

      if (!blogId) {
        this.statusMessage = `Blog "@${name}" not found`;
        this.resolving = false;
        return;
      }

      this.resolvedBlogName = name;

      if (!isBlogInPath()) {
        setUrlParams({ blog: name });
      }

      const shouldSkipCache = this.skipCacheOnNextResolve;
      this.skipCacheOnNextResolve = false;

      const followGraph = await apiClient.followGraph.getCached({
        blog_id: blogId,
        direction: this.relationshipDirection,
        page_size: 1000,
      }, { skipCache: shouldSkipCache });

      const sourceEdges = this.isFollowerFeed
        ? (followGraph.followers || [])
        : (followGraph.following || []);
      this.sourceBlogIds = sourceEdges
        .map((f) => (f as { blogId?: number; blog_id?: number }).blogId ?? (f as { blogId?: number; blog_id?: number }).blog_id)
        .filter((id): id is number => id !== undefined && id !== null);
      this.sourceCount = this.isFollowerFeed
        ? (followGraph.followersCount || this.sourceBlogIds.length)
        : (followGraph.followingCount || this.sourceBlogIds.length);

      if (this.sourceBlogIds.length === 0) {
        this.timelineItems = [];
        this.resetState();
        if (sourceEdges.length === 0 && this.sourceCount === 0) {
          if (this.emptySourceAttempts === 0) {
            this.statusMessage = '';
            this.errorMessage = ErrorMessages.DATA.followDataEmptyRetryable(name, this.relationshipLabel);
            this.isRetryableError = true;
            this.skipCacheOnNextResolve = true;
            this.emptySourceAttempts++;
            this.resolving = false;
            return;
          }

          this.statusMessage = this.emptyRelationshipStatus;
          if (followGraph.fromCache) {
            this.skipCacheOnNextResolve = true;
          }

          this.statusMessage = this.emptyRelationshipStatus;
        } else {
          // FOL-008: API returned count but no usable blogIds - likely cached transient error
          // Invalidate the cache so retry can fetch fresh data
          console.warn(`FOL-008: Data mismatch for @${name} - invalidating follow graph cache`);
          apiClient.followGraph.invalidateCache(blogId);
          this.statusMessage = '';
          this.errorMessage = ErrorMessages.DATA.followDataMismatch(name, this.relationshipLabel, this.sourceCount);
          this.isRetryableError = true;
          this.skipCacheOnNextResolve = true;
        }
        this.resolving = false;
        return;
      }

      this.statusMessage = '';
      this.resolving = false;
      this.emptySourceAttempts = 0;

      await this.loadPosts();
    } catch (e) {
      this.errorMessage = getContextualErrorMessage(
        e,
        this.isFollowerFeed ? 'load_followers' : 'load_following',
        { blogName: this.blogNameInput }
      );
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
      this.skipCacheOnNextResolve = true;
      this.statusMessage = '';
      this.resolving = false;
    }
  }

  private async handleRetry(e?: CustomEvent): Promise<void> {
    const isAutoRetry = e?.detail?.isAutoRetry ?? false;
    this.retrying = true;
    this.errorMessage = '';
    this.isRetryableError = false;
    this.statusMessage = '';

    try {
      await this.resolveBlog();
      this.autoRetryAttempt = 0;
    } catch {
      if (isAutoRetry && this.isRetryableError) {
        this.autoRetryAttempt++;
      }
    }
    this.retrying = false;
  }

  private async loadPosts(): Promise<void> {
    if (this.sourceBlogIds.length === 0) return;
    const queryState = readTimelineRouteQueryState(this.isFollowerFeed ? 'followers' : 'following', {
      types: getUrlParam('types'),
      activity: getUrlParam('activity'),
    });
    this.selectedTypes = queryState.selectedTypes;
    this.activityKinds = queryState.activityKinds;
    this.infiniteScroll = getInfiniteScrollPreference(this.timelineRoute.footerPageName);
    setUrlParams(buildTimelineRouteQueryParams(queryState));

    if (this.selectedTypes.length === 0) {
      this.statusMessage = ErrorMessages.VALIDATION.NO_TYPES_SELECTED;
      this.exhausted = true;
      return;
    }

    this.resetState();

    try {
      await this.fillPage();
    } catch (e) {
      this.errorMessage = getContextualErrorMessage(e, 'load_posts', { blogName: this.blogNameInput });
      const apiError = isApiError(e) ? e : toApiError(e);
      this.isRetryableError = apiError.isRetryable;
    }

    this.observeSentinel();
  }

  private async fillPage(): Promise<void> {
    if (this.sourceBlogIds.length === 0) return;

    const postBuffer: ProcessedPost[] = [];
    let backendFetches = 0;
    this.loading = true;
    this.loadingCurrent = 0;

    const isAdmin = isAdminMode();

    try {
      while (postBuffer.length < PAGE_SIZE && !this.exhausted && backendFetches < MAX_BACKEND_FETCHES) {
        backendFetches++;

        // Use server-side merge with globalMerge=true
        // FOL-009: Per API spec, pass sort_field: 0 (UNSPECIFIED) and limit_per_blog: 0 for merged FYP behavior
        // FOL-010: Use order: 2 for DESC (0=UNSPECIFIED, 1=ASC, 2=DESC)
        const resp = await apiClient.recentActivity.listCached({
          blog_ids: this.sourceBlogIds,
          post_types: this.selectedTypes,
          variants: this.selectedVariants.length > 0 ? this.selectedVariants : undefined,
          global_merge: true,
          page: {
            page_size: 48, // Increase batch size to find content faster
            page_token: this.backendCursor || undefined,
          },
          sort_field: 0,
          order: 2,
          limit_per_blog: 0,
        });

        const posts = resp.posts || [];
        this.backendCursor = resp.page?.nextPageToken || null;

        if (!this.backendCursor || posts.length === 0) {
          this.exhausted = true;
        }

        for (const post of posts) {
          // Never show the same exact Post ID twice
          if (this.seenIds.has(post.id)) {
            continue;
          }

          const media = extractMedia(post);
          const mediaUrl = media.videoUrl || media.audioUrl || media.url;

          // Smart Deduplication: 
          // 1. Regular users: hide identical images.
          // 2. Admins: show identical images FROM DIFFERENT BLOGS, but hide duplicate Post IDs.
          if (mediaUrl) {
            const normalizedUrl = mediaUrl.split('?')[0];
            const isImageDupe = this.seenUrls.has(normalizedUrl);
            
            if (isImageDupe && !isAdmin) {
              this.seenIds.add(post.id);
              continue;
            }
            this.seenUrls.add(normalizedUrl);
          }

          this.seenIds.add(post.id);
          if (post.deletedAtUnix && !isAdmin) continue;

          const processedPost: ProcessedPost = {
            ...post,
            _media: media,
          };

          postBuffer.push(processedPost);
          this.loadingCurrent = postBuffer.length;

          if (postBuffer.length >= PAGE_SIZE) break;
        }

        if (postBuffer.length >= PAGE_SIZE) break;
      }

      const feedItems: TimelineItem[] = postBuffer.map((post) => ({ type: 1, post }));
      const activeBlogIds = [...new Set(postBuffer.map((p) => p.blogId).filter((id): id is number => Boolean(id)))];
      const clusterItems = await this.fetchInteractionClusters(activeBlogIds.slice(0, MAX_CLUSTER_FETCH_BLOGS));
      const merged = [...feedItems, ...clusterItems].sort((a, b) => this.itemTimestamp(b) - this.itemTimestamp(a));

      if (merged.length > 0) {
        this.timelineItems = [...this.timelineItems, ...merged];
      } else if (this.timelineItems.length === 0 && this.exhausted) {
        this.statusMessage = 'No posts found';
      }
    } finally {
      this.loading = false;
    }
  }

  private itemTimestamp(item: TimelineItem): number {
    if (item.type === 1 && item.post) {
      const post = item.post as ProcessedPost;
      return post._activityCreatedAtUnix || post.createdAtUnix || 0;
    }
    if (item.type === 2 && item.cluster?.interactions?.length) {
      return Math.max(...item.cluster.interactions.map((p) => p.createdAtUnix || 0));
    }
    return 0;
  }

  private inferClusterKind(item: TimelineItem): ActivityKind {
    const label = (item.cluster?.label || '').toLowerCase();
    if (label.includes('comment')) return 'comment';
    if (label.includes('reblog')) return 'reblog';
    return 'like';
  }

  private async fetchInteractionClusters(blogIds: number[]): Promise<TimelineItem[]> {
    if (blogIds.length === 0) return [];
    const isAdmin = isAdminMode();
    const clusters: TimelineItem[] = [];
    const selfInteractionPosts = new Map<number, ProcessedPost>();

    await Promise.all(
      blogIds.map(async (blogId) => {
        const pageToken = this.blogTimelineCursors.get(blogId) || undefined;
        const resp = await apiClient.posts.list({
          blog_id: blogId,
          sort_field: 1,
          order: 2,
          post_types: this.selectedTypes,
          variants: this.selectedVariants.length > 0 ? this.selectedVariants : undefined,
          activity_kinds: ['like', 'comment'],
          page: { page_size: 12, page_token: pageToken },
        });

        this.blogTimelineCursors.set(blogId, resp.page?.nextPageToken || null);

        (resp.timelineItems || []).forEach((item) => {
          if (item.type !== 2 || !item.cluster?.interactions?.length) return;
          const kind = this.inferClusterKind(item);
          if (kind !== 'like' && kind !== 'comment') return;
          if (!this.activityKinds.includes(kind)) return;
          const key = item.cluster.interactions.map((p) => p.id).sort((a, b) => a - b).join(',');
          if (!key || this.seenClusterKeys.has(key)) return;

          const interactions: ProcessedPost[] = [];
          item.cluster.interactions.forEach((post) => {
            const media = extractMedia(post);
            const processedPost: ProcessedPost = {
              ...post,
              _media: media,
            };
            const presentation = toPresentationModel(processedPost, { surface: 'card', page: 'activity', interactionKind: kind, role: 'cluster' });
            const isCanonicalPostCard = presentation.identity.isCanonicalCard;
            if ((kind === 'like' || kind === 'comment') && post.blogId === blogId && isCanonicalPostCard) {
              if (this.seenIds.has(post.id)) return;
              const promoted: ProcessedPost = {
                ...processedPost,
                _activityCreatedAtUnix: post.updatedAtUnix || post.createdAtUnix,
                _activityKindOverride: kind,
              };
              this.seenIds.add(post.id);
              selfInteractionPosts.set(post.id, promoted);
              return;
            }
            if (this.seenIds.has(post.id)) return;
            const mediaUrl = media.videoUrl || media.audioUrl || media.url;
            if (mediaUrl) {
              const normalizedUrl = mediaUrl.split('?')[0];
              if (this.seenUrls.has(normalizedUrl) && !isAdmin) return;
              this.seenUrls.add(normalizedUrl);
            }
            this.seenIds.add(post.id);
            interactions.push(processedPost);
          });

          if (interactions.length === 0) return;

          this.seenClusterKeys.add(key);

          clusters.push({
            type: 2,
            cluster: {
              label: item.cluster.label || (kind === 'comment' ? 'Comments' : 'Likes'),
              interactions,
            },
          });
        });
      })
    );

    selfInteractionPosts.forEach((post) => clusters.push({ type: 1, post }));
    return clusters;
  }

  private async loadMore(): Promise<void> {
    if (this.loading || this.exhausted) return;
    await this.fillPage();
  }

  private handlePostClick(e: CustomEvent): void {
    e.stopPropagation();
    const post = e.detail.post as ProcessedPost;
    const from = e.detail?.from || (this.isFollowerFeed ? 'follower-feed' : 'feed');
    this.dispatchEvent(new CustomEvent('post-click', {
      detail: e.detail?.posts
        ? { ...e.detail, from: e.detail?.from || from }
        : { post, posts: this.timelineItems.flatMap((it) => it.type === 1 && it.post ? [it.post as ProcessedPost] : ((it.cluster?.interactions as ProcessedPost[]) || [])), index: 0, from },
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

  private handleTypesChange(e: CustomEvent): void {
    this.selectedTypes = e.detail.types || [];
    setUrlParams(buildTimelineRouteQueryParams({
      selectedTypes: this.selectedTypes,
      activityKinds: this.activityKinds,
    }));
    if (this.sourceBlogIds.length > 0) {
      this.loadPosts();
    }
  }

  private handleActivityKindsChange(e: CustomEvent): void {
    this.activityKinds = readTimelineRouteQueryState(this.isFollowerFeed ? 'followers' : 'following', {
      types: null,
      activity: (e.detail.kinds || []).join(','),
    }).activityKinds;
    this.timelineRoute.writeStoredActivityKinds(this.activityKinds);
    setUrlParams(buildTimelineRouteQueryParams({
      selectedTypes: this.selectedTypes,
      activityKinds: this.activityKinds,
    }));
    if (this.sourceBlogIds.length > 0) {
      this.loadPosts();
    }
  }

  render() {
    return html`
      <div class="content">
        <blog-header
          .page=${this.isFollowerFeed ? 'follower-feed' : 'feed'}
          .blogName=${this.resolvedBlogName || this.blogNameInput.trim().replace(/^@/, '')}
          .blogTitle=${this.blogData?.title || ''}
          .blogDescription=${this.blogData?.description || ''}
          .avatarUrl=${this.blogData?.avatarUrl || ''}
          .identityDecorations=${this.blogData?.identityDecorations || []}
        ></blog-header>

        ${(() => {
          if (!this.resolvedBlogName || this.sourceCount <= 0) return '';
          const relationshipLink = resolveLink(this.relationshipLinkContext, { blog: this.resolvedBlogName });
          return html`
            <route-shell-card wide compact>
              <div class="feed-summary">
                Showing posts from
                <a href=${relationshipLink.href} target=${relationshipLink.target} rel=${relationshipLink.rel || ''}>
                  <strong>${this.sourceCount}</strong> ${this.relationshipLabelParticaple}
                </a>
                ${this.relationshipSummarySuffix}
                <a href=${buildPageUrl('social', this.resolvedBlogName)}>
                  <strong>@${this.resolvedBlogName}</strong>
                </a>
              </div>
              ${this.sourceBlogIds.length > 0
                ? html`
                    <control-panel
                      .framed=${false}
                      .showSort=${false}
                      .showWhen=${false}
                      .showActivityKinds=${true}
                      .showTypes=${true}
                      .showInfiniteScroll=${true}
                      .activityKinds=${this.activityKinds}
                      .selectedTypes=${this.selectedTypes}
                      .infiniteScroll=${this.infiniteScroll}
                      .pageName=${this.timelineRoute.controlPageName}
                      .settingsHref=${this.isFollowerFeed ? '/settings/you#followers-feed' : '/settings/you#feed'}
                      @activity-kinds-change=${this.handleActivityKindsChange}
                      @types-change=${this.handleTypesChange}
                      @infinite-toggle=${this.handleInfiniteToggle}
                    ></control-panel>
                  `
                : ''}
            </route-shell-card>
          `;
        })()}

        ${this.resolving && !this.errorMessage
          ? html`<loading-spinner message="Loading..." trackTime></loading-spinner>`
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

        ${this.statusMessage && !this.resolving ? html`<div class="status">${this.statusMessage}</div>` : ''}

        ${this.loading && this.timelineItems.length === 0 && !this.errorMessage && !this.resolving
          ? html`
              <render-card
                cardType=${this.mainSlotConfig.loading?.cardType || ''}
                count=${this.mainSlotConfig.loading?.count}
                loading
              ></render-card>
            `
          : ''}

        ${this.timelineItems.length > 0
          ? html`
              <div class="feed-container">
                <timeline-stream
                  .items=${this.timelineItems}
                  .page=${this.timelineRoute.streamPage}
                  .activityKinds=${this.activityKinds}
                  .showActorInCluster=${this.timelineRoute.showActorInCluster}
                  @post-click=${this.handlePostClick}
                ></timeline-stream>
              </div>

              <load-footer
                .mode=${this.timelineRoute.footerMode}
                .pageName=${this.timelineRoute.footerPageName}
                .loading=${this.loading}
                .exhausted=${this.exhausted}
                .loadingCurrent=${this.loadingCurrent}
                .loadingTarget=${PAGE_SIZE}
                .infiniteScroll=${this.infiniteScroll}
                @load-more=${() => this.loadMore()}
              ></load-footer>
            `
          : ''}

        <div id="scroll-sentinel" style="height:1px;"></div>
      </div>
    `;
  }
}
