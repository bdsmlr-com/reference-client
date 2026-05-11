import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import type { Post } from '../types/api.js';
import '../components/post-recommendations.js';

@customElement('view-post-related')
export class ViewPostRelated extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: 32px 20px 56px;
        max-width: 1200px;
        margin: 0 auto;
        min-height: 100vh;
      }

      .back-nav {
        margin-bottom: 20px;
      }

      .back-link {
        color: var(--text-muted);
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
      }

      .back-link:hover {
        color: var(--accent);
      }

      .subtitle {
        color: var(--text-muted);
        font-size: 14px;
        margin: 0 0 16px;
      }

      .perspective-nav {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin: 0 0 20px;
        color: var(--text-muted);
        font-size: 13px;
      }

      .perspective-link {
        color: var(--text-muted);
        text-decoration: none;
      }

      .perspective-link:hover {
        color: var(--accent);
      }

      .perspective-link.active {
        color: var(--text);
        font-weight: 600;
      }

      .perspective-separator {
        color: var(--text-muted);
      }
    `,
  ];

  @property({ type: String }) postId = '';
  @property({ type: String }) routePerspective = 'you';
  @property({ type: String }) perspectiveBlogName = '';
  @property({ type: String }) title = 'More like this';
  @state() private seedPost: Post | null = null;
  @state() private seedLoadToken = 0;

  private get normalizedPostId(): number {
    return parseInt(this.postId, 10) || 0;
  }

  private get currentPerspective(): string {
    const raw = (this.routePerspective || 'you').trim().toLowerCase();
    return raw || 'you';
  }

  protected willUpdate(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('postId')) {
      this.seedLoadToken += 1;
      this.seedPost = null;
      void this.loadSeedPost(this.normalizedPostId, this.seedLoadToken);
    }
  }

  private async loadSeedPost(id: number, loadToken: number): Promise<void> {
    if (!id) {
      this.seedPost = null;
      return;
    }

    try {
      const resp = await apiClient.posts.get(id);
      if (loadToken !== this.seedLoadToken || id !== this.normalizedPostId) {
        return;
      }
      this.seedPost = resp.post || null;
    } catch {
      if (loadToken !== this.seedLoadToken || id !== this.normalizedPostId) {
        return;
      }
      this.seedPost = null;
    }
  }

  private relatedHref(blogName?: string): string {
    const id = this.normalizedPostId;
    const normalized = (blogName || '').trim();
    if (!normalized || normalized.toLowerCase() === 'you') {
      return `/post/${id}/related/for/you`;
    }
    return `/post/${id}/related/for/${encodeURIComponent(normalized)}`;
  }

  private get perspectiveNavItems(): Array<{ href: string; label: string; active: boolean }> {
    const currentPerspective = this.currentPerspective;
    const items: Array<{ href: string; label: string; active: boolean }> = [{
      href: this.relatedHref('you'),
      label: 'for you',
      active: currentPerspective === 'you',
    }];

    const seen = new Set<string>(['you']);
    const addPerspective = (blogName?: string | null) => {
      const normalized = (blogName || '').trim().replace(/^@+/, '');
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      items.push({
        href: this.relatedHref(normalized),
        label: `for @${normalized}`,
        active: currentPerspective === key,
      });
    };

    addPerspective(this.seedPost?.originBlogName);
    addPerspective(this.seedPost?.blogName);
    if (currentPerspective !== 'you') {
      addPerspective(this.routePerspective);
    }

    return items;
  }

  render() {
    const id = this.normalizedPostId;
    if (!id) {
      return html`<div class="subtitle">Missing post id.</div>`;
    }

    return html`
      <div class="back-nav">
        <a href="/post/${id}" class="back-link">← Back to post</a>
      </div>

      <div class="subtitle">Expanded related results for post ${id}</div>

      <nav class="perspective-nav" aria-label="Related perspectives">
        ${this.perspectiveNavItems.map(
          (item, index) => html`
            ${index > 0 ? html`<span class="perspective-separator" aria-hidden="true">·</span>` : nothing}
            ${item.active
              ? html`<span class="perspective-link active" aria-current=${item.active ? 'page' : nothing}>${item.label}</span>`
              : html`<a class="perspective-link" href=${item.href} aria-current=${item.active ? 'page' : nothing}>${item.label}</a>`}
          `
        )}
      </nav>

      <post-recommendations
        .postId=${id}
        .mode=${'grid'}
        .perspectiveBlogName=${this.perspectiveBlogName}
        .title=${this.title}
      ></post-recommendations>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-post-related': ViewPostRelated;
  }
}
