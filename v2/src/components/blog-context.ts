import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import {
  getPrimaryBlogName,
  buildPageUrl,
} from '../services/blog-resolver.js';
import { BREAKPOINTS, SPACING } from '../types/ui-constants.js';

type PageName = 'archive' | 'timeline' | 'social' | 'following' | 'masquerade';

/**
 * Blog context control component (BLOG-CTX-001).
 *
 * When viewing another blog (not primary), this component shows:
 * 1. Visual alert-style indicator that you're viewing a different blog
 * 2. Reset button to return to primary blog
 * 3. Click-to-edit that turns text into textfield to navigate to any blog
 *
 * My Feed should be PINNED to primary user always.
 * Blog Posts, Browse, and Connections should support this editable context.
 */
@customElement('blog-context')
export class BlogContext extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        margin-bottom: ${SPACING.LG}px;
      }

      /* Hide when not viewing a different blog and not in edit mode */
      :host([hidden]) {
        display: none;
      }

      .context-container {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: ${SPACING.SM}px;
        padding: ${SPACING.SM}px ${SPACING.LG}px;
        background: var(--bg-panel-alt);
        border: 1px solid var(--border);
        border-radius: 8px;
        max-width: 600px;
        margin: 0 auto;
        flex-wrap: wrap;
      }

      /* Alert style when viewing a different blog */
      .context-container.alert {
        background: color-mix(in srgb, var(--accent) 10%, var(--bg-panel-alt));
        border-color: var(--accent);
      }

      .viewing-label {
        font-size: 12px;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .blog-name-display {
        font-size: 16px;
        font-weight: 600;
        color: var(--accent);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s;
      }

      .blog-name-display:hover {
        background: var(--bg-panel);
      }

      .blog-name-display .edit-hint {
        font-size: 10px;
        color: var(--text-muted);
        opacity: 0;
        transition: opacity 0.2s;
      }

      .blog-name-display:hover .edit-hint {
        opacity: 1;
      }

      /* Edit mode input */
      .edit-container {
        display: flex;
        align-items: center;
        gap: ${SPACING.XS}px;
      }

      .blog-input {
        padding: 6px 12px;
        font-size: 14px;
        border: 1px solid var(--border);
        border-radius: 4px;
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
        padding: 6px 12px;
        font-size: 12px;
        border-radius: 4px;
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

      .btn-secondary {
        background: var(--bg-panel);
        color: var(--text-primary);
      }

      .btn-secondary:hover {
        background: var(--bg-panel-alt);
      }

      .btn-reset {
        background: transparent;
        color: var(--text-muted);
        border: none;
        font-size: 11px;
        text-decoration: underline;
        padding: 4px 8px;
      }

      .btn-reset:hover {
        color: var(--accent);
      }

      .primary-badge {
        font-size: 10px;
        color: var(--text-muted);
        background: var(--bg-panel);
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 4px;
      }

      /* Separator */
      .separator {
        width: 1px;
        height: 20px;
        background: var(--border);
        margin: 0 ${SPACING.XS}px;
      }

      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE)}px) {
        .context-container {
          padding: ${SPACING.SM}px;
          gap: ${SPACING.XS}px;
        }

        .viewing-label {
          width: 100%;
          justify-content: center;
        }

        .blog-input {
          min-width: 150px;
        }

        .separator {
          display: none;
        }
      }
    `,
  ];

  /**
   * The page this context is displayed on.
   * Used to build navigation URLs.
   */
  @property({ type: String }) page: PageName = 'timeline';

  /**
   * The blog currently being viewed (from URL).
   */
  @property({ type: String }) viewedBlog = '';

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
    if (!this.primaryBlog || !this.viewedBlog) {
      return false;
    }
    return this.primaryBlog.toLowerCase() !== this.viewedBlog.toLowerCase();
  }

  /**
   * Enter edit mode.
   */
  private enterEditMode(): void {
    this.editing = true;
    this.inputValue = this.viewedBlog || '';
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
    const blogName = this.inputValue.trim();
    if (!blogName) {
      this.cancelEdit();
      return;
    }

    // Navigate to the new blog's page
    const url = buildPageUrl(this.page, blogName);
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
   * Handle input changes.
   */
  private handleInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.inputValue = input.value;
  }

  render() {
    // Don't show if no blog is being viewed
    if (!this.viewedBlog) {
      return null;
    }

    const showAlert = this.isViewingDifferent;

    return html`
      <div class="context-container ${showAlert ? 'alert' : ''}" role="region" aria-label="Blog context">
        ${showAlert
          ? html`
              <span class="viewing-label" aria-hidden="true">
                <span>Viewing:</span>
              </span>
            `
          : html`
              <span class="viewing-label" aria-hidden="true">
                <span>Blog:</span>
              </span>
            `}

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
                <button class="btn btn-primary" @click=${this.navigateToBlog} aria-label="Go to blog">
                  Go
                </button>
                <button class="btn btn-secondary" @click=${this.cancelEdit} aria-label="Cancel editing">
                  Cancel
                </button>
              </div>
            `
          : html`
              <span
                class="blog-name-display"
                @click=${this.enterEditMode}
                @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.enterEditMode()}
                role="button"
                tabindex="0"
                aria-label="Click to change blog: ${this.viewedBlog}"
              >
                @${this.viewedBlog}
                <span class="edit-hint">(click to change)</span>
              </span>
            `}

        ${showAlert && !this.editing
          ? html`
              <span class="separator" aria-hidden="true"></span>
              <button
                class="btn-reset"
                @click=${this.resetToPrimary}
                aria-label="Return to your primary blog: ${this.primaryBlog}"
              >
                Back to @${this.primaryBlog}
              </button>
            `
          : !this.editing && this.viewedBlog.toLowerCase() === this.primaryBlog?.toLowerCase()
          ? html`<span class="primary-badge" aria-label="This is your primary blog">Your blog</span>`
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blog-context': BlogContext;
  }
}
