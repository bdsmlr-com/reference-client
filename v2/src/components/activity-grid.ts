import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { POST_TYPE_ICONS, type ProcessedPost } from '../types/post.js';
import { type PostType } from '../types/api.js';
import { formatDate } from '../services/date-formatter.js';
import { isAdminMode } from '../services/blog-resolver.js';
import './media-renderer.js';

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

      :host([mode='masonry']) .media-container {
        aspect-ratio: auto;
      }

      :host([mode='masonry']) media-renderer {
        height: auto;
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
      .blog-chip {
        color: var(--accent);
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 1px 6px;
        font-weight: 600;
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

      .admin-label.origin-deleted {
        top: 18px;
        background: rgba(120, 70, 210, 0.9);
      }

      .admin-label.tombstone {
        top: 36px;
        background: rgba(24, 125, 44, 0.9);
      }
    `,
  ];

  @property({ type: Object }) post!: ProcessedPost;
  @property({ type: String }) interactionType: 'post' | 'reblog' | 'like' | 'comment' = 'post';
  @property({ type: String, reflect: true }) mode: 'grid' | 'masonry' = 'grid';
  @property({ type: Boolean }) showBlogChip = true;

  private handleClick() {
    this.dispatchEvent(new CustomEvent('activity-click', {
      detail: { post: this.post },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    const p = this.post;
    const media = p._media;
    const rawUrl = media.url || media.videoUrl || media.audioUrl;

    let typeIcon = POST_TYPE_ICONS[p.type as PostType] || '📄';
    if (this.interactionType === 'reblog') typeIcon = '♻️';
    if (this.interactionType === 'like') typeIcon = '❤️';
    if (this.interactionType === 'comment') typeIcon = '💬';

    const isAdmin = isAdminMode();
    const isTombstone = !rawUrl && !p.body;
    const isDeleted = Boolean(p.deletedAtUnix);
    const isOriginDeleted = Boolean(p.originDeletedAtUnix);
    const renderType = this.mode === 'masonry' ? 'gallery-masonry' : 'gallery-grid';
    const chipBlogName = this.interactionType === 'reblog'
      ? (p.originBlogName || p.blogName || '')
      : (p.variant === 2 ? (p.originBlogName || p.blogName || '') : (p.blogName || ''));
    const showBlogChip = this.showBlogChip
      && (this.interactionType === 'like' || this.interactionType === 'comment' || this.interactionType === 'reblog')
      && !!chipBlogName;

    return html`
      <article class="card" @click=${this.handleClick}>
        <div class="media-container">
          <media-renderer
            .src=${rawUrl}
            .type=${renderType}
            style="object-fit: ${this.mode === 'masonry' ? 'contain' : 'cover'};"
          ></media-renderer>

          ${p.content?.files && p.content.files.length > 1 ? html`<div class="multi-image-badge" title="Post contains ${p.content.files.length} items">1 / ${p.content.files.length}</div>` : ''}
          ${isAdmin && isDeleted ? html`<div class="admin-label">Deleted</div>` : nothing}
          ${isAdmin && isOriginDeleted ? html`<div class="admin-label origin-deleted">Origin Deleted</div>` : nothing}
          ${isAdmin && isTombstone ? html`<div class="admin-label tombstone">Tombstone</div>` : nothing}
        </div>

        <div class="card-info">
          <div class="meta-line">
            <span>${typeIcon}</span>
            ${showBlogChip ? html`<span class="blog-chip">@${chipBlogName}</span>` : html`<span>${formatDate(p.createdAtUnix, 'date')}</span>`}
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
        display: block;
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 16px;
        box-sizing: border-box;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      @media (min-width: 768px) {
        .grid {
          grid-template-columns: repeat(4, 1fr);
        }
      }

      @media (min-width: 1024px) {
        .grid {
          grid-template-columns: repeat(6, 1fr);
        }
      }

      .masonry-container {
        display: flex;
        gap: 16px;
        align-items: flex-start;
      }

      .masonry-column {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 0;
      }

      :host([compact]) {
        background: var(--bg-panel-alt);
        padding: 8px;
        border-radius: 8px;
        border: 1px solid var(--border);
        max-width: none;
      }

      :host([compact]) .grid {
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
      }

      :host([compact]) .masonry-container,
      :host([compact]) .masonry-column {
        gap: 4px;
      }

      @media (max-width: 600px) {
        :host([compact]) .grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }
    `,
  ];

  @property({ type: Array }) items: { post: ProcessedPost; type: any }[] = [];
  @property({ type: Boolean, reflect: true }) compact = false;
  @property({ type: String, reflect: true }) mode: 'grid' | 'masonry' = 'grid';
  @property({ type: Boolean }) showBlogChip = true;

  private getMasonryColumnCount(): number {
    if (typeof window === 'undefined') {
      return 2;
    }
    if (window.innerWidth >= 1024) {
      return 6;
    }
    if (window.innerWidth >= 768) {
      return 4;
    }
    return 2;
  }

  render() {
    if (this.mode === 'masonry') {
      const colCount = this.compact ? 4 : this.getMasonryColumnCount();
      const columns: { post: ProcessedPost; type: any }[][] = Array.from({ length: colCount }, () => []);
      this.items.forEach((item, i) => {
        columns[i % colCount].push(item);
      });

      return html`
        <section class="masonry-container" aria-label="Activity masonry">
          ${columns.map((column) => html`
            <div class="masonry-column">
              ${column.map((item) => html`
                <activity-item .post=${item.post} .interactionType=${item.type} .showBlogChip=${this.showBlogChip} mode="masonry"></activity-item>
              `)}
            </div>
          `)}
        </section>
      `;
    }

    return html`
      <section class="grid" aria-label="Activity grid">
        ${this.items.map((item) => html`
          <activity-item .post=${item.post} .interactionType=${item.type} .showBlogChip=${this.showBlogChip} mode="grid"></activity-item>
        `)}
      </section>
    `;
  }
}
