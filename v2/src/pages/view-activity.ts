import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getContextualErrorMessage, toApiError } from '../services/api-error.js';
import { getUrlParam, setUrlParams } from '../services/blog-resolver.js';
import { initBlogTheme, clearBlogTheme } from '../services/blog-theme.js';
import { scrollObserver } from '../services/scroll-observer.js';
import { extractMedia, type ProcessedPost, type ViewStats } from '../types/post.js';
import type { Blog, Activity } from '../types/api.js';
import '../components/post-grid.js';
import '../components/load-footer.js';
import '../components/loading-spinner.js';
import '../components/error-state.js';
import '../components/blog-header.js';

const PAGE_SIZE = 24;

@customElement('view-activity')
export class ViewActivity extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host { display: block; min-height: 100vh; background: var(--bg-primary); }
      .content { padding: 20px 0; }
      .status { text-align: center; color: var(--text-muted); padding: 40px 16px; }
      .grid-container { margin-bottom: 20px; }
    `,
  ];

  @property({ type: String }) blog = '';

  @state() private blogId: number | null = null;
  @state() private posts: ProcessedPost[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private stats: ViewStats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
  @state() private infiniteScroll = false;
  @state() private statusMessage = '';
  @state() private errorMessage = '';
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
    clearBlogTheme();
  }

  private async loadFromUrl(): Promise<void> {
    if (!this.blog) return;
    this.loading = true;
    try {
      this.blogData = await initBlogTheme(this.blog);
      const blogId = await apiClient.identity.resolveNameToId(this.blog);
      if (!blogId) {
        this.errorMessage = `Blog @${this.blog} not found`;
        return;
      }
      this.blogId = blogId;
      await this.loadActivity();
    } catch (e) {
      this.errorMessage = getContextualErrorMessage(e, 'resolve_blog');
    } finally {
      this.loading = false;
    }
  }

  private async loadActivity(): Promise<void> {
    if (!this.blogId) return;
    this.posts = [];
    this.seenIds.clear();
    this.backendCursor = null;
    this.exhausted = false;
    await this.fetchBatch();
  }

  private async fetchBatch(): Promise<void> {
    if (!this.blogId || this.loading || this.exhausted) return;
    this.loading = true;
    try {
      const resp = await apiClient.activity.list({
        blog_id: this.blogId,
        page: { page_size: PAGE_SIZE, page_token: this.backendCursor || undefined }
      });

      const activities: Activity[] = resp.activities || [];
      this.backendCursor = resp.page?.nextPageToken || null;
      if (!this.backendCursor) this.exhausted = true;

      // Map activities to posts for the grid
      const postIds = activities.map(a => a.postId).filter((id): id is number => !!id);
      if (postIds.length > 0) {
        const batchResp = await apiClient.posts.batchGet({ post_ids: postIds });
        const hydrated = (batchResp.posts || []).map(p => ({
          ...p,
          _media: extractMedia(p)
        }));
        
        const unique = hydrated.filter(p => {
          if (this.seenIds.has(p.id)) return false;
          this.seenIds.add(p.id);
          return true;
        });

        this.posts = [...this.posts, ...unique];
      }

      if (activities.length === 0) this.exhausted = true;
    } catch (e) {
      this.errorMessage = getContextualErrorMessage(e, 'load_activity');
    } finally {
      this.loading = false;
    }
  }

  private handlePostClick(e: CustomEvent): void {
    const post = e.detail.post as ProcessedPost;
    this.dispatchEvent(new CustomEvent('post-click', {
      detail: { post, posts: this.posts, index: this.posts.findIndex(p => p.id === post.id) },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    return html`
      <div class="content">
        <blog-header page="activity" .blogName=${this.blog} .blogTitle=${this.blogData?.title || ''}></blog-header>
        
        ${this.errorMessage ? html`<error-state title="Error" message=${this.errorMessage}></error-state>` : ''}
        ${this.statusMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}

        <div class="grid-container">
          <post-grid .posts=${this.posts} @post-click=${this.handlePostClick}></post-grid>
        </div>

        <load-footer
          mode="activity"
          pageName="activity"
          .loading=${this.loading}
          .exhausted=${this.exhausted}
          @load-more=${() => this.fetchBatch()}
        ></load-footer>
      </div>
    `;
  }
}
