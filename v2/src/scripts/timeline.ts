import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { initTheme, injectGlobalStyles, baseStyles } from '../styles/theme.js';
import { listBlogPosts, resolveIdentifier, checkImageExists } from '../services/api.js';
import { getBlogName, getUrlParam, setUrlParams } from '../services/blog-resolver.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import type { Post, PostType, PostSortField, Order } from '../types/api.js';
import '../components/shared-nav.js';
import '../components/type-pills.js';
import '../components/post-feed.js';
import '../components/load-footer.js';
import '../components/post-lightbox.js';

const PAGE_SIZE = 12;
const MAX_BACKEND_FETCHES = 20;

@customElement('timeline-page')
export class TimelinePage extends LitElement {
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

      .blog-meta a {
        color: var(--accent);
        text-decoration: none;
      }

      .blog-meta a:hover {
        text-decoration: underline;
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

      .feed-container {
        margin-bottom: 20px;
      }
    `,
  ];

  @state() private blogName = '';
  @state() private blogId: number | null = null;
  @state() private selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private posts: ProcessedPost[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
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

    const types = getUrlParam('types');

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

    // Timeline is always chronological (newest first)
    const sortField: PostSortField = 1; // CREATED_AT
    const order: Order = 0; // DESC

    try {
      while (buffer.length < PAGE_SIZE && !this.exhausted && backendFetches < MAX_BACKEND_FETCHES) {
        backendFetches++;

        const resp = await listBlogPosts({
          blog_id: this.blogId,
          sort_field: sortField,
          order: order,
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
            continue;
          }

          const media = extractMedia(post);
          const mediaUrl = media.videoUrl || media.audioUrl || media.url;

          if (mediaUrl) {
            const normalizedUrl = mediaUrl.split('?')[0];
            if (this.seenUrls.has(normalizedUrl)) {
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
            continue;
          }

          const isDeleted = !!post.deletedAtUnix;

          if (isDeleted) {
            continue;
          }

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
      } else if (this.posts.length === 0 && this.exhausted) {
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
      <shared-nav currentPage="timeline"></shared-nav>

      <div class="content">
        ${this.blogName
          ? html`
              <div class="blog-header">
                <h1 class="blog-name">@${this.blogName}</h1>
                ${this.blogId
                  ? html`
                      <p class="blog-meta">
                        Timeline -
                        <a href="https://${this.blogName}.bdsmlr.com" target="_blank">Visit Blog</a>
                      </p>
                    `
                  : ''}
              </div>
            `
          : ''}

        ${this.errorMessage ? html`<div class="error">${this.errorMessage}</div>` : ''}

        ${this.blogId
          ? html`
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
              <div class="feed-container">
                <post-feed .posts=${this.posts} @post-click=${this.handlePostClick}></post-feed>
              </div>

              <load-footer
                mode="timeline"
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

const app = document.createElement('timeline-page');
document.body.appendChild(app);
