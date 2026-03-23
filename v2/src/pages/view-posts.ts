import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage } from '../services/api-error.js';
import { getUrlParam, setUrlParams, isDefaultTypes, isBlogInPath } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import { extractMedia, normalizeSortValue, SORT_OPTIONS, type ProcessedPost } from '../types/post.js';
import type { PostType, Blog, TimelineItem, PostSortField, Order } from '../types/api.js';
import {
  DEFAULT_ACTIVITY_KINDS,
  getBlogActivityKindsPreference,
  normalizeActivityKinds,
  setBlogActivityKindsPreference,
  type ActivityKind,
} from '../services/profile.js';
import { getPageSlotConfig } from '../services/render-page.js';
import type { RenderSlotConfig } from '../config.js';
import '../components/activity-kind-pills.js';
import '../components/timeline-stream.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/error-state.js';
import '../components/blog-header.js';
import '../components/render-card.js';

const PAGE_SIZE = 15;
const TYPE_NAME_TO_ENUM: Record<string, PostType> = {
  text: 1,
  image: 2,
  video: 3,
  audio: 4,
  link: 5,
  chat: 6,
  quote: 7,
};
const TYPE_ENUM_TO_NAME: Record<number, string> = {
  1: 'text',
  2: 'image',
  3: 'video',
  4: 'audio',
  5: 'link',
  6: 'chat',
  7: 'quote',
};

@customElement('view-posts')
export class ViewPosts extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host { display: block; min-height: 100vh; background: var(--bg-primary); }
      .content { padding: 20px 0; }
      .feed-container { margin-bottom: 20px; }
    `,
  ];

  @property({ type: String }) blog = '';

  @state() private blogId: number | null = null;
  @state() private sortValue = 'newest';
  @state() private selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private timelineItems: TimelineItem[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private infiniteScroll = false;
  @state() private errorMessage = '';
  @state() private activityKinds: ActivityKind[] = getBlogActivityKindsPreference();
  @state() private blogData: Blog | null = null;
  private readonly mainSlotConfig: RenderSlotConfig = getPageSlotConfig('activity', 'main_stream');

  private backendCursor: string | null = null;
  private seenIds = new Set<number>();

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
    const types = getUrlParam('types');
    const sort = getUrlParam('sort');
    const activity = getUrlParam('activity');
    this.sortValue = normalizeSortValue(sort);
    if (types) {
      const parsed = types
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .map((t) => TYPE_NAME_TO_ENUM[t] ?? (parseInt(t, 10) as PostType))
        .filter((t) => Number.isFinite(t));
      if (parsed.length > 0) this.selectedTypes = parsed;
    }
    if (activity) this.activityKinds = normalizeActivityKinds(activity, DEFAULT_ACTIVITY_KINDS);
    const hasInteractionKinds = this.activityKinds.includes('like') || this.activityKinds.includes('comment');
    if (hasInteractionKinds && this.sortValue !== 'newest') {
      this.sortValue = 'newest';
    }
    
    const params: Record<string, string> = {
      sort: this.sortValue,
      types: isDefaultTypes(this.selectedTypes)
        ? ''
        : this.selectedTypes.map((t) => TYPE_ENUM_TO_NAME[t] || String(t)).join(','),
      activity: this.activityKinds.join(',') === DEFAULT_ACTIVITY_KINDS.join(',') ? '' : this.activityKinds.join(','),
    };
    if (!isBlogInPath()) {
      params.blog = this.blog;
    }
    setUrlParams(params);
    await this.fillPage();
    this.observeSentinel();
  }

  private resetState() {
    this.timelineItems = [];
    this.seenIds.clear();
    this.backendCursor = null;
    this.exhausted = false;
    this.errorMessage = '';
  }

  private observeSentinel(): void {
    requestAnimationFrame(() => {
      const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
      if (sentinel) {
        scrollObserver.observe(sentinel, () => {
          if (this.infiniteScroll && !this.loading && !this.exhausted) this.loadMore();
        });
      }
    });
  }

  private async fillPage(): Promise<void> {
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
    } finally {
      this.loading = false;
    }
  }

  private async loadMore() {
    if (this.loading || this.exhausted) return;
    await this.fillPage();
  }

  private handlePostClick(e: CustomEvent) {
    const post = e.detail.post as ProcessedPost;
    
    // Extract all posts from the timeline for the lightbox navigation stack
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

  private handleInfiniteToggle(e: CustomEvent) {
    this.infiniteScroll = e.detail.enabled;
    if (this.infiniteScroll) this.observeSentinel();
  }

  private handleActivityKindsChange(e: CustomEvent): void {
    this.activityKinds = normalizeActivityKinds((e.detail.kinds || []).join(','), DEFAULT_ACTIVITY_KINDS);
    if (this.activityKinds.includes('like') || this.activityKinds.includes('comment')) {
      this.sortValue = 'newest';
    }
    setBlogActivityKindsPreference(this.activityKinds);
    setUrlParams({
      sort: this.sortValue,
      activity: this.activityKinds.join(',') === DEFAULT_ACTIVITY_KINDS.join(',') ? '' : this.activityKinds.join(','),
      blog: this.blog,
    });
    this.loadPosts();
  }

  render() {
    return html`
      <div class="content">
        <blog-header page="posts" .blogName=${this.blog} .blogTitle=${this.blogData?.title || ''}></blog-header>

        <activity-kind-pills
          .selected=${this.activityKinds}
          @activity-kinds-change=${this.handleActivityKindsChange}
        ></activity-kind-pills>

        ${this.errorMessage ? html`<error-state message=${this.errorMessage}></error-state>` : ''}
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
            .activityKinds=${this.activityKinds}
            .showActorInCluster=${false}
            @post-click=${this.handlePostClick}
          ></timeline-stream>
        </div>

        <load-footer
          mode="timeline"
          pageName="timeline"
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
