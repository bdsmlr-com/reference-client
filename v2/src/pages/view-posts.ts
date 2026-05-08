import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, ErrorMessages } from '../services/api-error.js';
import { getUrlParam, setUrlParams } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import { extractMedia, SORT_OPTIONS, type ProcessedPost } from '../types/post.js';
import type { PostType, Blog, TimelineItem, PostSortField, Order } from '../types/api.js';
import {
  type ActivityKind,
} from '../services/profile.js';
import {
  getTimelineRouteDefinition,
  readTimelineRouteQueryState,
  buildTimelineRouteQueryParams,
  shouldLoadMoreTimeline,
} from '../services/timeline-route-controller.js';
import { getPageSlotConfig } from '../services/render-page.js';
import type { RenderSlotConfig } from '../config.js';
import { ALL_POST_TYPES } from '../services/post-filter-url.js';
import { getInfiniteScrollPreference } from '../services/storage.js';
import '../components/control-panel.js';
import '../components/timeline-stream.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/error-state.js';
import '../components/blog-header.js';
import '../components/render-card.js';

const PAGE_SIZE = 15;

@customElement('view-posts')
export class ViewPosts extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host { display: block; min-height: 100vh; background: var(--blog-bg, var(--bg-primary)); }
      .content { padding: 20px 0; }
      .feed-container { margin-bottom: 20px; }
      .status { text-align: center; color: var(--text-muted); padding: 40px 16px; }
    `,
  ];

  @property({ type: String }) blog = '';

  @state() private blogId: number | null = null;
  @state() private sortValue = 'newest';
  @state() private selectedTypes: PostType[] = [...ALL_POST_TYPES];
  @state() private timelineItems: TimelineItem[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private infiniteScroll = getInfiniteScrollPreference('timeline');
  @state() private errorMessage = '';
  @state() private statusMessage = '';
  @state() private activityKinds: ActivityKind[] = getTimelineRouteDefinition('activity').readStoredActivityKinds();
  @state() private blogData: Blog | null = null;
  private readonly mainSlotConfig: RenderSlotConfig = getPageSlotConfig('activity', 'main_stream');
  private readonly timelineRoute = getTimelineRouteDefinition('activity');

  private backendCursor: string | null = null;
  private seenIds = new Set<number>();
  private activeRequestToken = 0;

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('blog')) {
      this.loadFromUrl();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
    if (sentinel) scrollObserver.unobserve(sentinel);
    clearBlogTheme();
  }

  private async loadFromUrl(): Promise<void> {
    this.resetState();
    if (!this.blog) return;
    try {
      this.blogData = await initBlogTheme(this.blog);
      const blogId = await apiClient.identity.resolveNameToId(this.blog);
      if (!blogId) { this.errorMessage = `Blog @${this.blog} not found`; return; }
      this.blogId = blogId;
      await this.loadPosts();
    } catch (e) {
      this.errorMessage = getContextualErrorMessage(e, 'resolve_blog');
    }
  }

  private async loadPosts(): Promise<void> {
    if (!this.blogId) return;
    this.resetState();
    const requestToken = ++this.activeRequestToken;
    this.sortValue = 'newest';
    const queryState = readTimelineRouteQueryState('activity', {
      types: getUrlParam('types'),
      activity: getUrlParam('activity'),
    });
    this.selectedTypes = queryState.selectedTypes;
    this.activityKinds = queryState.activityKinds;
    this.infiniteScroll = getInfiniteScrollPreference(this.timelineRoute.footerPageName);
    this.statusMessage = '';

    if (this.selectedTypes.length === 0) {
      this.statusMessage = ErrorMessages.VALIDATION.NO_TYPES_SELECTED;
      this.exhausted = true;
      return;
    }

    setUrlParams({
      sort: '',
      blog: '',
      ...buildTimelineRouteQueryParams(queryState),
    });
    await this.fillPage(requestToken);
    if (requestToken !== this.activeRequestToken) return;
    this.observeSentinel();
  }

  private resetState() {
    this.timelineItems = [];
    this.seenIds.clear();
    this.backendCursor = null;
    this.exhausted = false;
    this.errorMessage = '';
    this.statusMessage = '';
  }

  private observeSentinel(): void {
    requestAnimationFrame(() => {
      const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
      if (sentinel) {
        scrollObserver.observe(sentinel, () => {
          if (shouldLoadMoreTimeline({
            infiniteScroll: this.infiniteScroll,
            loading: this.loading,
            exhausted: this.exhausted,
          })) this.loadMore();
        });
      }
    });
  }

  private async fillPage(requestToken: number = this.activeRequestToken): Promise<void> {
    if (!this.blogId || this.loading) return;
    this.loading = true;
    try {
      const sortOption = SORT_OPTIONS.find((o) => o.value === this.sortValue) || SORT_OPTIONS[0];
      const resp = await apiClient.posts.list({
        blog_id: this.blogId,
        sort_field: sortOption.field as PostSortField,
        order: sortOption.order as Order,
        post_types: this.selectedTypes,
        activity_kinds: this.activityKinds,
        page: { page_size: PAGE_SIZE, page_token: this.backendCursor || undefined }
      });
      if (requestToken !== this.activeRequestToken) return;

      this.backendCursor = resp.page?.nextPageToken || null;
      if (!this.backendCursor) this.exhausted = true;

      // DUMB FRONTEND: Just append the pre-processed timeline items
      const newItems = (resp.timelineItems || []).map(item => {
        if (item.type === 1 && item.post) { // ITEM_TYPE_POST
          const p = item.post as ProcessedPost;
          p._media = extractMedia(p);
        } else if (item.type === 2 && item.cluster) { // ITEM_TYPE_CLUSTER
          item.cluster.interactions?.forEach(post => {
            const p = post as ProcessedPost;
            p._media = extractMedia(p);
          });
        }
        return item;
      });

      this.timelineItems = [...this.timelineItems, ...newItems];
      if (newItems.length === 0) this.exhausted = true;
      if (this.timelineItems.length === 0 && this.exhausted) {
        this.statusMessage = 'No posts found';
      }
    } finally {
      if (requestToken === this.activeRequestToken) {
        this.loading = false;
      }
    }
  }

  private async loadMore() {
    if (this.loading || this.exhausted) return;
    await this.fillPage(this.activeRequestToken);
  }

  private handlePostClick(e: CustomEvent) {
    e.stopPropagation();
    const post = e.detail.post as ProcessedPost;
    const from = e.detail?.from || 'activity';
    
    // Extract all posts from the timeline for explicit post navigation context
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
      detail: { post, posts: allPosts, index: index >= 0 ? index : 0, from },
      bubbles: true,
      composed: true
    }));
  }

  private handleInfiniteToggle(e: CustomEvent) {
    this.infiniteScroll = e.detail.enabled;
    if (this.infiniteScroll) this.observeSentinel();
  }

  private handleActivityKindsChange(e: CustomEvent): void {
    this.activityKinds = readTimelineRouteQueryState('activity', {
      types: null,
      activity: (e.detail.kinds || []).join(','),
    }).activityKinds;
    this.sortValue = 'newest';
    this.timelineRoute.writeStoredActivityKinds(this.activityKinds);
    setUrlParams({
      sort: '',
      blog: '',
      ...buildTimelineRouteQueryParams({
        selectedTypes: this.selectedTypes,
        activityKinds: this.activityKinds,
      }),
    });
    this.loadPosts();
  }

  private handleTypesChange(e: CustomEvent): void {
    this.selectedTypes = e.detail.types || [];
    setUrlParams({
      sort: '',
      blog: '',
      ...buildTimelineRouteQueryParams({
        selectedTypes: this.selectedTypes,
        activityKinds: this.activityKinds,
      }),
    });
    this.loadPosts();
  }

  render() {
    return html`
      <div class="content">
        <blog-header
          page="activity"
          .blogName=${this.blog}
          .blogTitle=${this.blogData?.title || ''}
          .blogDescription=${this.blogData?.description || ''}
          .avatarUrl=${this.blogData?.avatarUrl || ''}
          .identityDecorations=${this.blogData?.identityDecorations || []}
        ></blog-header>

        <control-panel
          .showActivityKinds=${true}
          .showTypes=${true}
          .showInfiniteScroll=${true}
          .activityKinds=${this.activityKinds}
          .selectedTypes=${this.selectedTypes}
          .infiniteScroll=${this.infiniteScroll}
          .pageName=${this.timelineRoute.controlPageName}
          .settingsHref=${'/settings/you#activity'}
          @activity-kinds-change=${this.handleActivityKindsChange}
          @types-change=${this.handleTypesChange}
          @infinite-toggle=${this.handleInfiniteToggle}
        ></control-panel>

        ${this.errorMessage ? html`<error-state message=${this.errorMessage}></error-state>` : ''}
        ${this.statusMessage && !this.errorMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}
        ${this.loading && this.timelineItems.length === 0 && !this.errorMessage
          ? html`
              <render-card
                cardType=${this.mainSlotConfig.loading?.cardType || ''}
                count=${this.mainSlotConfig.loading?.count}
                loading
              ></render-card>
            `
          : ''}

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
          .infiniteScroll=${this.infiniteScroll}
          @load-more=${() => this.loadMore()}
        ></load-footer>

        <div id="scroll-sentinel" style="height:1px;"></div>
      </div>
    `;
  }
}
