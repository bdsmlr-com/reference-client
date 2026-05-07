import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { extractRenderableTags, type ProcessedPost } from '../types/post.js';
import { formatDate } from '../services/date-formatter.js';
import { getBlogNameFromPath, isAdminMode } from '../services/blog-resolver.js';
import { toPresentationModel } from '../services/post-presentation.js';
import './media-renderer.js';
import './search-group-card.js';

type ActivityGridItem =
  | { post: ProcessedPost; type: any }
  | { kind: 'result_group'; post: ProcessedPost; count: number; label: string; originPostId: number };

function isResultGroupItem(item: ActivityGridItem): item is Extract<ActivityGridItem, { kind: 'result_group' }> {
  return 'kind' in item && item.kind === 'result_group';
}

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
        min-width: 0;
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
        min-width: 0;
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
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
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
  @property({ type: String }) page: 'feed' | 'archive' | 'search' | 'activity' | 'post' | 'social' = 'activity';
  @property({ type: Boolean }) showBlogChip = true;

  private handleClick() {
    this.dispatchEvent(new CustomEvent('activity-click', {
      detail: { post: this.post },
      bubbles: true,
      composed: true,
    }));
  }

  private normalizeBlogName(name: string | undefined): string {
    return (name || '').trim().toLowerCase();
  }

  render() {
    const p = this.post;
    const media = p._media;
    const rawUrl = media.url || media.videoUrl || media.audioUrl;

    const presentation = toPresentationModel(p, { surface: 'card', page: this.page, interactionKind: this.interactionType, role: 'cluster' });
    let typeIcon = presentation.identity.postTypeIcon || '📄';
    if (this.interactionType === 'reblog') typeIcon = '♻️';
    if (this.interactionType === 'like') typeIcon = '❤️';
    if (this.interactionType === 'comment') typeIcon = '💬';

    const isAdmin = isAdminMode();
    const isTombstone = !rawUrl && !p.body;
    const isDeleted = Boolean(p.deletedAtUnix);
    const isOriginDeleted = Boolean(p.originDeletedAtUnix);
    const renderType = this.mode === 'masonry' ? 'masonry' : 'card';
    const tags = extractRenderableTags(p);
    const chipBlogName = presentation.identity.chipBlogLabel;
    const viewedBlog = this.normalizeBlogName(getBlogNameFromPath());
    const chipBlog = this.normalizeBlogName(chipBlogName);
    const shouldHideSelfInteractionChip =
      (this.interactionType === 'like' || this.interactionType === 'comment')
      && !!viewedBlog
      && chipBlog === viewedBlog;
    const showBlogChip = this.showBlogChip
      && !!chipBlogName
      && (
        this.page === 'search'
        || this.page === 'post'
        || this.page === 'social'
        || (
          this.page === 'activity'
          && (this.interactionType === 'like' || this.interactionType === 'comment' || this.interactionType === 'reblog')
          && !shouldHideSelfInteractionChip
        )
      );

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
            ${showBlogChip ? html`<span class="blog-chip">${chipBlogName.startsWith('@') ? chipBlogName : `@${chipBlogName}`}</span>` : html`<span>${formatDate(p.createdAtUnix, 'date')}</span>`}
          </div>
          <div class="stats-line">
            ${presentation.actions.like.count ? html`<div class="stat-item">${presentation.actions.like.icon} ${presentation.actions.like.count}</div>` : ''}
            ${presentation.actions.reblog.count ? html`<div class="stat-item">${presentation.actions.reblog.icon} ${presentation.actions.reblog.count}</div>` : ''}
            ${presentation.actions.comment.count ? html`<div class="stat-item">${presentation.actions.comment.icon} ${presentation.actions.comment.count}</div>` : ''}
            ${tags.length > 0 ? html`<div class="stat-item">🏷️ ${tags.length}</div>` : ''}
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
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      @media (min-width: 768px) {
        .grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
      }

      @media (min-width: 1024px) {
        .grid {
          grid-template-columns: repeat(6, minmax(0, 1fr));
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
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 4px;
      }

      :host([compact]) .masonry-container,
      :host([compact]) .masonry-column {
        gap: 4px;
      }

      @media (max-width: 600px) {
        :host([compact]) .grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
    `,
  ];

  @property({ type: Array }) items: ActivityGridItem[] = [];
  @property({ type: Boolean, reflect: true }) compact = false;
  @property({ type: String, reflect: true }) mode: 'grid' | 'masonry' = 'grid';
  @property({ type: String }) page: 'feed' | 'archive' | 'search' | 'activity' | 'post' | 'social' = 'activity';
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
      const columns: ActivityGridItem[][] = Array.from({ length: colCount }, () => []);
      this.items.forEach((item, i) => {
        columns[i % colCount].push(item);
      });

      return html`
        <section class="masonry-container" aria-label="Activity masonry">
          ${columns.map((column) => html`
            <div class="masonry-column">
              ${column.map((item) => html`
                ${isResultGroupItem(item)
                  ? html`<search-group-card .post=${item.post} .count=${item.count} .label=${item.label} .originPostId=${item.originPostId} mode="masonry"></search-group-card>`
                  : html`<activity-item .post=${item.post} .interactionType=${item.type} .page=${this.page} .showBlogChip=${this.showBlogChip} mode="masonry"></activity-item>`}
              `)}
            </div>
          `)}
        </section>
      `;
    }

    return html`
      <section class="grid" aria-label="Activity grid">
        ${this.items.map((item) => html`
          ${isResultGroupItem(item)
            ? html`<search-group-card .post=${item.post} .count=${item.count} .label=${item.label} .originPostId=${item.originPostId} mode="grid"></search-group-card>`
            : html`<activity-item .post=${item.post} .interactionType=${item.type} .page=${this.page} .showBlogChip=${this.showBlogChip} mode="grid"></activity-item>`}
        `)}
      </section>
    `;
  }
}
