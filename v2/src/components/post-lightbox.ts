import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
import type { Like, Comment, Reblog } from '../types/api.js';
import { listPostLikes, listPostComments, listPostReblogs, signUrl } from '../services/api.js';

@customElement('post-lightbox')
export class PostLightbox extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.95);
        z-index: 100;
        justify-content: center;
        align-items: center;
        padding: 20px;
        overflow-y: auto;
      }

      :host([open]) {
        display: flex;
      }

      .lightbox-panel {
        max-width: 90vw;
        max-height: 95vh;
        display: flex;
        flex-direction: column;
      }

      .lightbox-info {
        background: var(--bg-panel);
        padding: 16px;
        border-radius: 8px 8px 0 0;
        max-width: 600px;
      }

      .lightbox-links {
        display: flex;
        gap: 6px;
        justify-content: center;
        flex-wrap: wrap;
        font-size: 13px;
      }

      .lightbox-links a {
        color: var(--accent);
      }

      .meta {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 8px;
        text-align: center;
      }

      .lightbox-tags-container {
        max-height: 60px;
        overflow: hidden;
        cursor: pointer;
        position: relative;
        margin-top: 8px;
      }

      .lightbox-tags-container.expanded {
        max-height: none;
      }

      .lightbox-tags-container:not(.expanded)::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 20px;
        background: linear-gradient(transparent, var(--bg-panel));
        pointer-events: none;
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        justify-content: center;
      }

      .tag {
        background: var(--accent);
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
      }

      .lightbox-stats {
        margin-top: 12px;
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .stat-btn {
        cursor: pointer;
        padding: 6px 12px;
        border-radius: 6px;
        background: var(--bg-panel-alt);
        font-size: 12px;
        color: var(--text-primary);
        transition: background 0.2s;
        min-height: 36px;
      }

      .stat-btn:hover {
        background: var(--border-strong);
      }

      .stat-btn.loading {
        opacity: 0.5;
      }

      .lightbox-details {
        margin-top: 10px;
        max-height: 150px;
        overflow-y: auto;
        text-align: left;
      }

      .detail-section {
        background: var(--bg-panel-alt);
        border-radius: 6px;
        padding: 8px 12px;
      }

      .detail-item {
        font-size: 11px;
        color: var(--text-muted);
        padding: 4px 0;
        border-bottom: 1px solid var(--border);
      }

      .detail-item:last-child {
        border-bottom: none;
      }

      .detail-item a {
        color: var(--accent);
      }

      .detail-item .ts {
        font-family: monospace;
        font-size: 10px;
        color: var(--text-muted);
      }

      .lightbox-media img {
        max-width: 90vw;
        max-height: 70vh;
        object-fit: contain;
        border-radius: 0 0 8px 8px;
      }

      .lightbox-media video {
        max-width: 90vw;
        max-height: 70vh;
        border-radius: 0 0 8px 8px;
      }

      .lightbox-text {
        background: var(--bg-panel-alt);
        padding: 20px;
        border-radius: 0 0 8px 8px;
        max-width: 600px;
        max-height: 70vh;
        overflow-y: auto;
        font-size: 14px;
        line-height: 1.6;
        color: var(--text-primary);
      }

      .lightbox-text p {
        margin-bottom: 10px;
      }

      .lightbox-text a {
        color: var(--accent);
      }

      .deleted-text {
        color: var(--error);
      }

      .close-btn {
        position: absolute;
        top: 16px;
        right: 16px;
        background: var(--bg-panel);
        color: var(--text-primary);
        width: 44px;
        height: 44px;
        border-radius: 50%;
        font-size: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 101;
      }

      .close-btn:hover {
        background: var(--accent);
        color: white;
      }

      @media (max-width: 480px) {
        .lightbox-info {
          max-width: 100%;
        }
        .lightbox-text {
          max-width: 100%;
        }
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Object }) post: ProcessedPost | null = null;

  @state() private tagsExpanded = false;
  @state() private loadingLikes = false;
  @state() private loadingComments = false;
  @state() private loadingReblogs = false;
  @state() private likes: Like[] | null = null;
  @state() private comments: Comment[] | null = null;
  @state() private reblogs: Reblog[] | null = null;
  @state() private activeDetail: 'likes' | 'comments' | 'reblogs' | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.open) {
      this.close();
    }
  };

  private formatDate(unix?: number): string {
    if (!unix) return '';
    const d = new Date(unix * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }

  private decodeHtml(htmlStr: string): string {
    const txt = document.createElement('textarea');
    txt.innerHTML = htmlStr;
    return txt.value;
  }

  private handleBackdropClick(e: Event): void {
    if (e.target === e.currentTarget) {
      this.close();
    }
  }

  private close(): void {
    this.open = false;
    this.tagsExpanded = false;
    this.likes = null;
    this.comments = null;
    this.reblogs = null;
    this.activeDetail = null;
    this.dispatchEvent(new CustomEvent('close'));
  }

  private toggleTags(): void {
    this.tagsExpanded = !this.tagsExpanded;
  }

  private async fetchLikes(): Promise<void> {
    if (!this.post || this.loadingLikes) return;
    this.loadingLikes = true;
    this.activeDetail = 'likes';
    try {
      const data = await listPostLikes(this.post.id);
      this.likes = data.likes || [];
    } catch {
      this.likes = [];
    }
    this.loadingLikes = false;
  }

  private async fetchComments(): Promise<void> {
    if (!this.post || this.loadingComments) return;
    this.loadingComments = true;
    this.activeDetail = 'comments';
    try {
      const data = await listPostComments(this.post.id);
      this.comments = data.comments || [];
    } catch {
      this.comments = [];
    }
    this.loadingComments = false;
  }

  private async fetchReblogs(): Promise<void> {
    if (!this.post || this.loadingReblogs) return;
    this.loadingReblogs = true;
    this.activeDetail = 'reblogs';
    try {
      const data = await listPostReblogs(this.post.id);
      this.reblogs = data.reblogs || [];
    } catch {
      this.reblogs = [];
    }
    this.loadingReblogs = false;
  }

  private handleImageError(e: Event): void {
    const img = e.target as HTMLImageElement;
    const src = img.src;
    if (src.includes('ocdn012.bdsmlr.com') && !img.dataset.triedFallback) {
      img.dataset.triedFallback = 'true';
      img.src = src.replace('ocdn012.bdsmlr.com', 'cdn012.bdsmlr.com');
    }
  }

  private async signUnsignedImages(container: HTMLElement): Promise<void> {
    const imgs = container.querySelectorAll('img');
    for (const img of imgs) {
      if (img.src.includes('bdsmlr.com') && !img.src.includes('?t=')) {
        try {
          img.src = await signUrl(img.src);
        } catch {
          // Ignore signing errors
        }
      }
    }
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('post') && this.post) {
      this.tagsExpanded = false;
      this.likes = null;
      this.comments = null;
      this.reblogs = null;
      this.activeDetail = null;

      if (this.post._media.type === 'text') {
        requestAnimationFrame(() => {
          const textContainer = this.shadowRoot?.querySelector('.lightbox-text');
          if (textContainer) {
            this.signUnsignedImages(textContainer as HTMLElement);
          }
        });
      }
    }
  }

  private renderLinks(): unknown {
    if (!this.post) return nothing;
    const post = this.post;
    const isReblog = post.originPostId && post.originPostId !== post.id;
    const isDeleted = !!post.deletedAtUnix;
    const isOriginDeleted = !!post.originDeletedAtUnix;

    if (isReblog) {
      let originPart;
      if (isOriginDeleted) {
        originPart = html`📄 <span class="deleted-text">[deleted]</span>`;
      } else {
        const originBlogName = post.originBlogName || 'unknown';
        originPart = html`
          📄 <a href="https://${originBlogName}.bdsmlr.com" target="_blank">@${originBlogName}</a>
          / <a href="https://bdsmlr.com/post/${post.originPostId}" target="_blank">${post.originPostId} ↗</a>
        `;
      }

      let reblogPart;
      const rbIcon = isOriginDeleted ? '📌' : '♻️';
      if (isDeleted || !post.blogName) {
        reblogPart = html`${rbIcon} <span class="deleted-text">[redacted]</span>`;
      } else {
        reblogPart = html`
          ${rbIcon} <a href="https://${post.blogName}.bdsmlr.com" target="_blank">@${post.blogName}</a>
          / <a href="https://${post.blogName}.bdsmlr.com/post/${post.id}" target="_blank">${post.id} ↗</a>
        `;
      }

      return html`${originPart} via ${reblogPart}`;
    } else {
      const blogName = post.blogName || 'unknown';
      if (isDeleted) {
        return html`📄 <span class="deleted-text">@${blogName} / ${post.id} [deleted]</span>`;
      }
      return html`
        📄 <a href="https://${blogName}.bdsmlr.com" target="_blank">@${blogName}</a>
        / <a href="https://${blogName}.bdsmlr.com/post/${post.id}" target="_blank">${post.id} ↗</a>
      `;
    }
  }

  private renderMeta(): unknown {
    if (!this.post) return nothing;
    const post = this.post;
    const isReblog = post.originPostId && post.originPostId !== post.id;
    const isDeleted = !!post.deletedAtUnix;
    const isOriginDeleted = !!post.originDeletedAtUnix;

    let meta = isReblog ? `OP: ${post.originPostId} | RB: ${post.id}` : `Post: ${post.id}`;
    meta += ` | Created: ${this.formatDate(post.createdAtUnix)}`;
    if (isDeleted) meta += ` | Deleted: ${this.formatDate(post.deletedAtUnix)}`;
    if (isOriginDeleted) meta += ` | Origin deleted: ${this.formatDate(post.originDeletedAtUnix)}`;

    return meta;
  }

  private renderMedia(): unknown {
    if (!this.post) return nothing;
    const media = this.post._media;

    if (media.type === 'video' && media.videoUrl) {
      const videoUrl = media.videoUrl;
      const fallbackUrl = videoUrl.replace('ocdn012.bdsmlr.com', 'cdn012.bdsmlr.com');
      return html`
        <div class="lightbox-media">
          <video controls autoplay muted @error=${() => {
            const video = this.shadowRoot?.querySelector('video');
            if (video && video.src.includes('ocdn012')) {
              video.src = fallbackUrl;
            }
          }}>
            <source src=${videoUrl} type="video/mp4" />
          </video>
        </div>
      `;
    }

    if (media.type === 'image' && media.url) {
      return html`
        <div class="lightbox-media">
          <img src=${media.url} @error=${this.handleImageError} />
        </div>
      `;
    }

    if (media.type === 'audio' && media.audioUrl) {
      return html`
        <div class="lightbox-text">
          <audio controls autoplay style="width:100%;margin-bottom:12px;">
            <source src=${media.audioUrl} type="audio/mpeg" />
          </audio>
          ${unsafeHTML(media.html || media.text || '')}
        </div>
      `;
    }

    if (media.type === 'link') {
      const linkHtml = media.linkUrl
        ? html`<a href=${media.linkUrl} target="_blank" style="font-size:16px;display:block;margin-bottom:12px;">${media.title || media.linkUrl} ↗</a>`
        : nothing;
      const imgHtml = media.url
        ? html`<img src=${media.url} style="max-width:100%;margin-bottom:12px;border-radius:4px;" @error=${this.handleImageError} />`
        : nothing;
      return html`
        <div class="lightbox-text">
          ${linkHtml}
          ${imgHtml}
          ${unsafeHTML(media.html || media.text || '')}
        </div>
      `;
    }

    if (media.type === 'chat') {
      const title = media.title ? html`<h3 style="margin:0 0 12px 0;">${media.title}</h3>` : nothing;
      return html`<div class="lightbox-text">${title}${unsafeHTML(media.text || '')}</div>`;
    }

    if (media.type === 'quote') {
      const quote = media.quoteText
        ? html`<blockquote style="border-left:3px solid var(--accent);padding-left:12px;margin:0 0 12px 0;font-style:italic;">${media.quoteText}</blockquote>`
        : nothing;
      const source = media.quoteSource
        ? html`<div style="color:var(--text-muted);margin-bottom:12px;">— ${media.quoteSource}</div>`
        : nothing;
      return html`<div class="lightbox-text">${quote}${source}${unsafeHTML(media.html || '')}</div>`;
    }

    if (media.type === 'text') {
      const title = media.title ? html`<h3 style="margin:0 0 12px 0;">${this.decodeHtml(media.title)}</h3>` : nothing;
      const text = this.decodeHtml(media.text || '');
      return html`<div class="lightbox-text">${title}${unsafeHTML(text)}</div>`;
    }

    return html`<div class="lightbox-text"><em>No preview available</em></div>`;
  }

  private renderDetails(): unknown {
    if (this.activeDetail === 'likes' && this.likes !== null) {
      if (this.likes.length === 0) {
        return html`<div class="detail-section"><div class="detail-item">No likes</div></div>`;
      }
      return html`
        <div class="detail-section">
          ${this.likes.map((l) => {
            let nameHtml;
            if (l.blogName) {
              nameHtml = html`<a href="https://${l.blogName}.bdsmlr.com" target="_blank">${l.blogName}</a>`;
            } else if (l.blogId) {
              nameHtml = html`<a href="https://bdsmlr.com/blog/${l.blogId}" target="_blank">blog:${l.blogId}</a>`;
            } else if (l.userId) {
              nameHtml = html`user:${l.userId}`;
            } else {
              nameHtml = 'unknown';
            }
            return html`<div class="detail-item"><span class="ts">${this.formatDate(l.createdAtUnix)}</span> ❤️ by ${nameHtml}</div>`;
          })}
        </div>
      `;
    }

    if (this.activeDetail === 'comments' && this.comments !== null) {
      if (this.comments.length === 0) {
        return html`<div class="detail-section"><div class="detail-item">No comments</div></div>`;
      }
      return html`
        <div class="detail-section">
          ${this.comments.map((c) => {
            let nameHtml;
            if (c.blogName) {
              nameHtml = html`<a href="https://${c.blogName}.bdsmlr.com" target="_blank">${c.blogName}</a>`;
            } else if (c.blogId) {
              nameHtml = html`<a href="https://bdsmlr.com/blog/${c.blogId}" target="_blank">blog:${c.blogId}</a>`;
            } else if (c.userId) {
              nameHtml = html`user:${c.userId}`;
            } else {
              nameHtml = 'unknown';
            }
            return html`<div class="detail-item"><span class="ts">${this.formatDate(c.createdAtUnix)}</span> 💬 ${nameHtml}: ${c.body || ''}</div>`;
          })}
        </div>
      `;
    }

    if (this.activeDetail === 'reblogs' && this.reblogs !== null) {
      if (this.reblogs.length === 0) {
        return html`<div class="detail-section"><div class="detail-item">No reblogs</div></div>`;
      }
      return html`
        <div class="detail-section">
          ${this.reblogs.map((r) => {
            const postLink = `https://bdsmlr.com/post/${r.postId}`;
            let nameHtml;
            if (r.blogName) {
              nameHtml = html`<a href=${postLink} target="_blank">${r.blogName}</a>`;
            } else {
              nameHtml = html`<a href=${postLink} target="_blank">post:${r.postId}</a>`;
            }
            return html`<div class="detail-item"><span class="ts">${this.formatDate(r.createdAtUnix)}</span> ♻️ by ${nameHtml}</div>`;
          })}
        </div>
      `;
    }

    return nothing;
  }

  render() {
    if (!this.post) return nothing;

    return html`
      <button class="close-btn" @click=${this.close}>×</button>
      <div @click=${this.handleBackdropClick} style="display:contents;">
        <div class="lightbox-panel" @click=${(e: Event) => e.stopPropagation()}>
          <div class="lightbox-info">
            <div class="lightbox-links">${this.renderLinks()}</div>
            <div class="meta">${this.renderMeta()}</div>
            <div
              class="lightbox-tags-container ${this.tagsExpanded ? 'expanded' : ''}"
              @click=${this.toggleTags}
            >
              <div class="tags">
                ${(this.post.tags || []).map((t) => html`<span class="tag">${t}</span>`)}
              </div>
            </div>
            <div class="lightbox-stats">
              <button
                class="stat-btn ${this.loadingLikes ? 'loading' : ''}"
                @click=${this.fetchLikes}
              >
                ❤️ ${this.post.likesCount || 0}
              </button>
              <button
                class="stat-btn ${this.loadingReblogs ? 'loading' : ''}"
                @click=${this.fetchReblogs}
              >
                ♻️ ${this.post.reblogsCount || 0}
              </button>
              <button
                class="stat-btn ${this.loadingComments ? 'loading' : ''}"
                @click=${this.fetchComments}
              >
                💬 ${this.post.commentsCount || 0}
              </button>
            </div>
            <div class="lightbox-details">${this.renderDetails()}</div>
          </div>
          ${this.renderMedia()}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-lightbox': PostLightbox;
  }
}
