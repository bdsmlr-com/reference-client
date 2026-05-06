import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { buildPageUrl } from '../services/blog-resolver.js';
import { BREAKPOINTS, SPACING } from '../types/ui-constants.js';
import type { IdentityDecoration } from '../types/api.js';
import './blog-identity.js';

type PageName = 'archive' | 'timeline' | 'social' | 'following' | 'activity' | 'feed' | 'follower-feed';

@customElement('blog-header')
export class BlogHeader extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        margin-bottom: ${SPACING.LG}px;
      }

      .header-container {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: ${SPACING.SM}px ${SPACING.LG}px;
      }

      blog-identity {
        max-width: min(100%, 900px);
      }

      .subnav {
        display: flex;
        justify-content: center;
        gap: 6px;
        flex-wrap: wrap;
        padding: 0 ${SPACING.LG}px;
        margin-top: ${SPACING.XS}px;
      }

      .subnav-link {
        padding: 6px 10px;
        border-radius: 4px;
        background: transparent;
        color: var(--text-muted);
        font-size: 13px;
        text-decoration: none;
        transition: all 0.2s;
      }

      .subnav-link:hover {
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        text-decoration: none;
      }

      .subnav-link.active {
        background: var(--accent);
        color: #fff;
      }

      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE)}px) {
        .header-container {
          padding: ${SPACING.SM}px;
        }

        .subnav {
          padding: 0 ${SPACING.SM}px;
        }
      }
    `,
  ];

  @property({ type: String }) page: PageName = 'timeline';
  @property({ type: String }) blogName = '';
  @property({ type: String }) blogTitle = '';
  @property({ type: String }) blogDescription = '';
  @property({ type: String }) avatarUrl = '';
  @property({ attribute: false }) identityDecorations: IdentityDecoration[] = [];

  private getSubnavUrl(page: string, blogName: string): string {
    if (page === 'feed') return `/feed/for/${blogName}`;
    if (page === 'follower-feed') return `/follower-feed/${blogName}`;
    if (page === 'activity') return `/activity/${blogName}`;
    if (page === 'archive') return `/archive/${blogName}`;
    if (page === 'social') return `/social/${blogName}/followers`;
    return buildPageUrl(page, blogName);
  }

  render() {
    if (!this.blogName) {
      return null;
    }

    const activePage =
      this.page === 'timeline'
        ? 'activity'
        : (this.page === 'following' ? 'feed' : this.page);
    const navPages = [
      { name: 'feed', label: 'Feed' },
      { name: 'follower-feed', label: "Followers' Feed" },
      { name: 'activity', label: 'Activity' },
      { name: 'archive', label: 'Archive' },
      { name: 'social', label: 'Connections' },
    ];

    return html`
      <div role="region" aria-label="Blog header">
        <div class="header-container">
          <blog-identity
            variant="header"
            .blogName=${this.blogName}
            .blogTitle=${this.blogTitle}
            .blogDescription=${this.blogDescription}
            .avatarUrl=${this.avatarUrl}
            .identityDecorations=${this.identityDecorations}
          ></blog-identity>
        </div>
        <nav class="subnav" aria-label="Blog navigation">
          ${navPages.map((page) => {
            const href = this.getSubnavUrl(page.name, this.blogName);
            return html`
              <a class="subnav-link ${activePage === page.name ? 'active' : ''}" href=${href}>
                ${page.label}
              </a>
            `;
          })}
        </nav>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blog-header': BlogHeader;
  }
}
