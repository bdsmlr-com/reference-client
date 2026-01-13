import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { initTheme, injectGlobalStyles, baseStyles } from '../styles/theme.js';
import { listBlogPosts, resolveIdentifier, checkImageExists } from '../services/api.js';
import { getBlogName, getUrlParam, setUrlParams } from '../services/blog-resolver.js';
import { extractMedia, type ProcessedPost, type ViewStats, SORT_OPTIONS } from '../types/post.js';
import type { Post, PostType, PostSortField, Order } from '../types/api.js';
import '../components/shared-nav.js';
import '../components/sort-controls.js';
import '../components/type-pills.js';
import '../components/post-grid.js';
import '../components/load-footer.js';
import '../components/post-lightbox.js';

const PAGE_SIZE = 12;
const MAX_BACKEND_FETCHES = 20;

@customElement('archive-page')
export class ArchivePage extends LitElement {
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

      .controls {
        max-width: 600px;
        margin: 0 auto 20px;
        padding: 0 16px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
      }

      .type-pills-container {
        margin-bottom: 20px;
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

      .grid-container {
        margin-bottom: 20px;
      }
    `,
  ];

  @state() private blogName = '';
  @state() private blogId: number | null = null;
  @state() private sortValue = '1:0';
  @state() private selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private posts: ProcessedPost[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private stats: ViewStats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
  @state() private loadingCurrent = 0;
  @state() private infiniteScroll = false;
  @state() private lightboxPost: ProcessedPost | null = null;
  @state() private lightboxOpen = false;
  @state() private statusMessage = '';
  @state() private errorMessage = '';

  private backendCursor: string | null = null;
  private seenIds = new Set<number>();
  private seenUrls = new Set<string>();
  private observer: IntersectionObserver | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.loadFromUrl();
    this.setupIntersectionObserver();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
  }

  private async loadFromUrl(): Promise<void> {
    // Get blog name from URL parameter
    this.blogName = getBlogName();

    const sort = getUrlParam('sort');
    const types = getUrlParam('types');

    if (sort) this.sortValue = sort;
    if (types) {
      this.selectedTypes = types.split(',').map((t) => parseInt(t, 10) as PostType);
    }

    if (!this.blogName) {
      this.errorMessage = 'No blog specified. Use ?blog=blogname in the URL.';
      return;
    }

    // Resolve blog name to ID
    try {
      this.statusMessage = 'Resolving blog...';
      const resolved = await resolveIdentifier({ blog_name: this.blogName });

      if (!resolved.blogId) {
        this.errorMessage = `Blog "${this.blogName}" not found`;
        this.statusMessage = '';
        return;
      }

      this.blogId = resolved.blogId;
      this.statusMessage = '';
      await this.loadPosts();
    } catch (e) {
      this.errorMessage = 'Error resolving blog: ' + (e as Error).message;
      this.statusMessage = '';
    }
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && this.infiniteScroll && !this.loading && !this.exhausted && this.blogId) {
          this.loadMore();
        }
      },
      { threshold: 0.1 }
    );
  }

  private observeSentinel(): void {
    requestAnimationFrame(() => {
      const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
      if (sentinel && this.observer) {
        this.observer.disconnect();
        this.observer.observe(sentinel);
      }
    });
  }

  private resetState(): void {
    this.backendCursor = null;
    this.exhausted = false;
    this.seenIds.clear();
    this.seenUrls.clear();
    this.stats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
    this.posts = [];
    this.statusMessage = '';
  }

  private async loadPosts(): Promise<void> {
    if (!this.blogId) return;
    if (this.selectedTypes.length === 0) {
      this.statusMessage = 'Please select at least one post type';
      return;
    }

    this.resetState();

    setUrlParams({
      blog: this.blogName,
      sort: this.sortValue,
      types: this.selectedTypes.join(','),
    });

    try {
      await this.fillPage();
    } catch (e) {
      this.errorMessage = 'Error: ' + (e as Error).message;
    }

    this.observeSentinel();
  }

  private async fillPage(): Promise<void> {
    if (!this.blogId) return;

    const buffer: ProcessedPost[] = [];
    let backendFetches = 0;

    this.loading = true;
    this.loadingCurrent = 0;

    const sortOpt = SORT_OPTIONS.find((o) => o.value === this.sortValue) || SORT_OPTIONS[0];

    try {
      while (buffer.length < PAGE_SIZE && !this.exhausted && backendFetches < MAX_BACKEND_FETCHES) {
        backendFetches++;

        const resp = await listBlogPosts({
          blog_id: this.blogId,
          sort_field: sortOpt.field as PostSortField,
          order: sortOpt.order as Order,
          post_types: this.selectedTypes,
          page: {
            page_size: 100,
            page_token: this.backendCursor || undefined,
          },
        });

        const posts = resp.posts || [];
        this.backendCursor = resp.page?.nextPageToken || null;

        if (!this.backendCursor) {
          this.exhausted = true;
        }

        if (posts.length === 0) {
          this.exhausted = true;
          break;
        }

        const candidates: Post[] = [];
        for (const post of posts) {
          if (this.seenIds.has(post.id)) {
            this.stats = { ...this.stats, dupes: this.stats.dupes + 1 };
            continue;
          }

          const media = extractMedia(post);
          const mediaUrl = media.videoUrl || media.audioUrl || media.url;

          if (mediaUrl) {
            const normalizedUrl = mediaUrl.split('?')[0];
            if (this.seenUrls.has(normalizedUrl)) {
              this.stats = { ...this.stats, dupes: this.stats.dupes + 1 };
              this.seenIds.add(post.id);
              continue;
            }
            this.seenUrls.add(normalizedUrl);
          }

          this.seenIds.add(post.id);
          candidates.push(post);
        }

        const validationResults = await Promise.all(
          candidates.map(async (post) => {
            const media = extractMedia(post);
            if (media.type === 'video' || media.type === 'audio') {
              return { post, exists: true };
            }
            if (media.url) {
              const exists = await checkImageExists(media.url);
              return { post, exists };
            }
            return { post, exists: true };
          })
        );

        for (const { post, exists } of validationResults) {
          if (!exists) {
            this.stats = { ...this.stats, notFound: this.stats.notFound + 1 };
            continue;
          }

          const isDeleted = !!post.deletedAtUnix;

          if (isDeleted) {
            this.stats = { ...this.stats, deleted: this.stats.deleted + 1 };
            continue;
          }

          this.stats = { ...this.stats, found: this.stats.found + 1 };

          const processedPost: ProcessedPost = {
            ...post,
            _media: extractMedia(post),
          };

          buffer.push(processedPost);
          this.loadingCurrent = buffer.length;

          if (buffer.length >= PAGE_SIZE) break;
        }

        if (buffer.length >= PAGE_SIZE) break;
      }

      if (buffer.length > 0) {
        this.posts = [...this.posts, ...buffer];
      } else if (this.stats.found === 0 && this.exhausted) {
        this.statusMessage = 'No posts found';
      }
    } finally {
      this.loading = false;
    }
  }

  private async loadMore(): Promise<void> {
    if (this.loading || this.exhausted) return;
    await this.fillPage();
  }

  private handleSortChange(e: CustomEvent): void {
    this.sortValue = e.detail.value;
    if (this.blogId) {
      this.loadPosts();
    }
  }

  private handleTypesChange(e: CustomEvent): void {
    this.selectedTypes = e.detail.types;
    if (this.blogId) {
      this.loadPosts();
    }
  }

  private handlePostClick(e: CustomEvent): void {
    this.lightboxPost = e.detail.post;
    this.lightboxOpen = true;
  }

  private handleLightboxClose(): void {
    this.lightboxOpen = false;
  }

  private handleInfiniteToggle(e: CustomEvent): void {
    this.infiniteScroll = e.detail.enabled;
    if (this.infiniteScroll) {
      this.observeSentinel();
    }
  }

  render() {
    return html`
      <shared-nav currentPage="archive"></shared-nav>

      <div class="content">
        ${this.blogName
          ? html`
              <div class="blog-header">
                <h1 class="blog-name">@${this.blogName}</h1>
                ${this.blogId ? html`<p class="blog-meta">Archive</p>` : ''}
              </div>
            `
          : ''}

        ${this.errorMessage ? html`<div class="error">${this.errorMessage}</div>` : ''}

        ${this.blogId
          ? html`
              <div class="controls">
                <sort-controls .value=${this.sortValue} @sort-change=${this.handleSortChange}></sort-controls>
              </div>

              <div class="type-pills-container">
                <type-pills
                  .selectedTypes=${this.selectedTypes}
                  @types-change=${this.handleTypesChange}
                ></type-pills>
              </div>
            `
          : ''}

        ${this.statusMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}

        ${this.posts.length > 0
          ? html`
              <div class="grid-container">
                <post-grid .posts=${this.posts} @post-click=${this.handlePostClick}></post-grid>
              </div>

              <load-footer
                mode="archive"
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

      <post-lightbox
        ?open=${this.lightboxOpen}
        .post=${this.lightboxPost}
        @close=${this.handleLightboxClose}
      ></post-lightbox>
    `;
  }
}

// Initialize
injectGlobalStyles();
initTheme();

const app = document.createElement('archive-page');
document.body.appendChild(app);
