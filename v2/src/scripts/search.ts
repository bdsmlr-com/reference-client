import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { initTheme, injectGlobalStyles, baseStyles } from '../styles/theme.js';
import { searchPostsByTag, checkImageExists } from '../services/api.js';
import { getUrlParam, setUrlParams } from '../services/blog-resolver.js';
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

@customElement('search-page')
export class SearchPage extends LitElement {
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

      .help {
        text-align: center;
        color: var(--text-muted);
        font-size: 12px;
        margin-bottom: 20px;
        padding: 0 16px;
      }

      .help code {
        background: var(--bg-panel-alt);
        padding: 2px 6px;
        border-radius: 4px;
      }

      .search-box {
        max-width: 600px;
        margin: 0 auto 20px;
        padding: 0 16px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
      }

      .search-box input {
        flex: 1;
        min-width: 200px;
        padding: 12px 16px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: var(--text-primary);
        font-size: 16px;
        min-height: 44px;
      }

      .search-box input:focus {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      .search-box button {
        padding: 12px 24px;
        border-radius: 6px;
        background: var(--accent);
        color: white;
        font-size: 16px;
        transition: background 0.2s;
        min-height: 44px;
      }

      .search-box button:hover {
        background: var(--accent-hover);
      }

      .search-box button:disabled {
        background: var(--text-muted);
        cursor: wait;
      }

      .type-pills-container {
        margin-bottom: 20px;
      }

      .status {
        text-align: center;
        color: var(--text-muted);
        padding: 40px 16px;
      }

      .grid-container {
        margin-bottom: 20px;
      }

      @media (max-width: 480px) {
        .search-box {
          flex-direction: column;
        }

        .search-box input {
          width: 100%;
        }

        .search-box button {
          width: 100%;
        }
      }
    `,
  ];

  @state() private query = '';
  @state() private sortValue = '1:0';
  @state() private selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private posts: ProcessedPost[] = [];
  @state() private loading = false;
  @state() private searching = false;
  @state() private exhausted = false;
  @state() private stats: ViewStats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
  @state() private loadingCurrent = 0;
  @state() private infiniteScroll = false;
  @state() private lightboxPost: ProcessedPost | null = null;
  @state() private lightboxOpen = false;
  @state() private statusMessage = '';
  @state() private hasSearched = false;

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

  private loadFromUrl(): void {
    const q = getUrlParam('q');
    const sort = getUrlParam('sort');
    const types = getUrlParam('types');

    if (q) this.query = q;
    if (sort) this.sortValue = sort;
    if (types) {
      this.selectedTypes = types.split(',').map((t) => parseInt(t, 10) as PostType);
    }

    if (this.query) {
      this.search();
    }
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && this.infiniteScroll && !this.loading && !this.exhausted && this.hasSearched) {
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

  private async search(): Promise<void> {
    if (!this.query.trim()) return;
    if (this.selectedTypes.length === 0) {
      this.statusMessage = 'Please select at least one post type';
      return;
    }

    this.searching = true;
    this.resetState();
    this.hasSearched = true;

    setUrlParams({
      q: this.query,
      sort: this.sortValue,
      types: this.selectedTypes.join(','),
    });

    try {
      await this.fillPage();
    } catch (e) {
      this.statusMessage = 'Error: ' + (e as Error).message;
    }

    this.searching = false;
    this.observeSentinel();
  }

  private async fillPage(): Promise<void> {
    const buffer: ProcessedPost[] = [];
    let backendFetches = 0;

    this.loading = true;
    this.loadingCurrent = 0;

    const sortOpt = SORT_OPTIONS.find((o) => o.value === this.sortValue) || SORT_OPTIONS[0];

    try {
      while (buffer.length < PAGE_SIZE && !this.exhausted && backendFetches < MAX_BACKEND_FETCHES) {
        backendFetches++;

        const resp = await searchPostsByTag({
          tag_name: this.query,
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
          const isReblog = post.originPostId && post.originPostId !== post.id;
          const isRedacted = isDeleted || (!post.blogName && isReblog);

          if (isDeleted || isRedacted) {
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
        this.statusMessage = 'No results found';
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
    if (this.hasSearched) {
      this.search();
    }
  }

  private handleTypesChange(e: CustomEvent): void {
    this.selectedTypes = e.detail.types;
    if (this.hasSearched) {
      this.search();
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

  private handleKeyPress(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      this.search();
    }
  }

  render() {
    return html`
      <shared-nav currentPage="search"></shared-nav>

      <div class="content">
        <p class="help">
          Boolean: <code>tag1 tag2</code> = AND, <code>"exact phrase"</code> = literal,
          <code>-tag</code> = NOT, <code>(a b) c</code> = groups
        </p>

        <div class="search-box">
          <input
            type="text"
            placeholder="Enter tags..."
            .value=${this.query}
            @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)}
            @keypress=${this.handleKeyPress}
          />
          <sort-controls .value=${this.sortValue} @sort-change=${this.handleSortChange}></sort-controls>
          <button ?disabled=${this.searching} @click=${() => this.search()}>Search</button>
        </div>

        <div class="type-pills-container">
          <type-pills
            .selectedTypes=${this.selectedTypes}
            @types-change=${this.handleTypesChange}
          ></type-pills>
        </div>

        ${this.statusMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}

        ${this.posts.length > 0
          ? html`
              <div class="grid-container">
                <post-grid .posts=${this.posts} @post-click=${this.handlePostClick}></post-grid>
              </div>

              <load-footer
                mode="search"
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

const app = document.createElement('search-page');
document.body.appendChild(app);
