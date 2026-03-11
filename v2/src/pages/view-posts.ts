import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, } from '../services/api-error.js';
import { getUrlParam, setUrlParams, isDefaultTypes } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import {
  
  
  setCachedPaginationCursor,
} from '../services/storage.js';
import { extractMedia, } from '../types/post.js';
import type { PostType, Blog } from '../types/api.js';
import '../components/type-pills.js';
import '../components/post-feed-item.js';
import '../components/activity-grid.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/skeleton-loader.js';
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
      .type-pills-container { display: flex; justify-content: center; margin-bottom: 20px; }
      .status { text-align: center; color: var(--text-muted); padding: 40px 16px; }
      .feed-container { margin-bottom: 20px; }
      .interaction-cluster { 
        max-width: 600px; 
        margin: 0 auto 20px auto; 
        background: var(--bg-panel-alt);
        padding: 12px;
        border-radius: 8px;
        border: 1px solid var(--border);
      }
      .cluster-label { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; }
    `,
  ];

  @property({ type: String }) blog = '';

  @state() private blogId: number | null = null;
  @state() private selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private posts: any[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private infiniteScroll = false;
  
  @state() private errorMessage = '';
  
  @state() private blogData: Blog | null = null;
  
  

  private backendCursor: string | null = null;
  private seenIds = new Set<number>();
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
    const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
    if (sentinel) scrollObserver.unobserve(sentinel);
    clearBlogTheme();
  }

  private savePaginationState = (): void => {
    if (this.paginationKey && this.posts.length > 0) {
      setCachedPaginationCursor(this.paginationKey, this.backendCursor, window.scrollY, this.posts.length, this.exhausted);
    }
  };

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
    if (types) this.selectedTypes = types.split(',').map(t => parseInt(t, 10) as PostType);
    
    setUrlParams({ types: isDefaultTypes(this.selectedTypes) ? '' : this.selectedTypes.join(','), blog: this.blog });
    
    await this.fillPage();
    this.observeSentinel();
  }

  private resetState() {
    this.posts = [];
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
      // 1. Fetch Posts (Main content)
      const postsResp = await apiClient.posts.list({
        blog_id: this.blogId,
        sort_field: 1, // CreatedAt
        order: 2, // DESC
        post_types: this.selectedTypes,
        page: { page_size: PAGE_SIZE, page_token: this.backendCursor || undefined }
      });

      // 2. Fetch Activity (Likes/Comments)
      const activityResp = await apiClient.recentActivity.list({
        blog_ids: [this.blogId],
        page: { page_size: 20 },
        global_merge: true,
        sort_field: 0,
        order: 2,
        limit_per_blog: 0
      });

      this.backendCursor = postsResp.page?.nextPageToken || null;
      if (!this.backendCursor) this.exhausted = true;

      const posts = (postsResp.posts || []).map(p => ({ 
        ...p, 
        _media: extractMedia(p), 
        _interactionType: (p.originPostId && p.originPostId !== p.id) ? 'reblog' : 'post' 
      }));
      
      const activities = (activityResp.posts || []).map(p => ({ 
        ...p, 
        _media: extractMedia(p), 
        _interactionType: 'like' 
      }));

      // 3. Merge and Sort by Date
      const merged = [...posts, ...activities].sort((a, b) => (b.createdAtUnix || 0) - (a.createdAtUnix || 0));
      
      // 4. Cluster consecutive interactions
      const finalItems: any[] = [];
      let currentCluster: any[] = [];

      for (const item of merged) {
        if (this.seenIds.has(item.id)) continue;
        this.seenIds.add(item.id);

        if (item._interactionType === 'post' || item._interactionType === 'reblog') {
          if (currentCluster.length > 0) {
            finalItems.push({ _type: 'cluster', items: currentCluster });
            currentCluster = [];
          }
          finalItems.push({ _type: 'post', item });
        } else {
          currentCluster.push({ post: item, type: item._interactionType });
          if (currentCluster.length >= 4) {
            finalItems.push({ _type: 'cluster', items: currentCluster });
            currentCluster = [];
          }
        }
      }
      if (currentCluster.length > 0) finalItems.push({ _type: 'cluster', items: currentCluster });

      this.posts = [...this.posts, ...finalItems];
      if (merged.length === 0) this.exhausted = true;
    } finally {
      this.loading = false;
    }
  }

  private async loadMore() {
    if (this.loading || this.exhausted) return;
    await this.fillPage();
  }

  private handlePostClick(e: CustomEvent) {
    const post = e.detail.post;
    // For simplicity, we just pass the single post to the lightbox
    this.dispatchEvent(new CustomEvent('post-click', {
      detail: { post, posts: [post], index: 0 },
      bubbles: true,
      composed: true
    }));
  }

  private handleTypesChange(e: CustomEvent) {
    this.selectedTypes = e.detail.types;
    this.loadPosts();
  }

  private handleInfiniteToggle(e: CustomEvent) {
    this.infiniteScroll = e.detail.enabled;
    if (this.infiniteScroll) this.observeSentinel();
  }

  render() {
    return html`
      <div class="content">
        <blog-header page="posts" .blogName=${this.blog} .blogTitle=${this.blogData?.title || ''}></blog-header>

        <div class="type-pills-container">
          <type-pills .selectedTypes=${this.selectedTypes} @types-change=${this.handleTypesChange}></type-pills>
        </div>

        ${this.errorMessage ? html`<error-state message=${this.errorMessage}></error-state>` : ''}

        <div class="feed-container">
          ${this.posts.map(entry => {
            if (entry._type === 'post') {
              return html`<post-feed-item .post=${entry.item} @post-select=${this.handlePostClick}></post-feed-item>`;
            } else {
              return html`
                <div class="interaction-cluster">
                  <div class="cluster-label">Recent Activity</div>
                  <activity-grid compact .items=${entry.items} @activity-click=${this.handlePostClick}></activity-grid>
                </div>
              `;
            }
          })}
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
