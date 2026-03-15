import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { POST_TYPE_ICONS, type ProcessedPost } from '../types/post.js';
import { type PostType } from '../types/api.js';
import { formatDate } from '../services/date-formatter.js';
import './media-renderer.js';

/**
 * Refined Matrix item (v2).
 * Metadata below the image in two readable lines.
 * Uses centralized <media-renderer>.
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
        border-radius: 6px;
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        position: relative;
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
      }

      .card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        border-color: var(--accent);
      }

      .media-container {
        width: 100%;
        aspect-ratio: 1 / 1;
        background: #000;
        position: relative;
        overflow: hidden;
      }

      .card-info {
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .meta-line {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--text-muted);
      }

      .stats-line {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: var(--text);
      }

      .stat-item {
        display: flex;
        align-items: center;
        gap: 3px;
      }

      .multi-image-badge {
        position: absolute;
        top: 6px;
        right: 6px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 1px 5px;
        border-radius: 4px;
        font-size: 9px;
        font-weight: bold;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 3;
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
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        z-index: 2;
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
        z-index: 4;
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

  render() {
    const p = this.post;
    const media = p._media;
    const rawUrl = media.url || media.videoUrl || media.audioUrl;
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
          <media-renderer 
            .src=${rawUrl} 
            .type=${'gallery-grid'}
            style="object-fit: cover;"
          ></media-renderer>

          ${p.content?.files && p.content.files.length > 1 ? html`<div class="multi-image-badge" title="Post contains ${p.content.files.length} items">1 / ${p.content.files.length}</div>` : ''}
          ${rbCount > 0 ? html`<div class="reblog-variant-badge" title="Aggregated reblogs">+${rbCount}</div>` : ''}
          ${isAdmin && isTombstone ? html`<div class="admin-label">Tombstone</div>` : nothing}
        </div>

        <div class="card-info">
          <div class="meta-line">
            <span>${typeIcon}</span>
            <span>${formatDate(p.createdAtUnix, 'date')}</span>
          </div>
          <div class="stats-line">
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
        gap: 16px;
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 16px;
        box-sizing: border-box;
      }

      @media (min-width: 768px) {
        :host {
          grid-template-columns: repeat(4, 1fr);
        }
      }

      @media (min-width: 1024px) {
        :host {
          grid-template-columns: repeat(6, 1fr); /* Super Matrix density */
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
