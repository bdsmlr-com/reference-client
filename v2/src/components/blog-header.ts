import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import {
  getPrimaryBlogName,
  buildPageUrl,
} from '../services/blog-resolver.js';
import { BREAKPOINTS, SPACING } from '../types/ui-constants.js';

type PageName = 'archive' | 'timeline' | 'social' | 'following';

/**
 * Unified blog header component (UX-001b).
 *
 * Consolidates the blog identity display into a single compact header:
 * - Blog selector pill with chevron (click to edit)
 * - Context badge ("Your blog" or "Viewing")
 * - Return action button (when viewing another blog)
 *
 * Layout: Single horizontal row, ~48px height (vs ~80px before)
 *
 * States:
 * 1. Viewing primary blog: [@blogname ▾] [Your blog]
 * 2. Viewing other blog: [@blogname ▾] [Viewing] [← Back to @primary]
 * 3. Edit mode: [input] [Go] [Cancel]
 *
 * Design spec: UX-001a in BACKLOG.md
 */
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
        align-items: center;
        justify-content: center;
        gap: ${SPACING.SM}px;
        padding: ${SPACING.SM}px ${SPACING.LG}px;
        flex-wrap: wrap;
      }

      /* Blog selector pill - the primary element */
      .blog-selector {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 8px 14px;
        font-size: 18px;
        font-weight: 600;
        color: var(--accent);
        background: var(--bg-panel-alt);
        border: 1px solid var(--border);
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
      }

      .blog-selector:hover {
        background: var(--bg-panel);
        border-color: var(--accent);
      }

      .blog-selector:focus {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      .chevron {
        font-size: 12px;
        color: var(--text-muted);
      }

      /* Context badge - "Your blog" style (subtle) */
      .context-badge {
        font-size: 12px;
        padding: 4px 10px;
        border-radius: 12px;
      }

      .context-badge.own {
        background: var(--bg-panel);
        color: var(--text-muted);
      }

      /* Context badge - "Viewing" style (highlighted) */
      .context-badge.other {
        background: color-mix(in srgb, var(--accent) 15%, var(--bg-panel));
        color: var(--accent);
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* Return action button */
      .return-action {
        font-size: 13px;
        color: var(--accent);
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: text-decoration 0.2s, background 0.2s;
      }

      .return-action:hover {
        text-decoration: underline;
        background: var(--bg-panel-alt);
      }

      .return-action:focus {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      /* Edit mode container */
      .edit-container {
        display: flex;
        align-items: center;
        gap: ${SPACING.XS}px;
        flex-wrap: wrap;
        justify-content: center;
      }

      .blog-input {
        padding: 8px 12px;
        font-size: 16px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--bg-panel);
        color: var(--text-primary);
        min-width: 200px;
        outline: none;
        transition: border-color 0.2s;
      }

      .blog-input:focus {
        border-color: var(--accent);
      }

      .btn {
        padding: 8px 14px;
        font-size: 14px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid var(--border);
        white-space: nowrap;
      }

      .btn-primary {
        background: var(--accent);
        color: white;
        border-color: var(--accent);
      }

      .btn-primary:hover {
        opacity: 0.9;
      }

      .btn-primary:focus {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      .btn-secondary {
        background: var(--bg-panel);
        color: var(--text-primary);
      }

      .btn-secondary:hover {
        background: var(--bg-panel-alt);
      }

      .btn-secondary:focus {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      /* External link in display mode */
      .external-link {
        font-size: 12px;
        color: var(--text-muted);
        text-decoration: none;
        padding: 4px 8px;
        border-radius: 4px;
        transition: color 0.2s, background 0.2s;
      }

      .external-link:hover {
        color: var(--accent);
        background: var(--bg-panel-alt);
      }

      /* Secondary row for badges and actions - always flex on desktop */
      .secondary-row {
        display: contents;
      }

      /* Mobile responsive: stack vertically */
      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE)}px) {
        .header-container {
          flex-direction: column;
          padding: ${SPACING.SM}px;
          gap: ${SPACING.SM}px;
        }

        .blog-selector {
          font-size: 16px;
          padding: 6px 12px;
        }

        .blog-input {
          min-width: 150px;
          font-size: 14px;
          width: 100%;
        }

        .edit-container {
          width: 100%;
        }

        .edit-container .btn {
          flex: 1;
          text-align: center;
        }

        /* Second row for badges/actions on mobile - explicit flex row */
        .secondary-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: ${SPACING.SM}px;
          flex-wrap: wrap;
        }

        .context-badge {
          font-size: 11px;
          padding: 3px 8px;
        }

        .return-action {
          font-size: 12px;
        }

        .external-link {
          font-size: 11px;
        }
      }
    `,
  ];

  /**
   * The page this header is displayed on.
   * Used to build navigation URLs when switching blogs.
   */
  @property({ type: String }) page: PageName = 'timeline';

  /**
   * The blog currently being viewed (from URL).
   */
  @property({ type: String }) blogName = '';

  /**
   * Optional blog title (shown in tooltip).
   */
  @property({ type: String }) blogTitle = '';

  /**
   * Whether the component is in edit mode.
   */
  @state() private editing = false;

  /**
   * The value in the edit input field.
   */
  @state() private inputValue = '';

  /**
   * Get the user's primary blog from localStorage.
   */
  private get primaryBlog(): string {
    return getPrimaryBlogName();
  }

  /**
   * Check if currently viewing a different blog than primary.
   */
  private get isViewingDifferent(): boolean {
    if (!this.primaryBlog || !this.blogName) {
      return false;
    }
    return this.primaryBlog.toLowerCase() !== this.blogName.toLowerCase();
  }

  /**
   * Build external blog URL.
   */
  private get externalBlogUrl(): string {
    return `https://${this.blogName}.bdsmlr.com`;
  }

  /**
   * Enter edit mode.
   */
  private enterEditMode(): void {
    this.editing = true;
    this.inputValue = this.blogName || '';
    // Focus input after render
    this.updateComplete.then(() => {
      const input = this.shadowRoot?.querySelector('.blog-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  /**
   * Cancel edit mode.
   */
  private cancelEdit(): void {
    this.editing = false;
    this.inputValue = '';
  }

  /**
   * Navigate to the entered blog.
   */
  private navigateToBlog(): void {
    const blogNameInput = this.inputValue.trim();
    if (!blogNameInput) {
      this.cancelEdit();
      return;
    }

    // Navigate to the new blog's page
    const url = buildPageUrl(this.page, blogNameInput);
    window.location.href = url;
  }

  /**
   * Navigate back to primary blog.
   */
  private resetToPrimary(): void {
    if (this.primaryBlog) {
      const url = buildPageUrl(this.page, this.primaryBlog);
      window.location.href = url;
    }
  }

  /**
   * Handle keydown in input - Enter to submit, Escape to cancel.
   */
  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.navigateToBlog();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelEdit();
    }
  }

  /**
   * Handle selector keydown - Enter/Space to open edit mode.
   */
  private handleSelectorKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.enterEditMode();
    }
  }

  /**
   * Handle input changes.
   */
  private handleInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.inputValue = input.value;
  }

  render() {
    // Don't render if no blog name
    if (!this.blogName) {
      return null;
    }

    const isOwnBlog = !this.isViewingDifferent;

    return html`
      <div class="header-container" role="region" aria-label="Blog header">
        ${this.editing
          ? html`
              <div class="edit-container">
                <input
                  type="text"
                  class="blog-input"
                  .value=${this.inputValue}
                  @input=${this.handleInput}
                  @keydown=${this.handleKeydown}
                  placeholder="Enter blog name..."
                  aria-label="Blog name"
                />
                <button
                  class="btn btn-primary"
                  @click=${this.navigateToBlog}
                  aria-label="Go to blog"
                >
                  Go
                </button>
                <button
                  class="btn btn-secondary"
                  @click=${this.cancelEdit}
                  aria-label="Cancel editing"
                >
                  Cancel
                </button>
              </div>
            `
          : html`
              <!-- Blog selector pill -->
              <button
                class="blog-selector"
                @click=${this.enterEditMode}
                @keydown=${this.handleSelectorKeydown}
                role="button"
                aria-expanded=${this.editing}
                aria-haspopup="dialog"
                aria-label="Blog: ${this.blogName}. Click to change."
                title=${this.blogTitle || `@${this.blogName}`}
              >
                @${this.blogName}
                <span class="chevron" aria-hidden="true">&#9662;</span>
              </button>

              <!-- Secondary row: Context badge, actions, and external link -->
              <div class="secondary-row">
                ${isOwnBlog
                  ? html`
                      <span
                        class="context-badge own"
                        aria-label="This is your primary blog"
                      >
                        Your blog
                      </span>
                    `
                  : html`
                      <span
                        class="context-badge other"
                        aria-label="Viewing another blog"
                      >
                        <span aria-hidden="true">&#128065;</span>
                        Viewing
                      </span>
                      <button
                        class="return-action"
                        @click=${this.resetToPrimary}
                        aria-label="Return to your blog: ${this.primaryBlog}"
                      >
                        &larr; Back to @${this.primaryBlog}
                      </button>
                    `}
                <!-- External link -->
                <a
                  class="external-link"
                  href=${this.externalBlogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit ${this.blogName}'s blog on BDSMLR (opens in new tab)"
                >
                  Visit &rarr;
                </a>
              </div>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blog-header': BlogHeader;
  }
}
