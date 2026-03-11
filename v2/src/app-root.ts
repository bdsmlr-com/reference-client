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
import './pages/view-clear-cache.js';
import './components/shared-nav.js';
import './components/offline-banner.js';
import './components/post-lightbox.js';
import { initTheme, injectGlobalStyles, baseStyles } from './styles/theme.js';
import type { ProcessedPost } from './types/post.js';

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
    `
  ];

  private _router = new Router(this, [
    { path: '/', render: () => html`<view-home></view-home>` },
    { path: '/search*', render: () => html`<view-search></view-search>` },
    { path: '/blogs*', render: () => html`<view-blogs></view-blogs>` },
    { path: '/discover*', render: () => html`<view-discover></view-discover>` },
    { path: '/clear-cache*', render: () => html`<view-clear-cache></view-clear-cache>` },
    { path: '/:blog/posts', render: ({ blog }) => html`<view-posts .blog=${blog}></view-posts>` },
    { path: '/:blog/feed', render: ({ blog }) => html`<view-feed .blog=${blog}></view-feed>` },
    { path: '/:blog/archive', render: ({ blog }) => html`<view-archive .blog=${blog}></view-archive>` },
    { path: '/:blog/social', render: ({ blog }) => html`<view-social .blog=${blog}></view-social>` },
  ]);

  @state() private lightboxOpen = false;
  @state() private lightboxPost: ProcessedPost | null = null;
  @state() private lightboxPosts: ProcessedPost[] = [];
  @state() private lightboxIndex = -1;

  constructor() {
    super();
    injectGlobalStyles();
    initTheme();
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('post-click', this.handlePostClick as any);
  }

  private handlePostClick(e: CustomEvent) {
    const { post, posts, index } = e.detail;
    this.lightboxPost = post;
    this.lightboxPosts = posts;
    this.lightboxIndex = index;
    this.lightboxOpen = true;
  }

  private handleLightboxClose() {
    this.lightboxOpen = false;
  }

  private handleLightboxNavigate(e: CustomEvent) {
    const { index } = e.detail;
    if (index >= 0 && index < this.lightboxPosts.length) {
      this.lightboxPost = this.lightboxPosts[index];
      this.lightboxIndex = index;
    }
  }

  render() {
    // Determine current page for shared-nav highlighting
    const pathname = window.location.pathname;
    let currentPage: any = 'home';
    if (pathname.includes('/posts')) currentPage = 'timeline';
    else if (pathname.includes('/feed')) currentPage = 'following';
    else if (pathname.includes('/archive')) currentPage = 'archive';
    else if (pathname.includes('/search')) currentPage = 'search';
    else if (pathname.includes('/blogs')) currentPage = 'blogs';
    else if (pathname.includes('/social')) currentPage = 'social';

    return html`
      <offline-banner></offline-banner>
      <shared-nav .currentPage=${currentPage}></shared-nav>
      <main>${this._router.outlet()}</main>
      <post-lightbox
        ?open=${this.lightboxOpen}
        .post=${this.lightboxPost}
        .posts=${this.lightboxPosts}
        .currentIndex=${this.lightboxIndex}
        @close=${this.handleLightboxClose}
        @navigate=${this.handleLightboxNavigate}
      ></post-lightbox>
    `;
  }
}
