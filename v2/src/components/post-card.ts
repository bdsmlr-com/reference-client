import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { POST_TYPE_ICONS, type ProcessedPost } from '../types/post.js';
import { type PostType } from '../types/api.js';
import { EventNames, type PostSelectDetail } from '../types/events.js';
import { resolveMediaUrl, isAnimation } from '../services/media-resolver.js';

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

      .media-container img, 
      .media-container video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
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

      .stats-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .stat-chip {
        display: flex;
        align-items: center;
        gap: 4px;
        background: var(--bg-panel-alt);
        border: 1px solid var(--border);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        color: var(--text-muted);
        transition: background 0.2s;
      }

      .stat-chip:hover {
        background: var(--border);
        color: var(--text);
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

      /* Ghost/Error States */
      .error-ghost {
        width: 100%;
        height: 100%;
        background: var(--bg-panel-alt);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .diagnostic-label {
        font-family: monospace;
        font-size: 8px;
        background: #000;
        color: #00ff00;
        padding: 1px 4px;
        border-radius: 2px;
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
      }
    `,
  ];

  @property({ type: Object }) post!: ProcessedPost;

  private handleClick(): void {
    this.dispatchEvent(
      new CustomEvent<PostSelectDetail>(EventNames.POST_SELECT, {
        detail: { post: this.post },
        bubbles: true,
        composed: true
      })
    );
  }

  private handleImageError(e: Event): void {
    const img = e.target as HTMLImageElement;
    if (!img.dataset.triedOriginal) {
      img.dataset.triedOriginal = 'true';
      const rawUrl = this.post.content?.files?.[0] || this.post.content?.url;
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
    const rbCount = p._reblog_variants?.length || 0;
    
    // Media URLs
    const rawUrl = media.url || media.videoUrl || media.audioUrl;
    const thumbUrl = resolveMediaUrl(rawUrl, 'thumbnail');
    const posterUrl = resolveMediaUrl(rawUrl, 'poster');
    const isMediaAnim = isAnimation(rawUrl);

    const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
    const isTombstone = !rawUrl && !p.body;

    const isReblog = p.originPostId && p.originPostId !== p.id;
    const originName = p.originBlogName;

    return html`
      <article class="card" @click=${this.handleClick}>
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
            <span class="blog-link">@${p.blogName || 'unknown'}</span>
            ${isReblog ? html`<span style="opacity: 0.5;">♻️</span><span class="blog-link" title="Original post by @${originName}">@${originName || '?'}</span>` : ''}
            ${rbCount > 0 ? html`<span class="reblog-badge" title="Aggregated reblogs">+${rbCount}</span>` : ''}
          </div>
          <span style="font-size: 12px; opacity: 0.5;">${POST_TYPE_ICONS[p.type as PostType] || '📄'}</span>
        </div>

        <div class="media-container">
          ${rawUrl ? html`
            ${isMediaAnim ? html`
              <video autoplay loop muted playsinline webkit-playsinline preload="metadata" poster=${posterUrl}>
                <source src=${thumbUrl} type="video/mp4">
              </video>
            ` : html`
              <img src=${thumbUrl} loading="lazy" @error=${this.handleImageError} />
            `}
            ${p.content?.files && p.content.files.length > 1 ? html`<div class="multi-image-badge">1 / ${p.content.files.length}</div>` : ''}
            ${p.type === 3 ? html`<div class="video-overlay-icon">▶</div>` : ''}
          ` : html`
            <div class="error-ghost">
              <span style="font-size: 24px; opacity: 0.3;">${POST_TYPE_ICONS[p.type as PostType] || '📄'}</span>
              ${isAdmin && isTombstone ? html`<span class="diagnostic-label">[TOMBSTONE]</span>` : ''}
              <div style="font-size: 24px; animation: pulse 2s infinite;">✨</div>
            </div>
          `}
        </div>

        <div class="card-body">
          <div class="stats-row">
            ${p.likesCount ? html`<div class="stat-chip">❤️ ${p.likesCount}</div>` : ''}
            ${p.reblogsCount ? html`<div class="stat-chip">♻️ ${p.reblogsCount}</div>` : ''}
            ${p.commentsCount ? html`<div class="stat-chip">💬 ${p.commentsCount}</div>` : ''}
          </div>

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
