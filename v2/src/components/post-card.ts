import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { POST_TYPE_ICONS, type ProcessedPost } from '../types/post.js';
import { type PostType } from '../types/api.js';
import { EventNames, type PostSelectDetail } from '../types/events.js';
import { isAdminMode } from '../services/blog-resolver.js';
import { toPresentationModel } from '../services/post-presentation.js';
import './media-renderer.js';
import './post-actions.js';

@customElement('post-card')
export class PostCard extends LitElement {
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

      /* Identity Header */
      .card-header {
        padding: 10px 12px;
        background: var(--bg-panel-alt);
        border-bottom: 1px solid var(--border-subtle);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .blog-link {
        font-size: 12px;
        font-weight: 600;
        color: var(--text);
        text-decoration: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .blog-link:hover {
        color: var(--accent);
      }

      .reblog-badge {
        font-size: 10px;
        background: var(--accent);
        color: white;
        padding: 1px 5px;
        border-radius: 4px;
        font-weight: bold;
      }

      /* Media Section - Fixed height like the skeleton */
      .media-container {
        width: 100%;
        height: 200px;
        background: #000;
        position: relative;
        overflow: hidden;
      }

      .multi-image-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
        backdrop-filter: blur(4px);
        z-index: 2;
      }

      /* Info & Chips */
      .card-body {
        padding: 12px;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .tag {
        font-size: 10px;
        color: var(--text-muted);
        background: transparent;
        border: 1px solid var(--border-subtle);
        padding: 1px 6px;
        border-radius: 10px;
      }

      .diagnostic-label {
        position: absolute;
        bottom: 8px;
        left: 8px;
        font-family: monospace;
        font-size: 8px;
        background: rgba(0,0,0,0.8);
        color: #00ff00;
        padding: 1px 4px;
        border-radius: 2px;
        z-index: 2;
      }

      .video-overlay-icon {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 32px;
        color: white;
        opacity: 0.8;
        pointer-events: none;
        text-shadow: 0 2px 10px rgba(0,0,0,0.5);
        z-index: 2;
      }

      .status-badges {
        position: absolute;
        top: 8px;
        left: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        z-index: 3;
      }

      .status-badge {
        font-family: monospace;
        font-size: 9px;
        line-height: 1;
        color: #fff;
        padding: 3px 5px;
        border-radius: 4px;
        text-transform: uppercase;
      }

      .status-badge.deleted {
        background: rgba(190, 35, 35, 0.92);
      }

      .status-badge.origin-deleted {
        background: rgba(143, 54, 214, 0.92);
      }
    `,
  ];

  @property({ type: Object }) post!: ProcessedPost;

  private handleClick(): void {
    const detail = { post: this.post };
    this.dispatchEvent(
      new CustomEvent<PostSelectDetail>(EventNames.POST_SELECT, {
        detail,
        bubbles: true,
        composed: true
      })
    );
    // Compatibility while consumers migrate to a single click contract.
    this.dispatchEvent(
      new CustomEvent('post-click', {
        detail,
        bubbles: true,
        composed: true
      })
    );
  }

  render() {
    const p = this.post;
    const presentation = toPresentationModel(p, { surface: 'card', page: 'archive' });
    const media = p._media;
    const rbCount = p._reblog_variants?.length || 0;
    
    // Media URLs
    const rawUrl = media.url || media.videoUrl || media.audioUrl;
    const isReblog = p.originPostId && p.originPostId !== p.id;
    const originName = p.originBlogName || 'unknown';

    const isAdmin = isAdminMode();
    const isTombstone = !rawUrl && !p.body;
    const isDeleted = Boolean(p.deletedAtUnix);
    const isOriginDeleted = Boolean(p.originDeletedAtUnix);

    return html`
      <article class="card" @click=${this.handleClick}>
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
            ${isReblog ? html`
              <a
                class="blog-link"
                href=${presentation.identity.originBlog?.href || '#'}
                target=${presentation.identity.originBlog?.target || '_self'}
                rel=${presentation.identity.originBlog?.rel || nothing}
                title=${presentation.identity.originBlog?.title || `Original post by @${originName}`}
                @click=${(event: Event) => event.stopPropagation()}
              >${presentation.identity.originBlog?.label || `@${originName}`}</a>
              <span style="opacity: 0.5;">♻️ via</span>
              <a
                class="blog-link"
                href=${presentation.identity.viaBlog?.href || '#'}
                target=${presentation.identity.viaBlog?.target || '_self'}
                rel=${presentation.identity.viaBlog?.rel || nothing}
                title=${presentation.identity.viaBlog?.title || `Open @${p.blogName || 'unknown'}`}
                @click=${(event: Event) => event.stopPropagation()}
              >${presentation.identity.viaBlog?.label || `@${p.blogName || 'unknown'}`}</a>
            ` : html`
              <a
                class="blog-link"
                href=${presentation.identity.viaBlog?.href || '#'}
                target=${presentation.identity.viaBlog?.target || '_self'}
                rel=${presentation.identity.viaBlog?.rel || nothing}
                title=${presentation.identity.viaBlog?.title || `Open @${p.blogName || 'unknown'}`}
                @click=${(event: Event) => event.stopPropagation()}
              >${presentation.identity.viaBlog?.label || `@${p.blogName || 'unknown'}`}</a>
            `}
            ${rbCount > 0 ? html`<span class="reblog-badge" title="Aggregated reblogs">+${rbCount}</span>` : ''}
          </div>
          <a
            class="blog-link"
            href=${presentation.identity.permalink.href}
            target=${presentation.identity.permalink.target}
            rel=${presentation.identity.permalink.rel || nothing}
            title=${presentation.identity.permalink.title || nothing}
            @click=${(event: Event) => event.stopPropagation()}
          >${presentation.identity.permalink.label || `${POST_TYPE_ICONS[p.type as PostType] || '📄'} ${p.id}`}</a>
        </div>

        <div class="media-container">
          <media-renderer 
            .src=${rawUrl} 
            .type=${'gallery-grid'}
            style="object-fit: cover;"
          ></media-renderer>
          
          ${p.content?.files && p.content.files.length > 1 ? html`<div class="multi-image-badge">1 / ${p.content.files.length}</div>` : ''}
          ${p.type === 3 ? html`<div class="video-overlay-icon">▶</div>` : ''}
          ${isAdmin && (isDeleted || isOriginDeleted) ? html`
            <div class="status-badges">
              ${isDeleted ? html`<div class="status-badge deleted">deleted</div>` : ''}
              ${isOriginDeleted ? html`<div class="status-badge origin-deleted">origin deleted</div>` : ''}
            </div>
          ` : ''}
          ${isAdmin && isTombstone ? html`<div class="diagnostic-label">[TOMBSTONE]</div>` : ''}
        </div>

        <div class="card-body">
          <post-actions variant="card" .post=${p}></post-actions>

          <div class="tags">
            ${(p.tags || []).slice(0, 3).map(t => html`<span class="tag">#${t}</span>`)}
            ${p.tags && p.tags.length > 3 ? html`<span class="tag" style="border:none;">+${p.tags.length - 3}</span>` : ''}
          </div>
        </div>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-card': PostCard;
  }
}
