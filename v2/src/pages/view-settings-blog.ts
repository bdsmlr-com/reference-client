import { LitElement, html, css, PropertyValues, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { getContextualErrorMessage } from '../services/api-error.js';
import { buildBlogPresentation, type BlogPresentation } from '../services/blog-presentation.js';
import type { Blog, BlogSettingsResponse } from '../types/api.js';
import '../components/blog-identity.js';
import '../components/error-state.js';
import '../components/loading-spinner.js';

@customElement('view-settings-blog')
export class ViewSettingsBlog extends LitElement {
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

      .hero {
        display: grid;
        gap: 12px;
      }

      .eyebrow {
        color: var(--text-muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      h1,
      h2 {
        margin: 0;
        color: var(--text-primary);
      }

      h1 {
        font-size: 24px;
      }

      h2 {
        font-size: 18px;
        margin-bottom: 12px;
      }

      .grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }

      .panel {
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--bg-panel-alt);
        padding: 14px;
      }

      .panel-label {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 6px;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: var(--text-primary);
        font-size: 12px;
      }

      .stats {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .stat {
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--bg-panel-alt);
        padding: 14px;
      }

      .stat .value {
        display: block;
        color: var(--text-primary);
        font-size: 20px;
        font-weight: 700;
      }

      .stat .label {
        display: block;
        margin-top: 4px;
        color: var(--text-muted);
        font-size: 12px;
      }
    `,
  ];

  @property({ type: String }) blogName = '';

  @state() private loading = false;
  @state() private errorMessage = '';
  @state() private blog: Blog | null = null;
  @state() private presentation: BlogPresentation | null = null;

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('blogName') && this.blogName) {
      void this.loadSettings();
    }
  }

  private async loadSettings(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      if (!this.blogName) {
        throw new Error('Missing blog name');
      }
      const response = await this.fetchSettingsBlog(this.blogName);
      if (!response.blog) {
        throw new Error(`Blog @${this.blogName} not found`);
      }
      this.blog = response.blog;
      this.presentation = buildBlogPresentation(response.blog, 'settings');
    } catch (error) {
      this.errorMessage = getContextualErrorMessage(error, 'load_blog', { blogName: this.blogName });
      this.blog = null;
      this.presentation = null;
    } finally {
      this.loading = false;
    }
  }

  private async fetchSettingsBlog(blogName: string): Promise<BlogSettingsResponse> {
    const response = await fetch('/api/v2/settings/blog', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ blogName }),
    });

    if (!response.ok) {
      throw new Error(`settings blog request failed: ${response.status}`);
    }

    return response.json() as Promise<BlogSettingsResponse>;
  }

  private renderChip(label: string, value?: string) {
    return html`<span class="chip">${label}${value ? html`<span aria-hidden="true">•</span><span>${value}</span>` : nothing}</span>`;
  }

  render() {
    const presentation = this.presentation;
    const blog = this.blog;
    const interestChips = presentation?.chips.filter((chip) => chip.kind === 'interest') ?? [];
    const personalChips = presentation?.chips.filter((chip) => chip.kind === 'personal') ?? [];
    const privacyChips = presentation?.privacy.chips ?? [];

    return html`
      <div class="content">
        ${this.loading ? html`<loading-spinner message="Loading blog settings..."></loading-spinner>` : ''}
        ${this.errorMessage ? html`<error-state title="Settings unavailable" message=${this.errorMessage}></error-state>` : ''}

        ${!this.loading && !this.errorMessage && presentation && blog ? html`
          <section class="hero">
            <div class="eyebrow">Blog settings</div>
            <blog-identity
              variant="header"
              .blogName=${presentation.identity.blogName}
              .blogTitle=${presentation.identity.title}
              .avatarUrl=${presentation.identity.avatarUrl || ''}
            ></blog-identity>
            <div class="panel" style=${`--blog-identity-accent: ${presentation.identity.accentColor};`}>
              <div class="panel-label">Theme summary</div>
              <div>@${presentation.identity.blogName}</div>
              <div class="muted">Accent ${presentation.identity.accentColor}</div>
              <div class="muted">${presentation.identity.title || 'No title set'}</div>
            </div>
          </section>

          <section class="section">
            <h2>Privacy</h2>
            <div class="grid">
              <div class="panel">
                <div class="panel-label">Summary</div>
                <div>${presentation.privacy.summary || 'No privacy summary available'}</div>
              </div>
              <div class="panel">
                <div class="panel-label">Flags</div>
                <div class="chips">
                  ${privacyChips.length > 0 ? privacyChips.map((chip) => this.renderChip(chip.label, chip.value)) : html`<span class="muted">No privacy flags exposed</span>`}
                </div>
              </div>
            </div>
          </section>

          <section class="section">
            <h2>Interests & personals</h2>
            <div class="grid">
              <div class="panel">
                <div class="panel-label">Interests</div>
                <div class="chips">
                  ${interestChips.length > 0 ? interestChips.map((chip) => this.renderChip(chip.label)) : html`<span class="muted">No interests exposed</span>`}
                </div>
              </div>
              <div class="panel">
                <div class="panel-label">Personals</div>
                <div class="chips">
                  ${personalChips.length > 0 ? personalChips.map((chip) => this.renderChip(chip.label, chip.value)) : html`<span class="muted">No personals exposed</span>`}
                </div>
              </div>
            </div>
          </section>

          <section class="section">
            <h2>Operational stats</h2>
            <div class="stats">
              <div class="stat">
                <span class="value">${presentation.stats?.followersCount ?? '—'}</span>
                <span class="label">Followers</span>
              </div>
              <div class="stat">
                <span class="value">${presentation.stats?.postsCount ?? '—'}</span>
                <span class="label">Posts</span>
              </div>
              <div class="stat">
                <span class="value">${blog.ownerUserId ?? '—'}</span>
                <span class="label">Owner user ID</span>
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
    'view-settings-blog': ViewSettingsBlog;
  }
}
