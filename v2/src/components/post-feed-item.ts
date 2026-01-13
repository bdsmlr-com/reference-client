import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';

@customElement('post-feed-item')
export class PostFeedItem extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        max-width: 600px;
        margin: 0 auto;
      }

      .card {
        background: var(--bg-panel);
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: box-shadow 0.2s;
        border: 1px solid var(--border);
        margin-bottom: 16px;
      }

      .card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
      }

      .blog-info {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .blog-name {
        font-weight: 600;
        color: var(--text-primary);
        text-decoration: none;
      }

      .blog-name:hover {
        color: var(--accent);
      }

      .reblog-indicator {
        font-size: 12px;
        color: var(--text-muted);
      }

      .post-date {
        font-size: 12px;
        color: var(--text-muted);
      }

      .media-container {
        width: 100%;
        position: relative;
      }

      .media-container img {
        width: 100%;
        max-height: 600px;
        object-fit: contain;
        background: var(--bg-panel-alt);
      }

      .media-container video {
        width: 100%;
        max-height: 600px;
      }

      .type-placeholder {
        width: 100%;
        min-height: 200px;
        background: var(--bg-panel-alt);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 8px;
        font-size: 16px;
        color: var(--text-muted);
        padding: 24px;
        text-align: center;
      }

      .type-placeholder.text {
        align-items: flex-start;
        justify-content: flex-start;
        font-size: 14px;
        line-height: 1.6;
      }

      .video-container {
        position: relative;
      }

      .video-icon {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 64px;
        color: white;
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
        pointer-events: none;
      }

      .card-body {
        padding: 16px;
      }

      .card-stats {
        display: flex;
        gap: 16px;
        font-size: 14px;
        color: var(--text-muted);
        margin-bottom: 12px;
      }

      .stat {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .tag {
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        padding: 4px 10px;
        border-radius: 14px;
        font-size: 12px;
        border: 1px solid var(--border);
      }

      .tag:hover {
        background: var(--accent);
        color: white;
        border-color: var(--accent);
      }

      .deleted-badge {
        background: var(--error);
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
      }

      @media (max-width: 480px) {
        :host {
          padding: 0 8px;
        }

        .card-header {
          padding: 10px 12px;
        }

        .card-body {
          padding: 12px;
        }
      }
    `,
  ];

  @property({ type: Object }) post!: ProcessedPost;

  private decodeHtml(htmlStr: string): string {
    const txt = document.createElement('textarea');
    txt.innerHTML = htmlStr;
    return txt.value;
  }

  private formatDate(unix: number): string {
    const date = new Date(unix * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private handleClick(): void {
    this.dispatchEvent(new CustomEvent('item-click', { detail: { post: this.post } }));
  }

  private handleLinkClick(e: Event): void {
    e.stopPropagation();
  }

  private handleImageError(e: Event): void {
    const img = e.target as HTMLImageElement;
    const src = img.src;
    if (src.includes('ocdn012.bdsmlr.com') && !img.dataset.triedFallback) {
      img.dataset.triedFallback = 'true';
      img.src = src.replace('ocdn012.bdsmlr.com', 'cdn012.bdsmlr.com');
    }
  }

  render() {
    const post = this.post;
    const media = post._media;

    const isReblog = post.originPostId && post.originPostId !== post.id;
    const isDeleted = !!post.deletedAtUnix;
    const blogName = (isDeleted ? null : post.blogName) || (isReblog ? 'redacted' : 'unknown');
    const blogUrl = post.blogName && !isDeleted ? `https://${blogName}.bdsmlr.com` : '#';

    const tags = post.tags || [];

    let mediaHtml;
    if (media.type === 'image' && media.url) {
      mediaHtml = html`
        <div class="media-container">
          <img src=${media.url} alt="Post ${post.id}" loading="lazy" @error=${this.handleImageError} />
        </div>
      `;
    } else if (media.type === 'video') {
      if (media.url) {
        mediaHtml = html`
          <div class="media-container video-container">
            <img src=${media.url} alt="Post ${post.id}" loading="lazy" @error=${this.handleImageError} />
            <span class="video-icon">▶</span>
          </div>
        `;
      } else {
        mediaHtml = html`<div class="type-placeholder">🎬 Video</div>`;
      }
    } else if (media.type === 'audio') {
      const preview = (media.html || media.text || '').replace(/<[^>]+>/g, '').slice(0, 200);
      mediaHtml = html`<div class="type-placeholder">🔊 Audio<br /><small>${preview}</small></div>`;
    } else if (media.type === 'link') {
      const title = media.title || 'Link';
      if (media.url) {
        mediaHtml = html`
          <div class="media-container">
            <img src=${media.url} alt="Link" loading="lazy" @error=${this.handleImageError} />
          </div>
        `;
      } else {
        mediaHtml = html`<div class="type-placeholder">🔗 ${title}</div>`;
      }
    } else if (media.type === 'chat') {
      const preview = (media.text || media.title || '').replace(/<[^>]+>/g, '').slice(0, 300);
      mediaHtml = html`<div class="type-placeholder text">💬 ${preview || 'Chat'}</div>`;
    } else if (media.type === 'quote') {
      const preview = (media.quoteText || '').replace(/<[^>]+>/g, '').slice(0, 300);
      mediaHtml = html`<div class="type-placeholder text">📜 "${preview || 'Quote'}"</div>`;
    } else if (media.type === 'text') {
      const decoded = this.decodeHtml(media.text || '');
      const preview = decoded.replace(/<[^>]+>/g, '').slice(0, 300);
      mediaHtml = html`<div class="type-placeholder text">📝 ${preview || 'Text'}</div>`;
    } else {
      mediaHtml = html`<div class="type-placeholder">📄 Post</div>`;
    }

    return html`
      <div class="card" @click=${this.handleClick}>
        <div class="card-header">
          <div class="blog-info">
            <a
              class="blog-name"
              href=${blogUrl}
              target="_blank"
              @click=${this.handleLinkClick}
            >
              @${blogName}
            </a>
            ${isReblog ? html`<span class="reblog-indicator">♻️ reblog</span>` : nothing}
            ${isDeleted ? html`<span class="deleted-badge">deleted</span>` : nothing}
          </div>
          ${post.createdAtUnix
            ? html`<span class="post-date">${this.formatDate(post.createdAtUnix)}</span>`
            : nothing}
        </div>

        ${mediaHtml}

        <div class="card-body">
          <div class="card-stats">
            ${post.likesCount ? html`<span class="stat">❤️ ${post.likesCount}</span>` : nothing}
            ${post.reblogsCount ? html`<span class="stat">♻️ ${post.reblogsCount}</span>` : nothing}
            ${post.commentsCount ? html`<span class="stat">💬 ${post.commentsCount}</span>` : nothing}
          </div>
          ${tags.length > 0
            ? html`
                <div class="tags">
                  ${tags.slice(0, 10).map((t) => html`<span class="tag">#${t}</span>`)}
                  ${tags.length > 10 ? html`<span class="tag">+${tags.length - 10} more</span>` : nothing}
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-feed-item': PostFeedItem;
  }
}
