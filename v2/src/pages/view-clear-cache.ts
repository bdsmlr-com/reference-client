import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import {
  clearAllStorage,
} from '../services/storage.js';
import { clearPostCache } from '../services/post-cache.js';
import { clearBlogTheme } from '../services/blog-theme.js';
import { clearStoredBlogName, isDevMode } from '../services/blog-resolver.js';
import { clearProfileState } from '../services/profile.js';

@customElement('view-clear-cache')
export class ViewClearCache extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 20px;
        text-align: center;
        background: var(--bg-primary);
        color: var(--text-primary);
      }
      .card {
        background: var(--bg-panel);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 40px;
        max-width: 400px;
        width: 100%;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      h1 {
        margin-bottom: 16px;
        font-size: 24px;
      }
      p {
        margin-bottom: 24px;
        color: var(--text-muted);
        line-height: 1.5;
      }
      .btn {
        display: inline-block;
        padding: 12px 24px;
        background: var(--accent);
        color: white;
        border-radius: 4px;
        text-decoration: none;
        font-weight: 600;
        transition: background 0.2s;
        border: none;
        cursor: pointer;
      }
      .btn:hover {
        background: var(--accent-hover);
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    this.performClear();
  }

  private performClear() {
    clearAllStorage();
    clearPostCache();
    clearBlogTheme();
    clearProfileState();
    clearStoredBlogName();
  }

  private handleBack() {
    const redirectUrl = this.getRedirectUrl();
    window.location.href = redirectUrl;
  }

  private getRedirectUrl(): string {
    if (document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.origin === window.location.origin) {
          return referrer.href;
        }
      } catch {
        // Ignore invalid referrer values.
      }
    }
    return isDevMode() ? 'home.html' : '/';
  }

  render() {
    return html`
      <div class="card">
        <h1>Cache Cleared</h1>
        <p>
          Your local session data and caches have been cleared successfully.
          This can resolve issues with stale data or authentication.
        </p>
        <button class="btn" @click=${this.handleBack}>
          Return to App
        </button>
      </div>
    `;
  }
}
