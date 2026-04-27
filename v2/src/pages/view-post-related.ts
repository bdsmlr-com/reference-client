import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { getPrimaryBlogName } from '../services/blog-resolver.js';
import type { Post } from '../types/api.js';
import '../components/result-group.js';
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
        margin: 0 0 20px;
      }

      .tabs {
        display: flex;
        justify-content: flex-start;
        gap: 6px;
        flex-wrap: wrap;
        margin: 0 0 20px;
      }

      .tab {
        padding: 6px 14px;
        border-radius: 4px;
        background: var(--bg-panel);
        color: var(--text-muted);
        font-size: 13px;
        min-height: 30px;
        transition: all 0.2s;
        border: 1px solid var(--border);
        text-decoration: none;
        display: inline-flex;
        align-items: center;
      }

      .tab:hover {
        background: var(--bg-panel-alt);
      }

      .tab.active {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }
    `,
  ];

  @property({ type: String }) postId = '';
  @property({ type: String }) perspectiveBlogName = '';
  @property({ type: String }) title = 'More like this ✨';
  @state() private seedPost: Post | null = null;

  private get normalizedPostId(): number {
    return parseInt(this.postId, 10) || 0;
  }

  protected updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('postId')) {
      void this.loadSeedPost();
    }
  }

  private async loadSeedPost(): Promise<void> {
    const id = this.normalizedPostId;
    if (!id) {
      this.seedPost = null;
      return;
    }
    try {
      const resp = await apiClient.posts.get(id);
      this.seedPost = resp.post || null;
    } catch {
      this.seedPost = null;
    }
  }

  private relatedHref(blogName?: string): string {
    const id = this.normalizedPostId;
    if (!blogName) {
      return `/post/${id}/related`;
    }
    const normalized = blogName.trim();
    return `/post/${id}/related/for/${encodeURIComponent(normalized)}`;
  }

  private get perspectiveTabs(): Array<{ href: string; label: string; active: boolean }> {
    const tabs: Array<{ href: string; label: string; active: boolean }> = [];
    const currentPerspective = (this.perspectiveBlogName || '').trim().toLowerCase();
    const seen = new Set<string>();
    const add = (blogName: string | undefined, label: string) => {
      const normalized = (blogName || '').trim();
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      tabs.push({
        href: this.relatedHref(normalized),
        label,
        active: key === currentPerspective,
      });
    };

    tabs.push({
      href: this.relatedHref(),
      label: 'More like this',
      active: currentPerspective === '',
    });

    const activeBlog = getPrimaryBlogName();
    add(activeBlog || undefined, 'For you');
    add(this.seedPost?.originBlogName, `For @${this.seedPost?.originBlogName}`);
    add(this.seedPost?.blogName, `For @${this.seedPost?.blogName}`);

    return tabs;
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

      <div class="tabs">
        ${this.perspectiveTabs.map(
          (tab) => html`<a class="tab ${tab.active ? 'active' : ''}" href=${tab.href}>${tab.label}</a>`
        )}
      </div>

      <result-group
        wide
        ?bare=${true}
        .title=${this.title}
        .description=${`Expanded related results for post ${id}`}
      >
        <post-recommendations
          .postId=${id}
          .mode=${'list'}
          .perspectiveBlogName=${this.perspectiveBlogName}
          .title=${''}
        ></post-recommendations>
      </result-group>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-post-related': ViewPostRelated;
  }
}
