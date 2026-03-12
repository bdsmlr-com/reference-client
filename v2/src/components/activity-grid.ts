import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { resolveMediaUrl, isAnimation } from '../services/media-resolver.js';
import { POST_TYPE_ICONS, type ProcessedPost } from '../types/post.js';
import { type PostType } from '../types/api.js';

/**
 * Matrix-style activity item.
 * High-density: No header, all stats overlaid on the bottom-left.
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
        background: #000;
        border-radius: 4px;
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        position: relative;
        border: 1px solid var(--border);
        aspect-ratio: 1 / 1;
      }

      .card:hover {
        transform: scale(1.02);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        border-color: var(--accent);
        z-index: 10;
      }

      .media-container {
        width: 100%;
        height: 100%;
        position: relative;
      }

      img, video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      /* Consolidated Bottom-Left Overlay */
      .meta-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
        padding: 20px 8px 6px 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: white;
        font-size: 12px;
        pointer-events: none;
      }

      .stat-item {
        display: flex;
        align-items: center;
        gap: 3px;
        text-shadow: 0 1px 4px rgba(0,0,0,0.8);
      }

      .type-icon {
        font-size: 14px;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));
      }

      .reblog-variant-badge {
        position: absolute;
        top: 6px;
        right: 6px;
        background: var(--accent);
        color: white;
        padding: 1px 5px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      }

      .admin-label {
        position: absolute;
        top: 0;
        left: 0;
        background: rgba(255, 0, 0, 0.8);
        color: white;
        font-size: 8px;
        padding: 2px 4px;
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
    const p = this.post;
    const media = p._media;
    const rawUrl = media.url || media.videoUrl || media.audioUrl;
    const thumbUrl = resolveMediaUrl(rawUrl, 'thumbnail');
    const posterUrl = resolveMediaUrl(rawUrl, 'poster');
    const isMediaAnim = isAnimation(rawUrl);
    const rbCount = p.reblog_variants?.length || 0;
    
    let typeIcon = POST_TYPE_ICONS[p.type as PostType] || '📄';
    if (this.interactionType === 'reblog') typeIcon = '♻️';
    if (this.interactionType === 'like') typeIcon = '❤️';
    if (this.interactionType === 'comment') typeIcon = '💬';

    const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
    const isTombstone = !rawUrl && !p.body;

    return html`
      <article class="card" @click=${this.handleClick}>
        <div class="media-container">
          ${rawUrl ? html`
            ${isMediaAnim ? html`
              <video 
                autoplay loop muted playsinline webkit-playsinline 
                preload="metadata" poster=${posterUrl}
                @error=${this.handleImageError}
              >
                <source src=${thumbUrl} type="video/mp4">
              </video>
            ` : html`
              <img src=${thumbUrl} loading="lazy" @error=${this.handleImageError} />
            `}
          ` : html`
            <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; opacity:0.3; font-size:32px;">
              ${typeIcon}
            </div>
          `}

          ${rbCount > 0 ? html`<div class="reblog-variant-badge" title="Aggregated reblogs">+${rbCount}</div>` : ''}
          ${isAdmin && isTombstone ? html`<div class="admin-label">Tombstone</div>` : nothing}

          <div class="meta-overlay">
            <span class="type-icon">${typeIcon}</span>
            ${p.likesCount ? html`<div class="stat-item">❤️ ${p.likesCount}</div>` : ''}
            ${p.reblogsCount ? html`<div class="stat-item">♻️ ${p.reblogsCount}</div>` : ''}
            ${p.commentsCount ? html`<div class="stat-item">💬 ${p.commentsCount}</div>` : ''}
          </div>
        </div>
      </article>
    `;
  }
}

@customElement('activity-grid')
export class ActivityGrid extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
      }

      @media (min-width: 768px) {
        :host {
          grid-template-columns: repeat(4, 1fr);
        }
      }

      @media (min-width: 1024px) {
        :host {
          grid-template-columns: repeat(6, 1fr); /* Matrix density */
        }
      }

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
