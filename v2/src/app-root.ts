import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { Router } from '@lit-labs/router';
import './pages/view-home.js';
import './pages/view-posts.js';
import './pages/view-feed.js';
import './pages/view-archive.js';
import './pages/view-blogs.js';
import './pages/view-search.js';
import './pages/view-social.js';
import './pages/view-discover.js';
import './pages/view-post.js';
import './pages/view-clear-cache.js';
import './components/shared-nav.js';
import './components/offline-banner.js';
import './components/post-lightbox.js';
import './components/contract-error-screen.js';
import { initTheme, injectGlobalStyles, baseStyles } from './styles/theme.js';
import type { ProcessedPost } from './types/post.js';
import { isAdminMode, syncAdminModeFromUrl } from './services/blog-resolver.js';
import { loadRenderContract } from './services/render-contract.js';
import { validateRenderContract } from './services/render-contract-validator.js';
import { runAuthGuard } from './utils/auth-guard.js';

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }
      main {
        flex: 1;
      }
      .admin-banner {
        background: #ff0000;
        color: white;
        text-align: center;
        padding: 4px;
        font-size: 11px;
        font-weight: bold;
        position: sticky;
        top: 0;
        z-index: 2000;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
    `
  ];

  private _router = new Router(this, [
    { path: '/', render: () => html`<view-home></view-home>` },
    { path: '/search*', render: () => html`<view-search></view-search>` },
    { path: '/blogs*', render: () => html`<view-blogs></view-blogs>` },
    { path: '/discover*', render: () => html`<view-discover></view-discover>` },
    { path: '/post/:postId', render: ({ postId }) => html`<view-post .postId=${postId}></view-post>` },
    { path: '/clear-cache*', render: () => html`<view-clear-cache></view-clear-cache>` },
    { path: '/:blog/activity', render: ({ blog }) => html`<view-posts .blog=${blog}></view-posts>` },
    { path: '/:blog/feed', render: ({ blog }) => html`<view-feed .blog=${blog}></view-feed>` },
    { path: '/:blog/archive', render: ({ blog }) => html`<view-archive .blog=${blog}></view-archive>` },
    { path: '/:blog/social', render: ({ blog }) => html`<view-social .blog=${blog}></view-social>` },
  ]);

  @state() private lightboxOpen = false;
  @state() private lightboxPost: ProcessedPost | null = null;
  @state() private lightboxPosts: ProcessedPost[] = [];
  @state() private lightboxIndex = -1;
  @state() private contractErrors: string[] = [];

  constructor() {
    super();
    runAuthGuard();
    injectGlobalStyles();
    initTheme();
    const validation = validateRenderContract(loadRenderContract());
    if (!validation.ok) {
      this.contractErrors = validation.errors;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    syncAdminModeFromUrl();
    this.addEventListener('post-click', this.handlePostClick as any);
  }

  private handlePostClick(e: CustomEvent) {
    const { post, posts, index } = e.detail;
    const safePost = post as ProcessedPost | null;
    const safePosts = Array.isArray(posts) && posts.length > 0 ? posts : (safePost ? [safePost] : []);
    const safeIndex = Number.isFinite(index) ? index : 0;
    this.lightboxPost = safePost;
    this.lightboxPosts = safePosts;
    this.lightboxIndex = safeIndex;
    this.lightboxOpen = true;
  }

  private handleLightboxNavigate(e: CustomEvent) {
    const { index } = e.detail;
    if (index >= 0 && index < this.lightboxPosts.length) {
      this.lightboxPost = this.lightboxPosts[index];
      this.lightboxIndex = index;
    }
  }

  render() {
    if (this.contractErrors.length > 0) {
      return html`<contract-error-screen .errors=${this.contractErrors}></contract-error-screen>`;
    }

    // Determine current page for shared-nav highlighting
    const pathname = window.location.pathname;
    const isAdmin = isAdminMode();
    let currentPage: any = 'home';
    if (pathname.includes('/activity')) currentPage = 'timeline';
    else if (pathname.includes('/feed')) currentPage = 'following';
    else if (pathname.includes('/archive')) currentPage = 'archive';
    else if (pathname.includes('/search')) currentPage = 'search';
    else if (pathname.includes('/blogs')) currentPage = 'blogs';
    else if (pathname.includes('/social')) currentPage = 'social';

    return html`
      ${isAdmin ? html`<div class="admin-banner">Admin Mode Active (Suppressed posts visible)</div>` : ''}
      <offline-banner></offline-banner>
      <shared-nav .currentPage=${currentPage}></shared-nav>
      <main>${this._router.outlet()}</main>
      <post-lightbox
        .open=${this.lightboxOpen}
        .post=${this.lightboxPost}
        .posts=${this.lightboxPosts}
        .currentIndex=${this.lightboxIndex}
        @lightbox-close=${() => this.lightboxOpen = false}
        @lightbox-navigate=${this.handleLightboxNavigate}
      ></post-lightbox>

    `;
  }
}
