import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { getStatus, getUserSettings, type SettingsBlog, type SettingsUser } from '../services/auth-service.js';
import { buildPageUrl } from '../services/blog-resolver.js';
import '../components/blog-identity.js';

@customElement('view-settings-user')
export class ViewSettingsUser extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host { display: block; min-height: 100vh; background: var(--bg-primary); }
      .wrap { max-width: 960px; margin: 0 auto; padding: 24px 16px 48px; }
      .section { margin-top: 24px; }
      .eyebrow { color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
      h1, h2 { margin: 8px 0 12px; color: var(--text-primary); }
      .status { color: var(--text-muted); padding: 32px 0; }
      .error { color: var(--accent); padding: 24px 0; }
      .cards { display: grid; grid-template-columns: 1fr; gap: 12px; }
      .card { display: block; padding: 16px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-panel); text-decoration: none; color: inherit; }
      .meta { display: flex; gap: 12px; margin-top: 10px; color: var(--text-muted); font-size: 12px; flex-wrap: wrap; }
      .cta { margin-top: 10px; color: var(--accent); font-size: 13px; }
    `,
  ];

  @state() private loading = true;
  @state() private error = '';
  @state() private user: SettingsUser | null = null;
  @state() private blogs: SettingsBlog[] = [];

  connectedCallback(): void {
    super.connectedCallback();
    this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const status = await getStatus();
      const username = status.username || status.blog_name;
      if (!username) throw new Error('settings user request failed: missing username');
      const response = await getUserSettings(username);
      this.user = response.user;
      this.blogs = response.blogs || [];
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'settings user request failed';
    } finally {
      this.loading = false;
    }
  }

  render() {
    return html`
      <div class="wrap">
        <div class="eyebrow">Settings</div>
        <h1>Your account</h1>
        ${this.user?.username ? html`<div class="status">@${this.user.username}</div>` : ''}
        ${this.loading ? html`<div class="status">Loading settings…</div>` : ''}
        ${!this.loading && this.error ? html`<div class="error">Settings unavailable<br />${this.error}</div>` : ''}
        ${!this.loading && !this.error ? html`
          <div class="section">
            <div class="eyebrow">Owned blogs</div>
            <h2>Choose a blog</h2>
            <div class="cards">
              ${this.blogs.map((blog) => html`
                <a class="card" href=${buildPageUrl('settings', blog.name)}>
                  <blog-identity
                    variant="header"
                    .blogName=${blog.name}
                    .blogTitle=${blog.title || ''}
                    .blogDescription=${blog.description || ''}
                    .avatarUrl=${blog.avatarUrl || ''}
                  ></blog-identity>
                  <div class="meta">
                    <span>${blog.postsCount ?? 0} posts</span>
                    <span>${blog.followersCount ?? 0} followers</span>
                  </div>
                  <div class="cta">Open blog settings</div>
                </a>
              `)}
            </div>
          </div>
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
