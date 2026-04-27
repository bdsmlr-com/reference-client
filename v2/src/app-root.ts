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
import './pages/view-post-related.js';
import './pages/view-clear-cache.js';
import './pages/view-settings-user.js';
import './pages/view-settings-blog.js';
import './components/shared-nav.js';
import './components/offline-banner.js';
import './components/post-lightbox.js';
import './components/contract-error-screen.js';
import { initTheme, injectGlobalStyles, baseStyles } from './styles/theme.js';
import type { ProcessedPost } from './types/post.js';
import { getPrimaryBlogName, getViewedBlogName, isAdminMode, syncAdminModeFromUrl } from './services/blog-resolver.js';
import { loadRenderContract } from './services/render-contract.js';
import { validateRenderContract } from './services/render-contract-validator.js';
import { getStatus } from './services/auth-service.js';
import { setAuthUser, clearAuthUser } from './state/auth-state.js';
import { setCurrentUsername } from './services/profile.js';
import { setStoredBlogName } from './services/blog-resolver.js';
import { getStoredActiveBlog, setStoredActiveBlog } from './utils/storage.js';
import './components/auth-gate.js';

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
    { path: '/search', render: () => html`<view-search></view-search>` },
    { path: '/search/for/you', render: () => html`<view-search></view-search>` },
    { path: '/search/for/:blogname', render: () => html`<view-search></view-search>` },
    { path: '/for/you', render: () => html`<view-discover .blog=${this.resolveRouteBlogName('you')}></view-discover>` },
    { path: '/for/:blogname', render: ({ blogname }) => html`<view-discover .blog=${this.resolveRouteBlogName(blogname || '')}></view-discover>` },
    { path: '/blogs*', render: () => html`<view-blogs></view-blogs>` },
    { path: '/discover*', render: () => html`<view-discover></view-discover>` },
    { path: '/post/:postId', render: ({ postId }) => html`<view-post .postId=${postId}></view-post>` },
    {
      path: '/post/:postId/related',
      render: ({ postId }) => html`<view-post-related .postId=${postId} .title=${'More like this ✨'}></view-post-related>`,
    },
    {
      path: '/post/:postId/related/for/you',
      render: ({ postId }) => html`<view-post-related .postId=${postId} .perspectiveBlogName=${this.resolveRouteBlogName('you')} .title=${`More like this for you ✨`}></view-post-related>`,
    },
    {
      path: '/post/:postId/related/for/:blogname',
      render: ({ postId, blogname }) => html`<view-post-related .postId=${postId} .perspectiveBlogName=${this.resolveRouteBlogName(blogname || '')} .title=${`More like this for ${this.resolveRouteBlogName(blogname || '')} ✨`}></view-post-related>`,
    },
    { path: '/clear-cache*', render: () => html`<view-clear-cache></view-clear-cache>` },
    { path: '/feed/for/you', render: () => html`<view-feed .blog=${this.resolveRouteBlogName('you')}></view-feed>` },
    { path: '/feed/for/:blogname', render: ({ blogname }) => html`<view-feed .blog=${this.resolveRouteBlogName(blogname || '')}></view-feed>` },
    { path: '/follower-feed/you', render: () => html`<view-feed .blog=${this.resolveRouteBlogName('you')} .mode=${'followers'}></view-feed>` },
    { path: '/follower-feed/:blogname', render: ({ blogname }) => html`<view-feed .blog=${this.resolveRouteBlogName(blogname || '')} .mode=${'followers'}></view-feed>` },
    { path: '/activity/you', render: () => html`<view-posts .blog=${this.resolveRouteBlogName('you')}></view-posts>` },
    { path: '/activity/:blogname', render: ({ blogname }) => html`<view-posts .blog=${this.resolveRouteBlogName(blogname || '')}></view-posts>` },
    { path: '/archive/you', render: () => html`<view-archive .blog=${this.resolveRouteBlogName('you')}></view-archive>` },
    { path: '/archive/:blogname', render: ({ blogname }) => html`<view-archive .blog=${this.resolveRouteBlogName(blogname || '')}></view-archive>` },
    { path: '/settings/you', render: () => html`<view-settings-user></view-settings-user>` },
    { path: '/settings/:blogname', render: ({ blogname }) => html`<view-settings-blog .blog=${this.resolveRouteBlogName(blogname || '')}></view-settings-blog>` },
    { path: '/social/you', render: () => html`<view-social .blog=${this.resolveRouteBlogName('you')}></view-social>` },
    { path: '/social/:blogname', render: ({ blogname }) => html`<view-social .blog=${this.resolveRouteBlogName(blogname || '')}></view-social>` },
    { path: '/:blog/archive', render: ({ blog }) => html`<view-archive .blog=${blog}></view-archive>` },
    { path: '/:blog/activity', render: ({ blog }) => html`<view-posts .blog=${blog}></view-posts>` },
    { path: '/:blog/feed', render: ({ blog }) => html`<view-feed .blog=${blog}></view-feed>` },
    { path: '/:blog/social', render: ({ blog }) => html`<view-social .blog=${blog}></view-social>` },
  ]);

  @state() private lightboxOpen = false;
  @state() private lightboxPost: ProcessedPost | null = null;
  @state() private lightboxPosts: ProcessedPost[] = [];
  @state() private lightboxIndex = -1;
  @state() private contractErrors: string[] = [];
  @state() private authError: string | null = null;
  @state() private authenticated = false;
  @state() private checkingAuth = true;

  constructor() {
    super();
    injectGlobalStyles();
    initTheme();
    this.checkAuth();
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

  private async checkAuth() {
    this.checkingAuth = true;
    this.authError = null;
    try {
      const status = await getStatus();
      const blogs = status.blogs || [];
      const storedActive = getStoredActiveBlog(status.user_id);
      const primaryId = status.primary_blog_id || (blogs[0]?.id ?? status.blog_id ?? null);
      const activeBlogId = blogs.find((b) => b.id === storedActive)?.id || primaryId || status.blog_id || null;
      const activeBlogName =
        blogs.find((b) => b.id === activeBlogId)?.name ||
        status.blog_name ||
        blogs[0]?.name ||
        null;

      if (activeBlogId && status.user_id) {
        setStoredActiveBlog(status.user_id, activeBlogId);
      }
      if (activeBlogName) {
        setStoredBlogName(activeBlogName);
        setCurrentUsername(activeBlogName);
      } else if (status.username) {
        setCurrentUsername(status.username);
      }

      setAuthUser({
        userId: status.user_id,
        blogId: activeBlogId,
        blogName: activeBlogName,
        username: status.username || null,
        blogs,
        primaryBlogId: primaryId,
        activeBlogId,
        activeBlogName,
      });
      this.authenticated = true;

      if (window.location.pathname === '/' && activeBlogName) {
        window.location.replace(`/${activeBlogName}/activity`);
      }
    } catch (err: any) {
      this.authError = 'Login required';
      clearAuthUser();
      this.authenticated = false;
    } finally {
      this.checkingAuth = false;
    }
  }

  private async handleRetryAuth() {
    await this.checkAuth();
    if (!this.authenticated) this.requestUpdate();
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
    if (this.checkingAuth) {
      return html``;
    }

    if (!this.authenticated) {
      const env = (import.meta as any).env || {};
      const loginUrl = env.VITE_LOGIN_URL || 'https://bdsmlr.com/login';
      return html`<auth-gate .message=${this.authError} .loginUrl=${loginUrl} @auth-retry=${this.handleRetryAuth}></auth-gate>`;
    }

    if (this.contractErrors.length > 0) {
      return html`<contract-error-screen .errors=${this.contractErrors}></contract-error-screen>`;
    }

    // Determine current page for shared-nav highlighting
    const pathname = window.location.pathname;
    const isAdmin = isAdminMode();
    let currentPage: any = 'home';
    if (pathname.includes('/activity')) currentPage = 'timeline';
    else if (pathname.includes('/follower-feed')) currentPage = 'follower-feed';
    else if (pathname.includes('/feed')) currentPage = 'following';
    else if (pathname.includes('/archive')) currentPage = 'archive';
    else if (pathname.includes('/search')) currentPage = 'search';
    else if (pathname.startsWith('/for/')) currentPage = 'blogs';
    else if (pathname.includes('/blogs')) currentPage = 'blogs';
    else if (pathname.includes('/social')) currentPage = 'social';
    else if (pathname.includes('/settings')) currentPage = 'settings';

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

  private resolveRouteBlogName(blogname: string): string {
    if (blogname.toLowerCase() === 'you') {
      return getPrimaryBlogName() || getViewedBlogName() || '';
    }
    return blogname;
  }
}
