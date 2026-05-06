import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { getStatus, getUserSettings, type SettingsBlog, type SettingsUser } from '../services/auth-service.js';
import { buildPageUrl } from '../services/blog-resolver.js';
import { handleAvatarImageError, normalizeAvatarUrl } from '../services/avatar-url.js';
import '../components/blog-identity.js';

@customElement('view-settings-user')
export class ViewSettingsUser extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--bg-primary);
      }

      .wrap {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px 16px 48px;
      }

      .section {
        margin-top: 24px;
      }

      .eyebrow {
        color: var(--text-muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      h1,
      h2 {
        margin: 8px 0 12px;
        color: var(--text-primary);
      }

      .status {
        color: var(--text-muted);
        padding: 32px 0;
      }

      .error {
        color: var(--accent);
        padding: 24px 0;
      }

      .cards {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .card {
        display: block;
        width: 100%;
        padding: 16px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: inherit;
        text-decoration: none;
        text-align: left;
        cursor: pointer;
        overflow: hidden;
        appearance: none;
        font: inherit;
      }

      .card:hover {
        border-color: var(--accent);
      }

      .card:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      .card-summary {
        min-width: 0;
        overflow: hidden;
      }

      .meta {
        display: flex;
        gap: 12px;
        margin-top: 10px;
        color: var(--text-muted);
        font-size: 12px;
        flex-wrap: wrap;
      }

      .cta {
        margin-top: 10px;
        color: var(--accent);
        font-size: 13px;
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        padding: 20px;
      }

      .modal {
        width: min(560px, 100%);
        background: var(--bg-panel);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
      }

      .modal-top {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        text-align: center;
      }

      .modal-avatar,
      .modal-avatar-fallback {
        width: 112px;
        height: 112px;
        border-radius: 999px;
        object-fit: cover;
        display: block;
      }

      .modal-avatar-fallback {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--accent);
        color: #fff;
        font-size: 42px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .modal-title {
        margin: 0;
        color: var(--text-primary);
        font-size: 20px;
      }

      .modal-subtitle,
      .modal-description {
        color: var(--text-muted);
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      .modal-description {
        white-space: pre-wrap;
      }

      .modal-meta {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        color: var(--text-muted);
        font-size: 12px;
      }

      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
      }

      .modal-button {
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        text-decoration: none;
        font-size: 13px;
      }

      .modal-button.primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }
    `,
  ];

  @state() private loading = true;
  @state() private error = '';
  @state() private user: SettingsUser | null = null;
  @state() private blogs: SettingsBlog[] = [];
  @state() private selectedBlog: SettingsBlog | null = null;

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
      const fallbackBlogs = (status.blogs || []).map((blog) => ({
        id: blog.id,
        name: blog.name,
      }));
      if (
        fallbackBlogs.length === 0 &&
        typeof status.blog_id === 'number' &&
        status.blog_name
      ) {
        fallbackBlogs.push({
          id: status.blog_id,
          name: status.blog_name,
        });
      }
      const resolvedBlogs = response.blogs && response.blogs.length > 0 ? response.blogs : fallbackBlogs;
      this.user = response.user;
      this.blogs = resolvedBlogs;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'settings user request failed';
    } finally {
      this.loading = false;
    }
  }

  private openBlog(blog: SettingsBlog): void {
    this.selectedBlog = blog;
  }

  private closeBlog(): void {
    this.selectedBlog = null;
  }

  private renderBlogAvatar(blog: SettingsBlog) {
    const avatarUrl = normalizeAvatarUrl(blog.avatarUrl || '');
    const initial = blog.name.trim().charAt(0).toUpperCase() || '@';
    return avatarUrl
      ? html`
          <img
            class="modal-avatar"
            src=${avatarUrl}
            alt=${`Avatar for @${blog.name}`}
            @error=${handleAvatarImageError}
          />
        `
      : html`<div class="modal-avatar-fallback" aria-hidden="true">${initial}</div>`;
  }

  private renderSelectedBlogModal() {
    const blog = this.selectedBlog;
    if (!blog) {
      return null;
    }

    return html`
      <div class="modal-backdrop" @click=${() => this.closeBlog()}>
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-blog-title"
          @click=${(event: Event) => event.stopPropagation()}
        >
          <div class="modal-top">
            ${this.renderBlogAvatar(blog)}
            <h3 class="modal-title" id="settings-blog-title">@${blog.name}</h3>
            ${blog.title ? html`<div class="modal-subtitle">${blog.title}</div>` : ''}
            ${blog.description ? html`<div class="modal-description">${blog.description}</div>` : ''}
          </div>
          <div class="modal-meta">
            <span>${blog.postsCount ?? 0} posts</span>
            <span>${blog.followersCount ?? 0} followers</span>
          </div>
          <div class="modal-actions">
            <a class="modal-button primary" href=${buildPageUrl('settings', blog.name)}>
              Open blog settings
            </a>
            <button class="modal-button" type="button" aria-label="Close blog details" @click=${() => this.closeBlog()}>
              Close
            </button>
          </div>
        </section>
      </div>
    `;
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
                <button
                  class="card"
                  type="button"
                  aria-label=${`Open blog details for @${blog.name}`}
                  @click=${() => this.openBlog(blog)}
                >
                  <div class="card-summary">
                    <blog-identity
                      variant="micro"
                      .blogName=${blog.name}
                      .blogTitle=${blog.title || ''}
                      .blogDescription=${blog.description || ''}
                      .avatarUrl=${blog.avatarUrl || ''}
                    ></blog-identity>
                  </div>
                  <div class="meta">
                    <span>${blog.postsCount ?? 0} posts</span>
                    <span>${blog.followersCount ?? 0} followers</span>
                  </div>
                  <div class="cta">Open blog settings</div>
                </button>
              `)}
            </div>
          </div>
        ` : ''}
        ${this.renderSelectedBlogModal()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-settings-user': ViewSettingsUser;
  }
}
