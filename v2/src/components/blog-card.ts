import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { Blog } from '../types/api.js';
import { EventNames, type BlogClickDetail } from '../types/events.js';
import { getCachedAvatarUrl, setCachedAvatarUrl } from '../services/storage.js';
import { apiClient } from '../services/client.js';

@customElement('blog-card')
export class BlogCard extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .card {
        background: var(--bg-panel);
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        border: 1px solid var(--border);
        padding: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        min-height: 180px;
      }

      .card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: var(--bg-panel-alt);
        object-fit: cover;
        margin-bottom: 12px;
      }

      .avatar-placeholder {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: var(--bg-panel-alt);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        color: var(--text-muted);
        margin-bottom: 12px;
      }

      .blog-name {
        font-weight: 600;
        color: var(--text-primary);
        font-size: 14px;
        margin-bottom: 4px;
        word-break: break-word;
      }

      .blog-title {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        line-height: 1.4;
      }

      .stats {
        display: flex;
        gap: 12px;
        font-size: 11px;
        color: var(--text-muted);
        margin-top: auto;
      }

      .stat {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .stat-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1.2;
      }

      .stat-value {
        color: var(--text-primary);
        font-weight: 600;
      }

      .stat-label {
        font-size: 10px;
        letter-spacing: 0.3px;
        text-transform: uppercase;
      }
    `,
  ];

  @property({ type: Object }) blog!: Blog;

  // State for fetched avatar URL (BLOG-004)
  @state() private fetchedAvatarUrl: string | null | undefined = undefined;
  @state() private fetchingAvatar = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.tryFetchAvatar();
  }

  updated(changedProps: Map<PropertyKey, unknown>): void {
    super.updated(changedProps);
    // Re-fetch avatar if blog changes
    if (changedProps.has('blog')) {
      this.fetchedAvatarUrl = undefined;
      this.tryFetchAvatar();
    }
  }

  /**
   * Try to get avatar URL from cache or API (BLOG-004).
   * The searchBlogs API often doesn't include avatar URLs, so we need to
   * fetch them via getBlog API, same pattern as blog-list.ts uses.
   */
  private async tryFetchAvatar(): Promise<void> {
    if (!this.blog?.id) return;

    // If blog already has a valid-looking avatar URL, use it
    if (this.blog.avatarUrl) {
      this.fetchedAvatarUrl = this.blog.avatarUrl;
      return;
    }

    // Check localStorage cache first
    const cached = getCachedAvatarUrl(this.blog.id);
    if (cached !== undefined) {
      this.fetchedAvatarUrl = cached;
      return;
    }

    // Cache miss - fetch from API
    if (this.fetchingAvatar) return;
    this.fetchingAvatar = true;

    try {
      const response = await apiClient.blogs.get({ blog_id: this.blog.id });
      const avatarUrl = response.blog?.avatarUrl || null;

      // Cache the result
      setCachedAvatarUrl(this.blog.id, avatarUrl);
      this.fetchedAvatarUrl = avatarUrl;
    } catch {
      // On error, cache null to avoid repeated fetches
      setCachedAvatarUrl(this.blog.id, null);
      this.fetchedAvatarUrl = null;
    } finally {
      this.fetchingAvatar = false;
    }
  }

  private handleClick(): void {
    this.dispatchEvent(
      new CustomEvent<BlogClickDetail>(EventNames.BLOG_CLICK, {
        detail: { blog: this.blog },
      })
    );
  }

  private handleImageError(e: Event): void {
    const img = e.target as HTMLImageElement;
    const src = img.src;

    // Try CDN fallback first (ocdn012 -> cdn012)
    if (src.includes('ocdn012.bdsmlr.com') && !img.dataset.triedFallback) {
      img.dataset.triedFallback = 'true';
      img.src = src.replace('ocdn012.bdsmlr.com', 'cdn012.bdsmlr.com');
      return;
    }

    // If fallback also fails or not applicable, show placeholder
    if (!img.dataset.showedPlaceholder) {
      img.dataset.showedPlaceholder = 'true';
      img.style.display = 'none';
      const placeholder = img.nextElementSibling;
      if (placeholder) {
        (placeholder as HTMLElement).style.display = 'flex';
      }
    }
  }

  /**
   * Normalize avatar URL to add CDN prefix if needed.
   */
  private normalizeAvatarUrl(avatarUrl: string | null | undefined): string | null {
    if (!avatarUrl) return null;

    // If already a full URL, return as-is
    if (avatarUrl.startsWith('http')) return avatarUrl;

    // Add CDN prefix for relative paths
    const path = avatarUrl.startsWith('/') ? avatarUrl.slice(1) : avatarUrl;
    return `https://cdn02.bdsmlr.com/${path}`;
  }

  render() {
    const blog = this.blog;
    // Use fetched avatar URL (from cache or API) instead of blog.avatarUrl directly (BLOG-004)
    const rawAvatarUrl = this.fetchedAvatarUrl ?? blog.avatarUrl;
    const avatarUrl = this.normalizeAvatarUrl(rawAvatarUrl);

    const initial = (blog.name || 'B').charAt(0).toUpperCase();
    const blogName = blog.name || 'unknown';
    const followersCountRaw = blog.followersCount;
    const postsCountRaw = blog.postsCount;
    const followersDisplay =
      followersCountRaw !== undefined && followersCountRaw !== null
        ? followersCountRaw.toLocaleString()
        : '—';
    const postsDisplay =
      postsCountRaw !== undefined && postsCountRaw !== null
        ? postsCountRaw.toLocaleString()
        : '—';
    const followersAria =
      followersCountRaw !== undefined && followersCountRaw !== null
        ? `${followersDisplay} followers`
        : 'unknown follower count';
    const postsAria =
      postsCountRaw !== undefined && postsCountRaw !== null
        ? `${postsDisplay} posts`
        : 'unknown post count';

    return html`
      <article
        class="card"
        @click=${this.handleClick}
        role="article"
        aria-label="Blog ${blogName} with ${followersAria} and ${postsAria}"
        tabindex="0"
        @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.handleClick()}
      >
        ${avatarUrl
          ? html`
              <img
                class="avatar"
                src=${avatarUrl}
                alt="Avatar for ${blogName}"
                @error=${this.handleImageError}
              />
              <div class="avatar-placeholder" style="display: none;" aria-hidden="true">${initial}</div>
            `
          : html`<div class="avatar-placeholder" aria-label="No avatar, showing initial ${initial}">${initial}</div>`}
        <div class="blog-name">@${blogName}</div>
        ${blog.title ? html`<div class="blog-title">${blog.title}</div>` : ''}
        <div class="stats" aria-label="Blog statistics">
          <span class="stat" aria-label="${followersAria}">
            <span aria-hidden="true">👥</span>
            <span class="stat-text">
              <span class="stat-value">${followersDisplay}</span>
              <span class="stat-label">Followers</span>
            </span>
          </span>
          <span class="stat" aria-label="${postsAria}">
            <span aria-hidden="true">📝</span>
            <span class="stat-text">
              <span class="stat-value">${postsDisplay}</span>
              <span class="stat-label">Posts</span>
            </span>
          </span>
        </div>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blog-card': BlogCard;
  }
}
