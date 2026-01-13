import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { Activity } from '../types/api.js';

@customElement('blog-list')
export class BlogList extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        max-width: 600px;
        margin: 0 auto;
        padding: 0 16px;
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .list-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        background: var(--bg-panel);
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
        border: 1px solid var(--border);
        min-height: 56px;
      }

      .list-item:hover {
        background: var(--bg-panel-alt);
      }

      .blog-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .blog-name {
        font-size: 14px;
        color: var(--text-primary);
      }

      .blog-meta {
        font-size: 11px;
        color: var(--text-muted);
      }

      .action {
        font-size: 12px;
        color: var(--accent);
      }

      .empty {
        text-align: center;
        padding: 40px;
        color: var(--text-muted);
      }
    `,
  ];

  @property({ type: Array }) items: Activity[] = [];

  private formatDate(unix?: number): string {
    if (!unix) return '';
    const d = new Date(unix * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  private handleItemClick(item: Activity): void {
    const blogName = item.blogName;
    if (blogName) {
      window.location.href = `archive.html?blog=${encodeURIComponent(blogName)}`;
    }
  }

  render() {
    if (this.items.length === 0) {
      return html`<div class="empty">No items to display</div>`;
    }

    return html`
      <div class="list">
        ${this.items.map((item) => {
          const name = item.blogName || (item.blogId ? `blog:${item.blogId}` : `user:${item.userId || 'unknown'}`);
          return html`
            <div class="list-item" @click=${() => this.handleItemClick(item)}>
              <div class="blog-info">
                <span class="blog-name">@${name}</span>
                ${item.createdAtUnix
                  ? html`<span class="blog-meta">${this.formatDate(item.createdAtUnix)}</span>`
                  : nothing}
              </div>
              ${item.blogName ? html`<span class="action">View Archive →</span>` : nothing}
            </div>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blog-list': BlogList;
  }
}
