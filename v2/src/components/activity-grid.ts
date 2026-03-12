import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { resolveMediaUrl, isAnimation } from '../services/media-resolver.js';
import { POST_TYPE_ICONS, type ProcessedPost } from '../types/post.js';
import { type PostType } from '../types/api.js';

/**
 * High-density activity item.
 * Refactored to match Ghost Aesthetic (PostCard).
 */
@customElement('activity-item')
export class ActivityItem extends LitElement {
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
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        position: relative;
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        border-color: var(--accent);
      }

      .media-container {
        width: 100%;
        height: 200px;
        background: #000;
        position: relative;
        overflow: hidden;
      }

      .media-container img, 
      .media-container video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .type-overlay {
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        z-index: 2;
      }

      .card-body {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .blog-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .stats-row {
        display: flex;
        gap: 6px;
      }

      .stat-chip {
        display: flex;
        align-items: center;
        gap: 4px;
        background: var(--bg-panel-alt);
        border: 1px solid var(--border);
        padding: 1px 6px;
        border-radius: 10px;
        font-size: 10px;
        color: var(--text-muted);
      }

      .admin-label {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(255, 0, 0, 0.7);
        color: white;
        font-size: 8px;
        padding: 2px;
        text-align: center;
        text-transform: uppercase;
      }
    `
  ];

  @property({ type: Object }) post!: ProcessedPost;
  @property({ type: String }) interactionType: 'post' | 'reblog' | 'like' | 'comment' = 'post';

  private handleClick() {
    this.dispatchEvent(new CustomEvent('activity-click', {
      detail: { post: this.post },
      bubbles: true,
      composed: true
    }));
  }

  private handleImageError(e: Event) {
    const img = e.target as HTMLImageElement;
    if (!img.dataset.triedOriginal) {
      img.dataset.triedOriginal = 'true';
      const media = this.post._media;
      const rawUrl = media.url || media.videoUrl || media.audioUrl;
      if (rawUrl) {
        img.src = rawUrl;
        return;
      }
    }
    img.style.display = 'none';
  }

  render() {
    const media = this.post._media;
    const rawUrl = media.url || media.videoUrl || media.audioUrl;
    const thumbUrl = resolveMediaUrl(rawUrl, 'thumbnail');
    const posterUrl = resolveMediaUrl(rawUrl, 'poster');
    const isMediaAnim = isAnimation(rawUrl);
    
    let icon = POST_TYPE_ICONS[this.post.type as PostType] || '📄';
    if (this.interactionType === 'reblog') icon = '♻️';
    if (this.interactionType === 'like') icon = '❤️';
    if (this.interactionType === 'comment') icon = '💬';

    const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
    const isTombstone = !rawUrl && !this.post.body;

    return html`
      <article class="card" @click=${this.handleClick}>
        <div class="media-container">
          ${rawUrl ? html`
            ${isMediaAnim ? html`
              <video 
                autoplay 
                loop 
                muted 
                playsinline 
                webkit-playsinline
                preload="metadata"
                poster=${posterUrl}
                style="width: 100%; height: 100%; object-fit: cover; display: block;"
                @error=${this.handleImageError}
              >
                <source src=${thumbUrl} type="video/mp4">
              </video>
            ` : html`
              <img src=${thumbUrl} loading="lazy" @error=${this.handleImageError} />
            `}
          ` : html`
            <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; opacity:0.3; font-size:24px;">
              ${icon}
            </div>
          `}
          <div class="type-overlay" title="${this.interactionType}">${icon}</div>
          ${isAdmin && isTombstone ? html`<div class="admin-label">Tombstone</div>` : nothing}
        </div>

        <div class="card-body">
          <div class="blog-label">@${this.post.blogName || 'unknown'}</div>
          <div class="stats-row">
            ${this.post.likesCount ? html`<div class="stat-chip">❤️ ${this.post.likesCount}</div>` : ''}
            ${this.post.reblogsCount ? html`<div class="stat-chip">♻️ ${this.post.reblogsCount}</div>` : ''}
          </div>
        </div>
      </article>
    `;
  }
}

/**
 * Container for clustered activity.
 * Responsive columns: 1 (Mobile), 2 (Tablet), 4 (Desktop)
 */
@customElement('activity-grid')
export class ActivityGrid extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
      }

      @media (min-width: 600px) {
        :host {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (min-width: 900px) {
        :host {
          grid-template-columns: repeat(4, 1fr);
        }
      }

      /* Compact mode for mixing into feed */
      :host([compact]) {
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        background: var(--bg-panel-alt);
        padding: 8px;
        border-radius: 8px;
        border: 1px solid var(--border);
        max-width: none;
      }

      @media (max-width: 600px) {
        :host([compact]) { grid-template-columns: repeat(3, 1fr); }
      }
    `
  ];

  @property({ type: Array }) items: { post: ProcessedPost, type: any }[] = [];
  @property({ type: Boolean, reflect: true }) compact = false;

  render() {
    return html`
      ${this.items.map(item => html`
        <activity-item .post=${item.post} .interactionType=${item.type}></activity-item>
      `)}
    `;
  }
}
