import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage } from '../services/api-error.js';
import { getUrlParam, setUrlParams, isDefaultTypes } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import type { PostType, Blog, TimelineItem, PostVariant } from '../types/api.js';
import {
  getBlogActivityKindsPreference,
  setBlogActivityKindsPreference,
  type ActivityKind,
} from '../services/profile.js';
import '../components/filter-bar.js';
import '../components/activity-kind-pills.js';
import '../components/timeline-stream.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/error-state.js';
import '../components/blog-header.js';

const PAGE_SIZE = 15;

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
  @state() private selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private selectedVariants: PostVariant[] = [];
  @state() private timelineItems: TimelineItem[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private infiniteScroll = false;
  @state() private errorMessage = '';
  @state() private activityKinds: ActivityKind[] = getBlogActivityKindsPreference();
  @state() private blogData: Blog | null = null;

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
    const variants = getUrlParam('variants');
    if (types) this.selectedTypes = types.split(',').map(t => parseInt(t, 10) as PostType);
    if (variants) this.selectedVariants = variants.split(',').map(v => parseInt(v, 10) as PostVariant);
    
    setUrlParams({ 
      types: isDefaultTypes(this.selectedTypes) ? '' : this.selectedTypes.join(','), 
      variants: this.selectedVariants.length > 0 ? this.selectedVariants.join(',') : '',
      blog: this.blog 
    });
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
      const resp = await apiClient.posts.list({
        blog_id: this.blogId,
        sort_field: 1, 
        order: 2,
        post_types: this.selectedTypes,
        variants: this.selectedVariants.length > 0 ? this.selectedVariants : undefined,
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

  private handleTypesChange(e: CustomEvent) {
    this.selectedTypes = e.detail.types;
    this.loadPosts();
  }

  private handleVariantChange(e: CustomEvent) {
    this.selectedVariants = e.detail.variants || [];
    this.loadPosts();
  }

  private handleInfiniteToggle(e: CustomEvent) {
    this.infiniteScroll = e.detail.enabled;
    if (this.infiniteScroll) this.observeSentinel();
  }

  private handleActivityKindsChange(e: CustomEvent): void {
    this.activityKinds = e.detail.kinds || ['post', 'reblog', 'like', 'comment'];
    setBlogActivityKindsPreference(this.activityKinds);
  }

  render() {
    return html`
      <div class="content">
        <blog-header page="posts" .blogName=${this.blog} .blogTitle=${this.blogData?.title || ''}></blog-header>

        <filter-bar
          .selectedTypes=${this.selectedTypes}
          .selectedVariants=${this.selectedVariants}
          .showVariants=${true}
          .loading=${this.loading}
          @types-change=${this.handleTypesChange}
          @variant-change=${this.handleVariantChange}
        ></filter-bar>
        <activity-kind-pills
          .selected=${this.activityKinds}
          @activity-kinds-change=${this.handleActivityKindsChange}
        ></activity-kind-pills>

        ${this.errorMessage ? html`<error-state message=${this.errorMessage}></error-state>` : ''}

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
