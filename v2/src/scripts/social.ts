import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { initTheme, injectGlobalStyles, baseStyles } from '../styles/theme.js';
import { listBlogFollowers, listBlogFollowing, resolveIdentifier } from '../services/api.js';
import { getBlogName, getUrlParam, setUrlParams } from '../services/blog-resolver.js';
import type { Activity } from '../types/api.js';
import '../components/shared-nav.js';
import '../components/blog-list.js';
import '../components/load-footer.js';

const PAGE_SIZE = 50;

type Tab = 'followers' | 'following';

@customElement('social-page')
export class SocialPage extends LitElement {
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

      .tabs {
        display: flex;
        justify-content: center;
        gap: 8px;
        padding: 0 16px;
        margin-bottom: 20px;
      }

      .tab {
        padding: 12px 24px;
        border-radius: 6px;
        background: var(--bg-panel);
        color: var(--text-muted);
        font-size: 14px;
        min-height: 44px;
        transition: all 0.2s;
        border: 1px solid var(--border);
      }

      .tab:hover {
        background: var(--bg-panel-alt);
      }

      .tab.active {
        background: var(--accent);
        color: white;
        border-color: var(--accent);
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

      .list-container {
        margin-bottom: 20px;
      }
    `,
  ];

  @state() private blogName = '';
  @state() private blogId: number | null = null;
  @state() private activeTab: Tab = 'followers';
  @state() private followers: Activity[] = [];
  @state() private following: Activity[] = [];
  @state() private followersCursor: string | null = null;
  @state() private followingCursor: string | null = null;
  @state() private followersExhausted = false;
  @state() private followingExhausted = false;
  @state() private loading = false;
  @state() private infiniteScroll = false;
  @state() private statusMessage = '';
  @state() private errorMessage = '';

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
    this.blogName = getBlogName();
    const tab = getUrlParam('tab') as Tab;
    if (tab === 'followers' || tab === 'following') {
      this.activeTab = tab;
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
      await this.loadData();
    } catch (e) {
      this.errorMessage = 'Error resolving blog: ' + (e as Error).message;
      this.statusMessage = '';
    }
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && this.infiniteScroll && !this.loading && !this.isExhausted && this.blogId) {
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

  private get isExhausted(): boolean {
    return this.activeTab === 'followers' ? this.followersExhausted : this.followingExhausted;
  }

  private get currentList(): Activity[] {
    return this.activeTab === 'followers' ? this.followers : this.following;
  }

  private async loadData(): Promise<void> {
    if (!this.blogId) return;

    setUrlParams({
      blog: this.blogName,
      tab: this.activeTab,
    });

    try {
      await this.fetchPage();
    } catch (e) {
      this.errorMessage = 'Error: ' + (e as Error).message;
    }

    this.observeSentinel();
  }

  private async fetchPage(): Promise<void> {
    if (!this.blogId) return;

    this.loading = true;

    try {
      if (this.activeTab === 'followers') {
        const resp = await listBlogFollowers({
          blog_id: this.blogId,
          page: {
            page_size: PAGE_SIZE,
            page_token: this.followersCursor || undefined,
          },
        });

        const items = resp.activity || [];
        this.followers = [...this.followers, ...items];
        this.followersCursor = resp.page?.nextPageToken || null;

        if (!this.followersCursor || items.length === 0) {
          this.followersExhausted = true;
        }
      } else {
        const resp = await listBlogFollowing({
          blog_id: this.blogId,
          page: {
            page_size: PAGE_SIZE,
            page_token: this.followingCursor || undefined,
          },
        });

        const items = resp.activity || [];
        this.following = [...this.following, ...items];
        this.followingCursor = resp.page?.nextPageToken || null;

        if (!this.followingCursor || items.length === 0) {
          this.followingExhausted = true;
        }
      }
    } finally {
      this.loading = false;
    }
  }

  private async loadMore(): Promise<void> {
    if (this.loading || this.isExhausted) return;
    await this.fetchPage();
  }

  private async switchTab(tab: Tab): Promise<void> {
    if (tab === this.activeTab) return;

    this.activeTab = tab;

    setUrlParams({
      blog: this.blogName,
      tab: this.activeTab,
    });

    // Load if empty
    if (this.currentList.length === 0) {
      await this.fetchPage();
    }

    this.observeSentinel();
  }

  private handleInfiniteToggle(e: CustomEvent): void {
    this.infiniteScroll = e.detail.enabled;
    if (this.infiniteScroll) {
      this.observeSentinel();
    }
  }

  render() {
    return html`
      <shared-nav currentPage="social"></shared-nav>

      <div class="content">
        ${this.blogName
          ? html`
              <div class="blog-header">
                <h1 class="blog-name">@${this.blogName}</h1>
                ${this.blogId ? html`<p class="blog-meta">Social Connections</p>` : ''}
              </div>
            `
          : ''}

        ${this.errorMessage ? html`<div class="error">${this.errorMessage}</div>` : ''}

        ${this.blogId
          ? html`
              <div class="tabs">
                <button
                  class="tab ${this.activeTab === 'followers' ? 'active' : ''}"
                  @click=${() => this.switchTab('followers')}
                >
                  Followers ${this.followers.length > 0 ? `(${this.followers.length})` : ''}
                </button>
                <button
                  class="tab ${this.activeTab === 'following' ? 'active' : ''}"
                  @click=${() => this.switchTab('following')}
                >
                  Following ${this.following.length > 0 ? `(${this.following.length})` : ''}
                </button>
              </div>
            `
          : ''}

        ${this.statusMessage ? html`<div class="status">${this.statusMessage}</div>` : ''}

        ${this.currentList.length > 0
          ? html`
              <div class="list-container">
                <blog-list .items=${this.currentList}></blog-list>
              </div>

              <load-footer
                mode="list"
                .totalCount=${this.currentList.length}
                .loading=${this.loading}
                .exhausted=${this.isExhausted}
                .infiniteScroll=${this.infiniteScroll}
                @load-more=${() => this.loadMore()}
                @infinite-toggle=${this.handleInfiniteToggle}
              ></load-footer>
            `
          : this.blogId && !this.loading
          ? html`<div class="status">No ${this.activeTab} found</div>`
          : ''}

        ${this.loading && this.currentList.length === 0
          ? html`<div class="status">Loading...</div>`
          : ''}

        <div id="scroll-sentinel" style="height:1px;"></div>
      </div>
    `;
  }
}

// Initialize
injectGlobalStyles();
initTheme();

const app = document.createElement('social-page');
document.body.appendChild(app);
