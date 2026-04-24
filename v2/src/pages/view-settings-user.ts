import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { getContextualErrorMessage } from '../services/api-error.js';
import { normalizeAvatarUrl } from '../services/avatar-url.js';
import type { Blog } from '../types/api.js';
import '../components/blog-identity.js';
import '../components/error-state.js';
import '../components/loading-spinner.js';

type OwnedBlogCard = Blog & { name: string };
type SettingsUserResponse = {
  user?: {
    id: number;
    username?: string | null;
  } | null;
  blogs?: Blog[];
};

@customElement('view-settings-user')
export class ViewSettingsUser extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--blog-bg, var(--bg-primary));
      }

      .content {
        max-width: 1080px;
        margin: 0 auto;
        padding: 24px 16px 40px;
        display: grid;
        gap: 20px;
      }

      .hero,
      .section {
        background: var(--bg-panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
      }

      .eyebrow {
        color: var(--text-muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 8px;
      }

      h1,
      h2 {
        margin: 0;
        color: var(--text-primary);
      }

      h1 {
        font-size: 24px;
        margin-bottom: 6px;
      }

      h2 {
        font-size: 18px;
        margin-bottom: 12px;
      }

      .muted {
        color: var(--text-muted);
        margin: 0;
      }

      .account-meta {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .account-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .account-pill {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 12px 14px;
        background: var(--bg-panel-alt);
      }

      .blog-grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }

      .blog-card {
        display: block;
        text-decoration: none;
        color: inherit;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--bg-panel-alt);
        padding: 16px;
        transition: transform 0.2s, border-color 0.2s;
      }

      .blog-card:hover {
        transform: translateY(-1px);
        border-color: var(--accent);
      }

      .blog-card .summary {
        display: grid;
        gap: 8px;
      }

      .blog-card .stats {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        color: var(--text-muted);
        font-size: 12px;
      }

      .blog-card .stat {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    `,
  ];

  @property({ type: String }) username = '';

  @state() private loading = false;
  @state() private errorMessage = '';
  @state() private settingsUser: SettingsUserResponse | null = null;
  @state() private ownedBlogs: OwnedBlogCard[] = [];

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('username') && this.username) {
      void this.loadSettings();
    }
  }

  private async loadSettings(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      const status = await this.fetchSettingsUser(this.username || '');
      this.settingsUser = status;
      const resolvedBlogs = await Promise.all(
        (status.blogs || []).map(async (blog) => {
          if (!blog?.name) {
            return null;
          }
          return blog as OwnedBlogCard;
        }),
      );
      this.ownedBlogs = resolvedBlogs.filter((blog): blog is OwnedBlogCard => Boolean(blog?.name));
    } catch (error) {
      this.errorMessage = getContextualErrorMessage(error, 'load_blog', { blogName: this.username });
      this.settingsUser = null;
      this.ownedBlogs = [];
    } finally {
      this.loading = false;
    }
  }

  private async fetchSettingsUser(username: string): Promise<SettingsUserResponse> {
    const response = await fetch('/api/v2/settings/user', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      throw new Error(`settings user request failed: ${response.status}`);
    }

    return response.json() as Promise<SettingsUserResponse>;
  }

  private renderOwnedBlogCard(blog: OwnedBlogCard) {
    const blogName = blog.name;
    const href = `/settings/blog/${encodeURIComponent(blogName)}`;
    const avatarUrl = normalizeAvatarUrl(blog.avatarUrl ?? null);
    const followersDisplay = blog.followersCount !== undefined && blog.followersCount !== null ? blog.followersCount.toLocaleString() : '—';
    const postsDisplay = blog.postsCount !== undefined && blog.postsCount !== null ? blog.postsCount.toLocaleString() : '—';

    return html`
      <a class="blog-card" href=${href} aria-label=${`Open settings for @${blogName}`}>
        <div class="summary">
          <blog-identity
            variant="header"
            .blogName=${blogName}
            .blogTitle=${blog.title || ''}
            .avatarUrl=${avatarUrl || ''}
          ></blog-identity>
          <div class="stats" aria-label="Owned blog summary">
            <span class="stat"><span aria-hidden="true">👥</span><span>${followersDisplay} followers</span></span>
            <span class="stat"><span aria-hidden="true">📝</span><span>${postsDisplay} posts</span></span>
          </div>
        </div>
      </a>
    `;
  }

  render() {
    const accountName = this.settingsUser?.user?.username || this.username || 'account';
    const primaryBlogName = this.ownedBlogs[0]?.name || 'unknown';

    return html`
      <div class="content">
        ${this.loading ? html`<loading-spinner message="Loading account settings..."></loading-spinner>` : ''}
        ${this.errorMessage ? html`<error-state title="Settings unavailable" message=${this.errorMessage}></error-state>` : ''}

        ${!this.loading && !this.errorMessage ? html`
          <section class="hero">
            <div class="eyebrow">Account settings</div>
            <h1>@${accountName}</h1>
            <p class="muted">User ID ${this.settingsUser?.user?.id ?? 'unknown'}</p>
          </section>

          <section class="section">
            <h2>Owned blogs</h2>
            <div class="blog-grid">
              ${this.ownedBlogs.map((blog) => this.renderOwnedBlogCard(blog))}
            </div>
          </section>

          <section class="section">
            <h2>Session</h2>
            <div class="account-grid">
              <div class="account-pill">
                <div class="eyebrow">Username</div>
                <div>@${this.settingsUser?.user?.username || accountName}</div>
              </div>
              <div class="account-pill">
                <div class="eyebrow">Primary blog</div>
                <div>@${primaryBlogName}</div>
              </div>
              <div class="account-pill">
                <div class="eyebrow">Owned blogs</div>
                <div>${this.ownedBlogs.length}</div>
              </div>
            </div>
          </section>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-settings-user': ViewSettingsUser;
  }
}
