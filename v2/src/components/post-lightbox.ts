import { LitElement, html, css, nothing, unsafeCSS } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { formatDate } from '../services/date-formatter.js';
import { EventNames, type LightboxNavigateDetail } from '../types/events.js';
import { BREAKPOINTS } from '../types/ui-constants.js';
import { repeat } from 'lit/directives/repeat.js';
import { recService, type RecResult } from '../services/recommendation-api.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { POST_TYPE_ICONS, extractMedia, type ProcessedPost } from '../types/post.js';

import { resolveMediaUrl, isGif } from '../services/media-resolver.js';

@customElement('post-lightbox')
export class PostLightbox extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.7; }
        100% { transform: scale(1); opacity: 1; }
      }

      .lightbox-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        z-index: 1000;
        backdrop-filter: blur(12px);
        overflow-y: auto;
        padding: 40px 20px;
      }

      .close-btn {
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 2000;
        font-size: 28px;
        transition: all 0.2s;
        backdrop-filter: blur(4px);
      }

      .close-btn:hover {
        background: #ff4444;
        border-color: #ff4444;
        transform: scale(1.1);
      }

      /* Vertical Layout for Max Image Pixels */
      .lightbox-content {
        width: 100%;
        max-width: 1200px;
        display: flex;
        flex-direction: column;
        gap: 24px;
        margin: 0 auto;
      }

      .media-container {
        width: 100%;
        background: #000;
        border-radius: 8px;
        overflow: hidden;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      }

      .media-container img,
      .media-container video {
        max-width: 100%;
        display: block;
        height: auto;
        max-height: 85vh; /* Ensure image fits viewport height */
      }

      .info-section {
        background: var(--bg-panel);
        padding: 24px;
        border-radius: 8px;
        border: 1px solid var(--border);
        width: 100%;
      }

      .lightbox-links {
        font-size: 16px;
        margin-bottom: 16px;
        color: var(--text-muted);
      }

      .lightbox-links a {
        color: var(--accent);
        text-decoration: none;
        font-weight: 600;
      }

      .meta {
        font-size: 13px;
        color: var(--text-muted);
        margin-bottom: 20px;
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 20px;
      }

      .tag {
        background: var(--bg-panel-alt);
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 13px;
        color: var(--text);
        border: 1px solid var(--border);
      }

      /* Image Nav & Counters */
      .image-nav-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.5);
        color: white;
        border: none;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 10;
        font-size: 32px;
        transition: background 0.2s;
      }

      .image-nav-btn:hover { background: var(--accent); }
      .image-nav-btn.prev { left: 20px; }
      .image-nav-btn.next { right: 20px; }

      .image-counter {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 4px 16px;
        border-radius: 20px;
        font-size: 13px;
        z-index: 10;
      }

      /* Main Nav Buttons */
      .main-nav-btn {
        position: fixed;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(255, 255, 255, 0.05);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.1);
        width: 60px;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 1001;
        font-size: 40px;
        transition: all 0.2s;
        backdrop-filter: blur(4px);
      }

      .main-nav-btn:hover:not(:disabled) {
        background: var(--accent);
        border-color: var(--accent);
      }

      .main-nav-btn:disabled { opacity: 0.1; cursor: not-allowed; }
      .main-nav-btn.prev { left: 0; border-radius: 0 8px 8px 0; }
      .main-nav-btn.next { right: 0; border-radius: 8px 0 0 8px; }

      /* Related Gutter as a side drawer */
      .gutter-trigger {
        position: fixed;
        bottom: 20px;
        right: 80px;
        background: var(--accent);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 30px;
        cursor: pointer;
        z-index: 1001;
        font-weight: bold;
        box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* Tombstone/Error state */
      .error-ghost {
        width: 100%;
        min-height: 300px;
        background: var(--bg-panel-alt);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        border-radius: 8px;
      }

      .diagnostic-label {
        font-family: monospace;
        font-size: 10px;
        background: #000;
        color: #00ff00;
        padding: 2px 6px;
        border-radius: 4px;
        margin-bottom: 12px;
      }

      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE)}px) {
        .main-nav-btn { display: none; }
        .info-section { padding: 16px; }
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Object }) post: ProcessedPost | null = null;
  @property({ type: Array }) posts: ProcessedPost[] = [];
  @property({ type: Number }) currentIndex = -1;

  @state() private currentImageIndex = 0;
  @state() private loadingRelated = false;
  @state() private relatedPosts: RecResult[] = [];
  @state() private navigationStack: ProcessedPost[] = [];

  updated(changedProperties: Map<string, any>): void {
    super.updated(changedProperties);
    if (changedProperties.has('open')) {
      if (this.open) {
        document.body.style.overflow = 'hidden';
        this.addEventListener('keydown', this.handleKeyDown);
        this.currentImageIndex = 0;
      } else {
        document.body.style.overflow = '';
        this.removeEventListener('keydown', this.handleKeyDown);
      }
    }

    if (changedProperties.has('post') && this.post) {
      this.currentImageIndex = 0;
      this.fetchRelatedPosts(true);
      // Scroll to top of backdrop when post changes
      this.shadowRoot?.querySelector('.lightbox-backdrop')?.scrollTo(0, 0);
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.open) return;
    if (e.key === 'Escape') this.close();
    if (e.key === 'ArrowLeft') this.currentImageIndex > 0 ? this.prevImage(e) : this.navigatePrev();
    if (e.key === 'ArrowRight') {
      const files = this.post?.content?.files || [];
      this.currentImageIndex < files.length - 1 ? this.nextImage(e) : this.navigateNext();
    }
  };

  private close(e?: Event) {
    if (e) e.stopPropagation();
    this.dispatchEvent(new CustomEvent('lightbox-close', { 
      bubbles: true, 
      composed: true 
    }));
  }

  private navigatePrev() {
    if (this.currentIndex > 0) {
      this.dispatchEvent(new CustomEvent<LightboxNavigateDetail>(EventNames.LIGHTBOX_NAVIGATE, {
        detail: { direction: 'prev', index: this.currentIndex - 1 },
        bubbles: true,
        composed: true
      }));
    }
  }

  private navigateNext() {
    if (this.currentIndex < this.posts.length - 1) {
      this.dispatchEvent(new CustomEvent<LightboxNavigateDetail>(EventNames.LIGHTBOX_NAVIGATE, {
        detail: { direction: 'next', index: this.currentIndex + 1 },
        bubbles: true,
        composed: true
      }));
    }
  }

  private nextImage(e: Event) {
    e.stopPropagation();
    const files = this.post?.content?.files || [];
    if (this.currentImageIndex < files.length - 1) this.currentImageIndex++;
  }

  private prevImage(e: Event) {
    e.stopPropagation();
    if (this.currentImageIndex > 0) this.currentImageIndex--;
  }

  private async fetchRelatedPosts(clearFirst = false) {
    if (!this.post || this.loadingRelated) return;
    if (clearFirst) this.relatedPosts = [];
    this.loadingRelated = true;
    try {
      const recs = await recService.getSimilarPosts(this.post.id, 12, this.relatedPosts.length);
      const postIds = recs.map(r => r.post_id).filter((id): id is number => !!id);
      if (postIds.length > 0) {
        const batchResp = await apiClient.posts.batchGet({ post_ids: postIds });
        const hydratedMap = new Map(batchResp.posts?.map(p => [p.id, p]));
        recs.forEach(r => { if (r.post_id) (r as any)._hydratedPost = hydratedMap.get(r.post_id); });
      }
      this.relatedPosts = [...this.relatedPosts, ...recs];
    } finally {
      this.loadingRelated = false;
    }
  }

  private async navigateToRelated(rec: RecResult) {
    if (!this.post || !rec.post_id) return;
    this.navigationStack = [...this.navigationStack, this.post];
    const hydrated = (rec as any)._hydratedPost;
    if (hydrated) {
      this.post = hydrated;
    } else {
      const resp = await apiClient.posts.get(rec.post_id);
      if (resp.post) this.post = { ...resp.post, _media: extractMedia(resp.post) };
    }
  }

  private handleImageError(e: Event) {
    const img = e.target as HTMLImageElement;
    if (img.src.includes('/preview/') && !img.dataset.triedOriginal) {
      img.dataset.triedOriginal = 'true';
      img.src = img.src.replace(/\/preview\/[^/]+\//, '/');
    } else if (img.src.includes('ocdn012') && !img.dataset.triedFallback) {
      img.dataset.triedFallback = 'true';
      img.src = img.src.replace('ocdn012', 'cdn012');
    }
  }

  private renderMedia() {
    if (!this.post) return nothing;
    const media = this.post._media;
    const files = this.post.content?.files || [];
    const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
    const isTombstone = !media.url && !this.post.body;
    const currentUrl = files[this.currentImageIndex] || media.url || media.videoUrl;

    const lightboxUrl = resolveMediaUrl(currentUrl, 'lightbox');
    const posterUrl = resolveMediaUrl(currentUrl, 'poster');
    const isMediaGif = isGif(currentUrl);

    if (media.type === 'video') {
      if (media.videoUrl) {
        return html`
          <video 
            controls 
            autoplay 
            muted 
            playsinline
            webkit-playsinline
            preload="metadata"
            poster=${posterUrl}
          >
            <source src=${lightboxUrl} type="video/mp4" />
          </video>
        `;
      }
      return this.renderGhost('🎬', isAdmin, isTombstone, 'Video Unavailable');
    }

    if (media.type === 'image') {
      if (currentUrl) {
        return html`
          ${files.length > 1 ? html`
            <button class="image-nav-btn prev" ?disabled=${this.currentImageIndex === 0} @click=${this.prevImage}>‹</button>
            <button class="image-nav-btn next" ?disabled=${this.currentImageIndex === files.length - 1} @click=${this.nextImage}>›</button>
            <div class="image-counter">${this.currentImageIndex + 1} / ${files.length}</div>
          ` : ''}
          ${isMediaGif ? html`
            <video 
              autoplay 
              loop 
              muted 
              playsinline 
              webkit-playsinline
              preload="metadata"
              poster=${posterUrl}
            >
              <source src=${lightboxUrl} type="video/mp4" />
            </video>
          ` : html`
            <img src=${lightboxUrl} @error=${this.handleImageError} />
          `}
        `;
      }
      return this.renderGhost('🖼️', isAdmin, isTombstone, 'Content Unavailable');
    }

    return nothing;
  }

  private renderGhost(icon: string, isAdmin: boolean, isTombstone: boolean, label: string) {
    return html`
      <div class="error-ghost ghost" style="cursor: pointer;" @click=${() => this.shadowRoot?.querySelector('.gutter-section')?.scrollIntoView({ behavior: 'smooth' })}>
        <span class="error-icon">${icon}</span>
        ${isAdmin ? html`<span class="diagnostic-label">${isTombstone ? '[TOMBSTONE]' : '[MISSING_URL]'}</span>` : ''}
        <div style="font-size: 48px; animation: pulse 2s infinite; margin: 20px 0;">✨</div>
        <span style="font-size: 14px; opacity: 0.7;">${label}</span>
        <span style="font-size: 11px; opacity: 0.5; margin-top: 8px;">Scroll down for related alternatives</span>
      </div>
    `;
  }

  private renderLinks() {
    if (!this.post) return nothing;
    const post = this.post;
    const typeIcon = POST_TYPE_ICONS[post.type] || '📄';
    const blogName = post.blogName || 'unknown';
    const isReblog = post.originPostId && post.originPostId !== post.id;
    const rbVariants = post._reblog_variants || [];

    if (isReblog) {
      const originName = post.originBlogName || 'unknown';
      return html`
        ${typeIcon} <a href="https://${originName}.bdsmlr.com" target="_blank">@${originName}</a> / ${post.originPostId}
        via ♻️ <a href="https://${blogName}.bdsmlr.com" target="_blank">@${blogName}</a> / ${post.id}
        
        ${rbVariants.length > 0 ? html`
          <div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">
            Also reblogged by:
            <select style="background: var(--bg-panel-alt); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 2px 4px; margin-left: 4px;">
              ${rbVariants.map(v => html`<option>@${v.blogName} / ${v.id}</option>`)}
            </select>
          </div>
        ` : ''}
      `;
    }
    return html`${typeIcon} <a href="https://${blogName}.bdsmlr.com" target="_blank">@${blogName}</a> / ${post.id}`;
  }

  render() {
    if (!this.open) return nothing;
    if (!this.post) return nothing;

    return html`
      <button class="close-btn" @click=${(e: Event) => this.close(e)} title="Close (Esc)">×</button>
      
      <button class="main-nav-btn prev" ?disabled=${this.currentIndex <= 0} @click=${this.navigatePrev}>‹</button>
      <button class="main-nav-btn next" ?disabled=${this.currentIndex >= this.posts.length - 1} @click=${this.navigateNext}>›</button>

      <div class="lightbox-backdrop" @click=${(e: Event) => this.close(e)}>
        <div class="lightbox-content" @click=${(e: Event) => e.stopPropagation()}>
          
          <div class="media-container">
            ${this.renderMedia()}
          </div>

          <div class="info-section">
            <div class="lightbox-links">${this.renderLinks()}</div>
            <div class="meta">Posted ${formatDate(this.post.createdAtUnix, 'friendly')} • ${this.post.notesCount || 0} notes</div>
            <div class="tags">
              ${(this.post.tags || []).map(t => html`<span class="tag">${t}</span>`)}
            </div>
            <div class="body-text">${unsafeHTML(this.post.content?.html || this.post.body || '')}</div>
          </div>

          <div class="info-section gutter-section">
            <h3 style="margin-top: 0;">More like this ✨</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
              ${repeat(this.relatedPosts, r => r.post_id, r => {
                const hydrated = (r as any)._hydratedPost;
                const rawUrl = hydrated?._media?.url || hydrated?.content?.thumbnail;
                const thumb = resolveMediaUrl(rawUrl, 'gutter');
                return html`
                  <div class="gutter-item" @click=${() => this.navigateToRelated(r)}>
                    ${rawUrl ? html`<img src=${thumb} />` : html`<div class="gutter-skeleton"></div>`}
                  </div>
                `;
              })}
            </div>
          </div>

        </div>
      </div>
    `;
  }
}
