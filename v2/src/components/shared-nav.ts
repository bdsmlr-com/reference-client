import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles, getStoredTheme, setStoredTheme, type Theme } from '../styles/theme.js';

type PageName = 'search' | 'archive' | 'timeline' | 'activity' | 'social';

@customElement('shared-nav')
export class SharedNav extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        background: var(--bg-panel);
        border-bottom: 1px solid var(--border);
      }

      .nav-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
      }

      .logo {
        font-size: 20px;
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
        gap: 4px;
        flex-wrap: wrap;
      }

      .nav-link {
        padding: 8px 16px;
        border-radius: 6px;
        background: transparent;
        color: var(--text-muted);
        font-size: 14px;
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
        padding: 8px 12px;
        border-radius: 6px;
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        font-size: 18px;
        transition: background 0.2s;
        min-width: 44px;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .theme-toggle:hover {
        background: var(--border-strong);
      }

      @media (max-width: 480px) {
        .nav-container {
          flex-direction: column;
          align-items: stretch;
        }

        .logo {
          text-align: center;
        }

        nav {
          justify-content: center;
        }

        .theme-toggle {
          align-self: center;
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

  private getPageUrl(page: PageName): string {
    const blogParam = new URLSearchParams(window.location.search).get('blog');
    // Preserve current blog parameter for archive and timeline links
    if (page === 'archive' || page === 'timeline') {
      return blogParam ? `${page}.html?blog=${blogParam}` : `${page}.html`;
    }
    return `${page}.html`;
  }

  render() {
    const pages: { name: PageName; label: string }[] = [
      { name: 'search', label: 'Search' },
      { name: 'archive', label: 'Archive' },
      { name: 'timeline', label: 'Timeline' },
      { name: 'activity', label: 'Activity' },
      { name: 'social', label: 'Social' },
    ];

    return html`
      <div class="nav-container">
        <a href="search.html" class="logo">BDSMLR</a>
        <nav>
          ${pages.map(
            (page) => html`
              <a
                href=${this.getPageUrl(page.name)}
                class="nav-link ${this.currentPage === page.name ? 'active' : ''}"
              >
                ${page.label}
              </a>
            `
          )}
        </nav>
        <button class="theme-toggle" @click=${this.toggleTheme} title="Toggle theme">
          ${this.theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'shared-nav': SharedNav;
  }
}
