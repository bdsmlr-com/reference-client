import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { getBlogSettings, type SettingsBlog } from '../services/auth-service.js';
import '../components/blog-identity.js';

@customElement('view-settings-blog')
export class ViewSettingsBlog extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host { display: block; min-height: 100vh; background: var(--bg-primary); }
      .wrap { max-width: 960px; margin: 0 auto; padding: 24px 16px 48px; }
      .section { margin-top: 24px; padding: 16px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-panel); }
      .eyebrow { color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
      h1, h2 { margin: 8px 0 12px; color: var(--text-primary); }
      .status { color: var(--text-muted); padding: 32px 0; }
      .error { color: var(--accent); padding: 24px 0; }
      .row { display: flex; gap: 12px; flex-wrap: wrap; color: var(--text-muted); font-size: 13px; }
      .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
      .chip { padding: 4px 8px; border-radius: 999px; background: var(--bg-panel-alt); color: var(--text-secondary); font-size: 12px; }
      .field { color: var(--text-secondary); line-height: 1.5; }
    `,
  ];

  @property({ type: String }) blog = '';

  @state() private loading = true;
  @state() private error = '';
  @state() private blogData: SettingsBlog | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.load();
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('blog')) this.load();
  }

  private async load(): Promise<void> {
    if (!this.blog) return;
    this.loading = true;
    this.error = '';
    try {
      const response = await getBlogSettings(this.blog);
      this.blogData = response.blog;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'settings blog request failed';
    } finally {
      this.loading = false;
    }
  }

  private renderInterestChips(blog: SettingsBlog) {
    const interests = Object.entries(blog.interests || {}).filter(([, value]) => Boolean(value));
    const labels = blog.personals?.labels ? Object.entries(blog.personals.labels) : [];
    return html`
      <div class="chips">
        ${interests.map(([key]) => html`<span class="chip">${key}</span>`)}
        ${labels.map(([key, value]) => html`<span class="chip">${key}: ${value}</span>`)}
      </div>
    `;
  }

  render() {
    const blog = this.blogData;
    return html`
      <div class="wrap">
        <div class="eyebrow">Settings</div>
        <h1>Blog settings</h1>
        ${this.loading ? html`<div class="status">Loading settings…</div>` : ''}
        ${!this.loading && this.error ? html`<div class="error">Settings unavailable<br />${this.error}</div>` : ''}
        ${!this.loading && !this.error && blog ? html`
          <div class="section">
            <blog-identity
              variant="header"
              .blogName=${blog.name}
              .blogTitle=${blog.title || ''}
              .blogDescription=${blog.description || ''}
              .avatarUrl=${blog.avatarUrl || ''}
            ></blog-identity>
            <div class="row">
              <span>${blog.postsCount ?? 0} posts</span>
              <span>${blog.followersCount ?? 0} followers</span>
              <span>theme #${blog.backgroundColor || 'unknown'}</span>
            </div>
          </div>

          <div class="section">
            <div class="eyebrow">Privacy</div>
            <h2>Visibility</h2>
            <div class="field">
              ${blog.privacy?.isPrivate ? 'Private blog' : 'Public blog'}
            </div>
          </div>

          <div class="section">
            <div class="eyebrow">Interests & personals</div>
            <h2>Profile facets</h2>
            ${this.renderInterestChips(blog)}
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-settings-blog': ViewSettingsBlog;
  }
}
