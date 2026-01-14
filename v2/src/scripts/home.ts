import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { initTheme, injectGlobalStyles, baseStyles } from '../styles/theme.js';
import { setStoredBlogName, getStoredBlogName, buildPageUrl, buildBlogPageUrl, isReservedPageRoute } from '../services/blog-resolver.js';
import { BREAKPOINTS } from '../types/ui-constants.js';
import '../components/shared-nav.js';
import '../components/offline-banner.js';

// Initialize theme immediately to prevent FOUC (Flash of Unstyled Content)
injectGlobalStyles();
initTheme();

interface PageCard {
  name: string;
  href: string;
  description: string;
  apis: string[];
}

const MAIN_CARDS: PageCard[] = [
  {
    name: 'Search',
    href: 'search.html',
    description: 'Search posts by tags. Supports boolean syntax: AND (space), NOT (-), "exact phrase", (groups).',
    apis: ['searchPostsByTag'],
  },
  {
    name: 'Blogs',
    href: 'blogs.html',
    description: 'Discover blogs by name, title, or description. Sort by followers, posts, name, or date.',
    apis: ['searchBlogs'],
  },
  {
    name: 'Archive',
    href: 'archive.html',
    description: 'Browse all posts from a specific blog in a sortable grid. Filter by type.',
    apis: ['resolveIdentifier', 'listBlogPosts'],
  },
  {
    name: 'Timeline',
    href: 'timeline.html',
    description: 'View a blog\'s posts chronologically (newest first). Full-width cards.',
    apis: ['resolveIdentifier', 'listBlogPosts'],
  },
  {
    name: 'For You',
    href: 'following.html',
    description: 'See posts from blogs that a given blog follows - their "dashboard" view.',
    apis: ['resolveIdentifier', 'blogFollowGraph', 'listBlogsRecentActivity'],
  },
  {
    name: 'Social',
    href: 'social.html',
    description: 'View who follows a blog and who they follow. Navigate to discover new blogs.',
    apis: ['resolveIdentifier', 'blogFollowGraph'],
  },
];


@customElement('home-page')
export class HomePage extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--bg-primary);
      }

      .content {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px 16px;
      }

      .hero {
        text-align: center;
        padding: 40px 16px 24px;
      }

      .hero h1 {
        font-size: 32px;
        color: var(--accent);
        margin-bottom: 12px;
      }

      .hero p {
        font-size: 16px;
        color: var(--text-muted);
        max-width: 600px;
        margin: 0 auto;
      }

      .blog-cta {
        max-width: 500px;
        margin: 0 auto 40px;
        padding: 24px;
        background: var(--bg-panel);
        border: 2px solid var(--accent);
        border-radius: 12px;
      }

      .blog-cta label {
        display: block;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 12px;
        text-align: center;
      }

      .cta-input-row {
        display: flex;
        gap: 12px;
      }

      .blog-cta input {
        flex: 1;
        padding: 14px 18px;
        border-radius: 8px;
        border: 2px solid var(--border-strong);
        background: var(--bg-primary);
        color: var(--text-primary);
        font-size: 16px;
      }

      .blog-cta input:focus {
        outline: none;
        border-color: var(--accent);
      }

      .blog-cta input::placeholder {
        color: var(--text-muted);
      }

      .blog-cta button {
        padding: 14px 28px;
        border-radius: 8px;
        background: var(--accent);
        color: white;
        font-size: 16px;
        font-weight: 600;
        transition: background 0.2s;
        white-space: nowrap;
      }

      .blog-cta button:hover {
        background: var(--accent-hover);
      }

      .cta-help {
        font-size: 13px;
        color: var(--text-muted);
        margin-top: 12px;
        text-align: center;
      }

      .section {
        margin-bottom: 40px;
      }

      .section-title {
        font-size: 20px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 16px;
        padding-left: 4px;
      }

      .cards-grid {
        display: grid;
        grid-template-columns: repeat(1, 1fr);
        gap: 16px;
      }

      /* Tablet: 2 columns (BREAKPOINTS.MOBILE = 480px) */
      @media (min-width: ${unsafeCSS(BREAKPOINTS.MOBILE)}px) {
        .cards-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      /* Large desktop: 3 columns (BREAKPOINTS.LARGE_DESKTOP = 900px) */
      @media (min-width: ${unsafeCSS(BREAKPOINTS.LARGE_DESKTOP)}px) {
        .cards-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      /* Extra large: 4 columns (BREAKPOINTS.EXTRA_LARGE = 1200px) */
      @media (min-width: ${unsafeCSS(BREAKPOINTS.EXTRA_LARGE)}px) {
        .cards-grid {
          grid-template-columns: repeat(4, 1fr);
        }
      }

      .page-card {
        background: var(--bg-panel);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .page-card:hover {
        border-color: var(--border-strong);
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .card-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .card-title a {
        color: var(--accent);
        text-decoration: none;
      }

      .card-title a:hover {
        text-decoration: underline;
      }

      .card-description {
        font-size: 13px;
        color: var(--text-muted);
        line-height: 1.5;
        flex: 1;
      }

      details {
        margin-top: auto;
      }

      summary {
        font-size: 12px;
        color: var(--text-muted);
        cursor: pointer;
        user-select: none;
        padding: 4px 0;
      }

      summary:hover {
        color: var(--text-primary);
      }

      .api-list {
        margin-top: 8px;
        padding: 8px;
        background: var(--bg-panel-alt);
        border-radius: 4px;
      }

      .api-item {
        font-family: monospace;
        font-size: 12px;
        color: var(--accent);
        padding: 2px 0;
      }

      /* Mobile: max-width below BREAKPOINTS.MOBILE */
      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {
        .cta-input-row {
          flex-direction: column;
        }
      }
    `,
  ];

  @state() private blogName = '';

  connectedCallback(): void {
    super.connectedCallback();
    // Priority: URL param (override) > localStorage > default
    // URL param is used as override for navigation links that pass ?blog=
    const params = new URLSearchParams(window.location.search);
    const urlBlog = params.get('blog');

    if (urlBlog && !isReservedPageRoute(urlBlog)) {
      // URL param provided with valid blog name - use it and persist to localStorage
      this.blogName = urlBlog;
      setStoredBlogName(urlBlog);
    } else {
      // No URL param or reserved route - load from localStorage, default to 'nonnudecuties' if not set
      // Also filter out reserved routes from localStorage (in case of stale bad data)
      const storedBlog = getStoredBlogName();
      this.blogName = (storedBlog && !isReservedPageRoute(storedBlog)) ? storedBlog : 'nonnudecuties';
    }
  }

  private getCardHref(card: PageCard): string {
    // For pages that need blog param, use path-based routing
    const blogPages = ['archive.html', 'timeline.html', 'following.html', 'social.html'];
    const pageName = card.href.replace('.html', '');
    if (this.blogName && blogPages.includes(card.href)) {
      return buildBlogPageUrl(this.blogName, pageName);
    }
    return buildPageUrl(pageName);
  }

  private handleKeyPress(e: KeyboardEvent): void {
    if (e.key === 'Enter' && this.blogName.trim()) {
      this.navigateToTimeline();
    }
  }

  private handleExplore(): void {
    if (this.blogName.trim()) {
      this.navigateToTimeline();
    }
  }

  private navigateToTimeline(): void {
    const blogName = this.blogName.trim();
    // Save to localStorage before navigating
    setStoredBlogName(blogName);
    window.location.href = buildBlogPageUrl(blogName, 'timeline');
  }

  private renderCard(card: PageCard) {
    return html`
      <div class="page-card">
        <div class="card-header">
          <span class="card-title">
            <a href=${this.getCardHref(card)}>${card.name}</a>
          </span>
        </div>
        <p class="card-description">${card.description}</p>
        <details>
          <summary>API Details</summary>
          <div class="api-list">
            ${card.apis.map((api) => html`<div class="api-item">${api}</div>`)}
          </div>
        </details>
      </div>
    `;
  }

  render() {
    return html`
      <offline-banner></offline-banner>
      <shared-nav currentPage="home"></shared-nav>

      <div class="content">
        <div class="hero">
          <h1>BDSMLR Reference Client</h1>
          <p>
            A developer reference implementation demonstrating the BDSMLR API.
            Each page below showcases different API endpoints and usage patterns.
          </p>
        </div>

        <div class="blog-cta">
          <label>Enter a blog name to explore</label>
          <div class="cta-input-row">
            <input
              type="text"
              placeholder="e.g., canadiandominant"
              .value=${this.blogName}
              @input=${(e: Event) => (this.blogName = (e.target as HTMLInputElement).value)}
              @keypress=${this.handleKeyPress}
            />
            <button @click=${this.handleExplore}>Explore</button>
          </div>
          <p class="cta-help">
            The blog name will be passed to Archive, Timeline, For You, and Social pages.
          </p>
        </div>

        <div class="section">
          <h2 class="section-title">Main Views</h2>
          <div class="cards-grid">
            ${MAIN_CARDS.map((card) => this.renderCard(card))}
          </div>
        </div>
      </div>
    `;
  }
}

// Initialize app (theme already initialized at top of module)
const app = document.createElement('home-page');
document.body.appendChild(app);
