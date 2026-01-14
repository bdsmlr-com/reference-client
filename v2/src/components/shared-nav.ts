import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles, getStoredTheme, setStoredTheme, type Theme } from '../styles/theme.js';
import {
  getPrimaryBlogName,
  getViewedBlogName,
  buildPageUrl,
  isDevMode,
} from '../services/blog-resolver.js';
import { BREAKPOINTS } from '../types/ui-constants.js';

type PageName = 'search' | 'blogs' | 'archive' | 'timeline' | 'following' | 'social';

@customElement('shared-nav')
export class SharedNav extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        background: var(--bg-panel);
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 50; /* Z_INDEX.STICKY - below modals (1000) and dropdowns (100) */
      }

      .nav-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 8px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .logo {
        font-size: 16px;
        font-weight: 700;
        color: var(--accent);
        text-decoration: none;
      }

      .logo:hover {
        text-decoration: none;
        opacity: 0.9;
      }

      nav {
        display: flex;
        gap: 2px;
        flex-wrap: wrap;
      }

      .nav-link {
        padding: 6px 10px;
        border-radius: 4px;
        background: transparent;
        color: var(--text-muted);
        font-size: 13px;
        text-decoration: none;
        transition: all 0.2s;
      }

      .nav-link:hover {
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        text-decoration: none;
      }

      .nav-link.active {
        background: var(--accent);
        color: white;
      }

      .theme-toggle {
        padding: 6px 10px;
        border-radius: 4px;
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        font-size: 16px;
        transition: background 0.2s;
        min-width: 36px;
        min-height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .theme-toggle:hover {
        background: var(--border-strong);
      }

      /* Indicator shown when viewing a different blog than primary */
      .viewing-indicator {
        font-size: 11px;
        color: var(--text-muted);
        background: var(--bg-panel-alt);
        padding: 2px 8px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      }

      .viewing-indicator .blog-name {
        color: var(--accent);
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .viewing-indicator .reset-link {
        color: var(--text-muted);
        text-decoration: underline;
        cursor: pointer;
        font-size: 10px;
      }

      .viewing-indicator .reset-link:hover {
        color: var(--accent);
      }

      /* BREAKPOINTS.MOBILE (480px) - standardized responsive breakpoint */
      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE)}px) {
        .nav-container {
          flex-wrap: wrap;
          justify-content: center;
        }

        .logo {
          width: 100%;
          text-align: center;
          margin-bottom: 4px;
        }

        nav {
          justify-content: center;
        }
      }
    `,
  ];

  @property({ type: String }) currentPage: PageName = 'search';
  @state() private theme: Theme = getStoredTheme();

  private toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    setStoredTheme(this.theme);
  }

  /**
   * Get URL for a page nav link.
   *
   * NAV-007 fix: Blog-specific pages (following, timeline, archive, social) now use
   * the PRIMARY blog from localStorage, not the currently viewed blog from URL.
   * This ensures nav links always take you to YOUR blog's pages, not the blog you
   * happen to be viewing.
   */
  private getPageUrl(page: PageName): string {
    // Use PRIMARY blog (from localStorage) for blog-specific pages
    const primaryBlog = getPrimaryBlogName();
    const blogPages = ['archive', 'timeline', 'following', 'social'];

    if (blogPages.includes(page) && primaryBlog) {
      return buildPageUrl(page, primaryBlog);
    }
    return buildPageUrl(page);
  }

  private getHomeUrl(): string {
    return isDevMode() ? 'home.html' : '/';
  }

  /**
   * Check if currently viewing a different blog than the primary one.
   */
  private isViewingDifferentBlog(): boolean {
    const primaryBlog = getPrimaryBlogName();
    const viewedBlog = getViewedBlogName();

    // If no primary blog set, or no blog being viewed, no indicator needed
    if (!primaryBlog || !viewedBlog) {
      return false;
    }

    return primaryBlog.toLowerCase() !== viewedBlog.toLowerCase();
  }

  /**
   * Handle click on "back to primary" link - navigates to primary blog's version
   * of the current page.
   */
  private handleBackToPrimary(): void {
    const primaryBlog = getPrimaryBlogName();
    if (primaryBlog) {
      const url = buildPageUrl(this.currentPage, primaryBlog);
      window.location.href = url;
    }
  }

  render() {
    const pages: { name: PageName; label: string; description: string }[] = [
      { name: 'following', label: 'My Feed', description: "Posts from blogs you follow - your dashboard feed" },
      { name: 'timeline', label: 'Blog Posts', description: "A blog's posts in chronological order" },
      { name: 'archive', label: 'Browse', description: "Browse and sort all posts from a blog" },
      { name: 'social', label: 'Connections', description: "View who follows a blog and who they follow" },
      { name: 'blogs', label: 'Discover', description: 'Discover blogs by name or description' },
      { name: 'search', label: 'Search', description: 'Search posts by tags with boolean syntax' },
    ];

    const viewedBlog = getViewedBlogName();
    const showViewingIndicator = this.isViewingDifferentBlog();

    return html`
      <header class="nav-container">
        <a href=${this.getHomeUrl()} class="logo" title="Developer home and quickstart guide" aria-label="BDSMLR Home">BDSMLR</a>
        <nav aria-label="Main navigation">
          ${pages.map(
            (page) => html`
              <a
                href=${this.getPageUrl(page.name)}
                class="nav-link ${this.currentPage === page.name ? 'active' : ''}"
                title=${page.description}
                aria-current=${this.currentPage === page.name ? 'page' : 'false'}
              >
                ${page.label}
              </a>
            `
          )}
        </nav>
        ${showViewingIndicator
          ? html`
              <span class="viewing-indicator" title="You're viewing another blog - nav links go to your primary blog">
                <span aria-hidden="true">👁️</span>
                <span class="blog-name">@${viewedBlog}</span>
                <span
                  class="reset-link"
                  @click=${this.handleBackToPrimary}
                  role="button"
                  tabindex="0"
                  aria-label="Go back to your primary blog"
                  @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.handleBackToPrimary()}
                >back</span>
              </span>
            `
          : ''}
        <button
          class="theme-toggle"
          @click=${this.toggleTheme}
          title="Toggle theme"
          aria-label=${this.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          <span aria-hidden="true">${this.theme === 'dark' ? '☀️' : '🌙'}</span>
        </button>
      </header>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'shared-nav': SharedNav;
  }
}
