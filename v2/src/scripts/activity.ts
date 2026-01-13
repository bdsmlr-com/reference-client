import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { initTheme, injectGlobalStyles, baseStyles } from '../styles/theme.js';
import { listBlogPosts, resolveIdentifier, checkImageExists } from '../services/api.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import type { Post, PostType, PostSortField, Order } from '../types/api.js';
import '../components/shared-nav.js';
import '../components/type-pills.js';
import '../components/post-feed.js';
import '../components/load-footer.js';
import '../components/post-lightbox.js';

const PAGE_SIZE = 12;
const MAX_BACKEND_FETCHES_PER_BLOG = 5;
const STORAGE_KEY = 'bdsmlr_activity_blogs';

interface BlogState {
  name: string;
  id: number;
  cursor: string | null;
  exhausted: boolean;
}

@customElement('activity-page')
export class ActivityPage extends LitElement {
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

      .blog-input-section {
        max-width: 600px;
        margin: 0 auto 20px;
        padding: 0 16px;
      }

      .blog-input-section h2 {
        font-size: 16px;
        color: var(--text-primary);
        margin: 0 0 12px;
        text-align: center;
      }

      .blog-input-section textarea {
        width: 100%;
        min-height: 100px;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: var(--text-primary);
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        box-sizing: border-box;
      }

      .blog-input-section textarea:focus {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      .blog-input-section .help {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 8px;
        text-align: center;
      }

      .blog-input-section button {
        display: block;
        width: 100%;
        max-width: 200px;
        margin: 12px auto 0;
        padding: 12px 24px;
        border-radius: 6px;
        background: var(--accent);
        color: white;
        font-size: 16px;
        min-height: 44px;
        transition: background 0.2s;
      }

      .blog-input-section button:hover {
        background: var(--accent-hover);
      }

      .blog-input-section button:disabled {
        background: var(--text-muted);
        cursor: wait;
      }

      .active-blogs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
        margin-top: 12px;
      }

      .blog-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: var(--bg-panel-alt);
        border-radius: 16px;
        font-size: 13px;
        color: var(--text-primary);
      }

      .blog-chip button {
        padding: 0;
        background: none;
        color: var(--text-muted);
        font-size: 16px;
        line-height: 1;
      }

      .blog-chip button:hover {
        color: var(--error);
      }

      .type-pills-container {
        margin-bottom: 20px;
      }

      .status {
        text-align: center;
        color: var(--text-muted);
        padding: 40px 16px;
      }

      .feed-container {
        margin-bottom: 20px;
      }
    `,
  ];

  @state() private blogInput = '';
  @state() private blogStates: BlogState[] = [];
  @state() private resolvingBlogs = false;
  @state() private selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private posts: ProcessedPost[] = [];
  @state() private loading = false;
  @state() private exhausted = false;
  @state() private loadingCurrent = 0;
  @state() private infiniteScroll = false;
  @state() private lightboxPost: ProcessedPost | null = null;
  @state() private lightboxOpen = false;
  @state() private statusMessage = '';

  private seenIds = new Set<number>();
  private seenUrls = new Set<string>();
  private observer: IntersectionObserver | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.loadFromStorage();
    this.setupIntersectionObserver();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const names = JSON.parse(stored) as string[];
        this.blogInput = names.join('\n');
      } catch {
        // ignore
      }
    }
  }

  private saveToStorage(): void {
    const names = this.blogStates.map((b) => b.name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && this.infiniteScroll && !this.loading && !this.exhausted && this.blogStates.length > 0) {
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
    this.exhausted = false;
    this.seenIds.clear();
    this.seenUrls.clear();
    this.posts = [];
    this.statusMessage = '';

    // Reset blog cursors
    this.blogStates = this.blogStates.map((b) => ({
      ...b,
      cursor: null,
      exhausted: false,
    }));
  }

  private parseBlogNames(): string[] {
    return this.blogInput
      .split(/[\n,]+/)
      .map((s) => s.trim().replace(/^@/, ''))
      .filter((s) => s.length > 0);
  }

  private async resolveBlogs(): Promise<void> {
    const names = this.parseBlogNames();
    if (names.length === 0) {
      this.statusMessage = 'Please enter at least one blog name';
      return;
    }

    this.resolvingBlogs = true;
    this.statusMessage = `Resolving ${names.length} blog(s)...`;

    // Resolve in parallel
    const results = await Promise.all(
      names.map(async (name) => {
        try {
          const resolved = await resolveIdentifier({ blog_name: name });
          if (resolved.blogId) {
            return { name, id: resolved.blogId, error: null };
          }
          return { name, id: null, error: 'Not found' };
        } catch (e) {
          return { name, id: null, error: (e as Error).message };
        }
      })
    );

    const resolved = results.filter((r) => r.id !== null);
    const failed = results.filter((r) => r.id === null);

    this.blogStates = resolved.map((r) => ({
      name: r.name,
      id: r.id!,
      cursor: null,
      exhausted: false,
    }));

    this.saveToStorage();
    this.resolvingBlogs = false;

    if (failed.length > 0) {
      this.statusMessage = `Resolved ${resolved.length}/${names.length} blogs. Failed: ${failed.map((f) => f.name).join(', ')}`;
    } else {
      this.statusMessage = '';
    }

    if (this.blogStates.length > 0) {
      await this.loadPosts();
    }
  }

  private removeBlog(name: string): void {
    this.blogStates = this.blogStates.filter((b) => b.name !== name);
    this.blogInput = this.blogStates.map((b) => b.name).join('\n');
    this.saveToStorage();

    if (this.blogStates.length === 0) {
      this.posts = [];
    }
  }

  private async loadPosts(): Promise<void> {
    if (this.blogStates.length === 0) return;
    if (this.selectedTypes.length === 0) {
      this.statusMessage = 'Please select at least one post type';
      return;
    }

    this.resetState();

    try {
      await this.fillPage();
    } catch (e) {
      this.statusMessage = 'Error: ' + (e as Error).message;
    }

    this.observeSentinel();
  }

  private async fillPage(): Promise<void> {
    if (this.blogStates.length === 0) return;

    const buffer: ProcessedPost[] = [];
    this.loading = true;
    this.loadingCurrent = 0;

    // Activity feed is always chronological (newest first)
    const sortField: PostSortField = 1; // CREATED_AT
    const order: Order = 0; // DESC

    try {
      // Fetch from all non-exhausted blogs in parallel
      let iterations = 0;
      const maxIterations = MAX_BACKEND_FETCHES_PER_BLOG;

      while (buffer.length < PAGE_SIZE && !this.exhausted && iterations < maxIterations) {
        iterations++;

        const activeBlogs = this.blogStates.filter((b) => !b.exhausted);
        if (activeBlogs.length === 0) {
          this.exhausted = true;
          break;
        }

        // Fetch from all active blogs in parallel
        const fetchResults = await Promise.all(
          activeBlogs.map(async (blogState) => {
            try {
              const resp = await listBlogPosts({
                blog_id: blogState.id,
                sort_field: sortField,
                order: order,
                post_types: this.selectedTypes,
                page: {
                  page_size: 50,
                  page_token: blogState.cursor || undefined,
                },
              });

              return {
                blogName: blogState.name,
                posts: resp.posts || [],
                nextCursor: resp.page?.nextPageToken || null,
              };
            } catch {
              return {
                blogName: blogState.name,
                posts: [],
                nextCursor: null,
              };
            }
          })
        );

        // Update blog states with new cursors
        for (const result of fetchResults) {
          const blogState = this.blogStates.find((b) => b.name === result.blogName);
          if (blogState) {
            blogState.cursor = result.nextCursor;
            if (!result.nextCursor || result.posts.length === 0) {
              blogState.exhausted = true;
            }
          }
        }

        // Merge all posts and sort by date (always chronological, newest first)
        const allPosts = fetchResults.flatMap((r) => r.posts);
        allPosts.sort((a, b) => {
          const aTime = a.createdAtUnix || 0;
          const bTime = b.createdAtUnix || 0;
          return bTime - aTime; // Newest first
        });

        // Process candidates
        const candidates: Post[] = [];
        for (const post of allPosts) {
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

        // Validate media existence
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

        // Check if all blogs are exhausted
        if (this.blogStates.every((b) => b.exhausted)) {
          this.exhausted = true;
          break;
        }
      }

      if (buffer.length > 0) {
        this.posts = [...this.posts, ...buffer];
      } else if (this.posts.length === 0 && this.exhausted) {
        this.statusMessage = 'No posts found';
      }
    } finally {
      this.loading = false;
      // Force re-render to update blog chip statuses
      this.blogStates = [...this.blogStates];
    }
  }

  private async loadMore(): Promise<void> {
    if (this.loading || this.exhausted) return;
    await this.fillPage();
  }

  private handleTypesChange(e: CustomEvent): void {
    this.selectedTypes = e.detail.types;
    if (this.blogStates.length > 0) {
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
      <shared-nav currentPage="activity"></shared-nav>

      <div class="content">
        <div class="blog-input-section">
          <h2>Blogs to follow</h2>
          <textarea
            placeholder="Enter blog names (one per line or comma-separated)"
            .value=${this.blogInput}
            @input=${(e: Event) => (this.blogInput = (e.target as HTMLTextAreaElement).value)}
          ></textarea>
          <p class="help">Example: canadiandominant, daddy-and-his-baby-girl</p>
          <button ?disabled=${this.resolvingBlogs} @click=${() => this.resolveBlogs()}>
            ${this.resolvingBlogs ? 'Loading...' : 'Load Activity'}
          </button>

          ${this.blogStates.length > 0
            ? html`
                <div class="active-blogs">
                  ${this.blogStates.map(
                    (blog) => html`
                      <span class="blog-chip">
                        @${blog.name}
                        <button @click=${() => this.removeBlog(blog.name)}>×</button>
                      </span>
                    `
                  )}
                </div>
              `
            : ''}
        </div>

        ${this.blogStates.length > 0
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
                mode="activity"
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

const app = document.createElement('activity-page');
document.body.appendChild(app);
