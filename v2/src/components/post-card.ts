import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';

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
        transition: transform 0.2s, box-shadow 0.2s;
        position: relative;
        border: 1px solid var(--border);
      }

      .card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .card img {
        width: 100%;
        height: 200px;
        object-fit: cover;
        background: var(--bg-panel-alt);
      }

      .type-placeholder {
        width: 100%;
        height: 200px;
        background: var(--bg-panel-alt);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        color: var(--text-muted);
        padding: 12px;
        text-align: center;
        overflow: hidden;
      }

      .type-placeholder.text {
        font-size: 12px;
        color: var(--text-muted);
        align-items: flex-start;
        justify-content: flex-start;
        line-height: 1.4;
      }

      .video-thumb {
        position: relative;
        width: 100%;
        height: 200px;
        background: var(--bg-panel-alt);
      }

      .video-thumb img {
        width: 100%;
        height: 200px;
        object-fit: cover;
      }

      .video-thumb .video-icon {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 48px;
        color: white;
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
        pointer-events: none;
      }

      .link-thumb {
        position: relative;
      }

      .link-thumb img {
        width: 100%;
        height: 200px;
        object-fit: cover;
      }

      .link-thumb .link-icon {
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 20px;
        opacity: 0.8;
      }

      .card-info {
        padding: 10px;
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .tag {
        background: var(--accent);
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
      }

      .card-stats {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 6px;
      }

      .post-link {
        position: absolute;
        top: 4px;
        right: 4px;
        background: rgba(0, 0, 0, 0.7);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        text-decoration: none;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        z-index: 10;
      }

      .post-link:hover {
        background: var(--accent);
        text-decoration: none;
      }

      .post-link.deleted {
        background: rgba(239, 68, 68, 0.8);
      }
    `,
  ];

  @property({ type: Object }) post!: ProcessedPost;

  private decodeHtml(htmlStr: string): string {
    const txt = document.createElement('textarea');
    txt.innerHTML = htmlStr;
    return txt.value;
  }

  private handleClick(): void {
    this.dispatchEvent(new CustomEvent('card-click', { detail: { post: this.post } }));
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
    const isOriginDeleted = !!post.originDeletedAtUnix;
    const blogName = (isDeleted ? null : post.blogName) || (isReblog ? 'redacted' : 'unknown');
    const isRedacted = isDeleted || (!post.blogName && isReblog);
    const postUrl =
      post.blogName && !isDeleted
        ? `https://${blogName}.bdsmlr.com/post/${post.id}`
        : `https://bdsmlr.com/post/${post.id}`;

    let linkText: string;
    if (isReblog && isOriginDeleted && isRedacted) {
      linkText = '♻️ deleted';
    } else if (isRedacted) {
      linkText = '♻️ redacted';
    } else if (isReblog && isOriginDeleted) {
      linkText = `📌 ${blogName}`;
    } else if (isReblog) {
      linkText = `♻️ ${blogName}`;
    } else {
      linkText = `📝 ${blogName}`;
    }

    const tags = (post.tags || []).slice(0, 3);
    const statsArr: string[] = [];
    if (post.likesCount) statsArr.push(`❤️ ${post.likesCount}`);
    if (post.reblogsCount) statsArr.push(`♻️ ${post.reblogsCount}`);
    if (post.commentsCount) statsArr.push(`💬 ${post.commentsCount}`);
    const statsText = statsArr.join(' ');

    let mediaHtml;
    if (media.type === 'image' && media.url) {
      mediaHtml = html`<img src=${media.url} alt="Post ${post.id}" loading="lazy" @error=${this.handleImageError} />`;
    } else if (media.type === 'video') {
      if (media.url) {
        mediaHtml = html`
          <div class="video-thumb">
            <img src=${media.url} alt="Post ${post.id}" loading="lazy" @error=${this.handleImageError} />
            <span class="video-icon">▶</span>
          </div>
        `;
      } else {
        mediaHtml = html`<div class="type-placeholder">🎬 Video</div>`;
      }
    } else if (media.type === 'audio') {
      const preview = (media.html || media.text || '').replace(/<[^>]+>/g, '').slice(0, 80);
      mediaHtml = html`<div class="type-placeholder">🔊 Audio<br /><small>${preview}</small></div>`;
    } else if (media.type === 'link') {
      const title = media.title || 'Link';
      if (media.url) {
        mediaHtml = html`
          <div class="link-thumb">
            <img src=${media.url} alt="Link" loading="lazy" @error=${this.handleImageError} />
            <span class="link-icon">🔗</span>
          </div>
        `;
      } else {
        mediaHtml = html`<div class="type-placeholder">🔗 ${title.slice(0, 50)}</div>`;
      }
    } else if (media.type === 'chat') {
      const preview = (media.text || media.title || '').replace(/<[^>]+>/g, '').slice(0, 80);
      mediaHtml = html`<div class="type-placeholder text">💬 ${preview || 'Chat'}</div>`;
    } else if (media.type === 'quote') {
      const preview = (media.quoteText || '').replace(/<[^>]+>/g, '').slice(0, 80);
      mediaHtml = html`<div class="type-placeholder text">📜 "${preview || 'Quote'}"</div>`;
    } else if (media.type === 'text') {
      const decoded = this.decodeHtml(media.text || '');
      const preview = decoded.replace(/<[^>]+>/g, '').slice(0, 80);
      mediaHtml = html`<div class="type-placeholder text">📝 ${preview || 'Text'}</div>`;
    } else {
      mediaHtml = html`<div class="type-placeholder">📄 Post</div>`;
    }

    return html`
      <div class="card" @click=${this.handleClick}>
        <a
          class="post-link ${isDeleted ? 'deleted' : ''}"
          href=${isRedacted ? '#' : postUrl}
          target=${isRedacted ? '' : '_blank'}
          @click=${isRedacted ? (e: Event) => e.preventDefault() : this.handleLinkClick}
        >
          ${linkText}
        </a>
        ${mediaHtml}
        <div class="card-info">
          ${statsText ? html`<div class="card-stats">${statsText}</div>` : nothing}
          ${tags.length > 0
            ? html`
                <div class="tags">
                  ${tags.map((t) => html`<span class="tag">${t}</span>`)}
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
    'post-card': PostCard;
  }
}
