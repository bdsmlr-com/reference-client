import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { resolveMediaUrl, isGif } from '../services/media-resolver.js';
import { POST_TYPE_ICONS, type ProcessedPost } from '../types/post.js';
import { type PostType } from '../types/api.js';

/**
 * High-density activity item.
 * Indicating: Blog, Reblog, Like, or Comment via icons.
 */
@customElement('activity-item')
export class ActivityItem extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        position: relative;
        aspect-ratio: 1 / 1;
        background: var(--bg-panel-alt);
        border-radius: 4px;
        overflow: hidden;
        cursor: pointer;
        border: 1px solid var(--border-subtle);
        transition: transform 0.2s, border-color 0.2s;
      }

      :host(:hover) {
        transform: scale(1.02);
        border-color: var(--accent);
        z-index: 2;
      }

      img, video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .type-overlay {
        position: absolute;
        top: 6px;
        right: 6px;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.2);
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
        img.src = rawUrl; // Fallback to raw backend URL
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
    const isMediaGif = isGif(rawUrl);
    
    let icon = POST_TYPE_ICONS[this.post.type as PostType] || '📄';
    if (this.interactionType === 'reblog') icon = '♻️';
    if (this.interactionType === 'like') icon = '❤️';
    if (this.interactionType === 'comment') icon = '💬';

    const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
    const isTombstone = !media.url && !this.post.body;

    return html`
      <div @click=${this.handleClick} style="width: 100%; height: 100%;">
        ${rawUrl ? html`
          ${isMediaGif ? html`
            <video 
              autoplay loop muted playsinline 
              poster=${posterUrl}
              style="width: 100%; height: 100%; object-fit: cover;"
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
    `;
  }
}

/**
 * Container for clustered activity.
 */
@customElement('activity-grid')
export class ActivityGrid extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 8px;
        width: 100%;
      }

      /* Compact mode for mixing into feed */
      :host([compact]) {
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        background: var(--bg-panel-alt);
        padding: 8px;
        border-radius: 8px;
        border: 1px solid var(--border);
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
