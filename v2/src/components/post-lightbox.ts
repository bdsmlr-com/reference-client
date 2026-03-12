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
import { resolveMediaUrl, isAnimation, probeNextBucket } from '../services/media-resolver.js';
import type { Like, Comment, Reblog, PostType } from '../types/api.js';

@customElement('post-lightbox')
export class PostLightbox extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host { display: block; }

      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.7; }
        100% { transform: scale(1); opacity: 1; }
      }

      .lightbox-backdrop {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
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
        top: 20px; right: 20px;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        width: 44px; height: 44px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 2000; font-size: 28px;
        transition: all 0.2s; backdrop-filter: blur(4px);
      }
      .close-btn:hover { background: #ff4444; border-color: #ff4444; transform: scale(1.1); }

      .lightbox-content { width: 100%; max-width: 1200px; display: flex; flex-direction: column; gap: 24px; margin: 0 auto; }

      .media-container {
        width: 100%; background: #000; border-radius: 8px; overflow: hidden;
        position: relative; display: flex; align-items: center; justify-content: center;
        min-height: 200px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      }
      .media-container img, .media-container video { max-width: 100%; display: block; height: auto; max-height: 85vh; }

      .info-section { background: var(--bg-panel); padding: 24px; border-radius: 8px; border: 1px solid var(--border); width: 100%; }
      .lightbox-links { font-size: 16px; margin-bottom: 16px; color: var(--text-muted); }
      .lightbox-links a { color: var(--accent); text-decoration: none; font-weight: 600; }
      .meta { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }
      .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
      .tag { background: var(--bg-panel-alt); padding: 4px 12px; border-radius: 16px; font-size: 13px; color: var(--text); border: 1px solid var(--border); }

      /* Stats & Detail Lists */
      .stats-bar { display: flex; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 16px; }
      .stat-btn {
        background: var(--bg-panel-alt); border: 1px solid var(--border);
        padding: 6px 12px; border-radius: 20px; font-size: 13px; color: var(--text);
        cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;
      }
      .stat-btn:hover { border-color: var(--accent); }
      .stat-btn.active { background: var(--accent); color: white; border-color: var(--accent); }

      .detail-list { background: var(--bg-panel-alt); border-radius: 8px; padding: 12px; margin-top: 12px; max-height: 300px; overflow-y: auto; }
      .detail-item { padding: 8px; border-bottom: 1px solid var(--border-subtle); font-size: 13px; display: flex; align-items: center; justify-content: space-between; }
      .detail-item:last-child { border-bottom: none; }
      .detail-item a { color: var(--accent); text-decoration: none; }

      .image-nav-btn {
        position: absolute; top: 50%; transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.5); color: white; border: none;
        width: 50px; height: 50px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 10; font-size: 32px;
      }
      .image-nav-btn.prev { left: 20px; } .image-nav-btn.next { right: 20px; }
      .image-counter { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0, 0, 0, 0.6); color: white; padding: 4px 16px; border-radius: 20px; font-size: 13px; z-index: 10; }

      .main-nav-btn {
        position: fixed; top: 50%; transform: translateY(-50%);
        background: rgba(255, 255, 255, 0.05); color: white; border: 1px solid rgba(255, 255, 255, 0.1);
        width: 60px; height: 100px; display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 1001; font-size: 40px; transition: all 0.2s; backdrop-filter: blur(4px);
      }
      .main-nav-btn:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); }
      .main-nav-btn:disabled { opacity: 0.1; cursor: not-allowed; }
      .main-nav-btn.prev { left: 0; border-radius: 0 8px 8px 0; }
      .main-nav-btn.next { right: 0; border-radius: 8px 0 0 8px; }

      .error-ghost { width: 100%; min-height: 300px; background: var(--bg-panel-alt); display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); border-radius: 8px; }
      .diagnostic-label { font-family: monospace; font-size: 10px; background: #000; color: #00ff00; padding: 2px 6px; border-radius: 4px; margin-bottom: 12px; }

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

  // Interaction Details State
  @state() private activeTab: 'likes' | 'reblogs' | 'comments' | null = null;
  @state() private likes: Like[] | null = null;
  @state() private comments: Comment[] | null = null;
  @state() private reblogs: Reblog[] | null = null;
  @state() private loadingDetails = false;

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
      this.activeTab = null;
      this.likes = null;
      this.comments = null;
      this.reblogs = null;
      this.fetchRelatedPosts(true);
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
    if (e) { e.stopPropagation(); e.preventDefault(); }
    this.open = false;
    this.dispatchEvent(new CustomEvent('lightbox-close', { bubbles: true, composed: true }));
  }

  private navigatePrev() {
    if (this.currentIndex > 0) {
      this.dispatchEvent(new CustomEvent<LightboxNavigateDetail>(EventNames.LIGHTBOX_NAVIGATE, {
        detail: { direction: 'prev', index: this.currentIndex - 1 }, bubbles: true, composed: true
      }));
    }
  }

  private navigateNext() {
    if (this.currentIndex < this.posts.length - 1) {
      this.dispatchEvent(new CustomEvent<LightboxNavigateDetail>(EventNames.LIGHTBOX_NAVIGATE, {
        detail: { direction: 'next', index: this.currentIndex + 1 }, bubbles: true, composed: true
      }));
    }
  }

  private nextImage(e: Event) { e.stopPropagation(); const files = this.post?.content?.files || []; if (this.currentImageIndex < files.length - 1) this.currentImageIndex++; }
  private prevImage(e: Event) { e.stopPropagation(); if (this.currentImageIndex > 0) this.currentImageIndex--; }

  // Engagement Fetchers
  private async toggleTab(tab: 'likes' | 'reblogs' | 'comments') {
    if (this.activeTab === tab) { this.activeTab = null; return; }
    this.activeTab = tab;
    if (!this.post) return;

    this.loadingDetails = true;
    try {
      if (tab === 'likes' && !this.likes) {
        const resp = await apiClient.engagement.getLikes(this.post.id);
        this.likes = resp.likes || [];
      } else if (tab === 'reblogs' && !this.reblogs) {
        const resp = await apiClient.engagement.getReblogs(this.post.id);
        this.reblogs = resp.reblogs || [];
      } else if (tab === 'comments' && !this.comments) {
        const resp = await apiClient.engagement.getComments(this.post.id);
        this.comments = resp.comments || [];
      }
    } catch (e) {
      console.error(`Failed to fetch ${tab}`, e);
    } finally {
      this.loadingDetails = false;
    }
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
    } finally { this.loadingRelated = false; }
  }

  private async navigateToRelated(rec: RecResult) {
    if (!this.post || !rec.post_id) return;
    this.navigationStack = [...this.navigationStack, this.post];
    const hydrated = (rec as any)._hydratedPost;
    if (hydrated) { this.post = hydrated; } 
    else {
      const resp = await apiClient.posts.get(rec.post_id);
      if (resp.post) this.post = { ...resp.post, _media: extractMedia(resp.post) };
    }
  }

  private handleImageError(e: Event) {
    const el = e.target as HTMLElement;
    if (probeNextBucket(el)) return;
    
    if (el instanceof HTMLImageElement && el.src.includes('/preview/') && !el.dataset.triedOriginal) {
      el.dataset.triedOriginal = 'true'; el.src = el.src.replace(/\/preview\/[^/]+\//, '/');
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
    const isMediaAnim = isAnimation(currentUrl);

    if (media.type === 'video') {
      if (media.videoUrl) {
        return html`<video controls autoplay muted playsinline webkit-playsinline preload="metadata" poster=${posterUrl}><source src=${lightboxUrl} type="video/mp4" @error=${this.handleImageError} /></video>`;
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
          ${isMediaAnim ? html`
            <video autoplay loop muted playsinline webkit-playsinline preload="metadata" poster=${posterUrl}><source src=${lightboxUrl} type="video/mp4" @error=${this.handleImageError} /></video>
          ` : html`<img src=${lightboxUrl} @error=${this.handleImageError} />`}
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
    const p = this.post;
    const typeIcon = POST_TYPE_ICONS[p.type as PostType] || '📄';
    const isReblog = p.originPostId && p.originPostId !== p.id;
    const rbVariants = p.reblog_variants || [];

    if (isReblog) {
      return html`
        ${typeIcon} <a href="https://${p.originBlogName}.bdsmlr.com" target="_blank">@${p.originBlogName}</a> / ${p.originPostId}
        via ♻️ <a href="https://${p.blogName}.bdsmlr.com" target="_blank">@${p.blogName}</a> / ${p.id}
        
        ${rbVariants.length > 0 ? html`
          <div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">
            Also reblogged by:
            <select @change=${(e: any) => window.open(`https://bdsmlr.com/post/${e.target.value.split('/').pop().trim()}`)} style="background: var(--bg-panel-alt); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 2px 4px; margin-left: 4px;">
              <option disabled selected>Select a variant...</option>
              ${rbVariants.map(v => html`<option value="${v.id}">@${v.blogName} / ${v.id}</option>`)}
            </select>
          </div>
        ` : ''}
      `;
    }
    return html`${typeIcon} <a href="https://${p.blogName}.bdsmlr.com" target="_blank">@${p.blogName}</a> / ${p.id}`;
  }

  private renderEngagementDetail() {
    if (this.loadingDetails) return html`<loading-spinner message="Fetching details..."></loading-spinner>`;
    
    if (this.activeTab === 'likes' && this.likes) {
      return html`<div class="detail-list">${this.likes.map(l => html`<div class="detail-item"><span>❤️ by <a href="https://${l.blogName}.bdsmlr.com" target="_blank">@${l.blogName}</a></span><span class="ts">${formatDate(l.createdAtUnix, 'friendly')}</span></div>`)}</div>`;
    }
    if (this.activeTab === 'reblogs' && this.reblogs) {
      return html`<div class="detail-list">${this.reblogs.map(r => html`<div class="detail-item"><span>♻️ by <a href="https://${r.blogName}.bdsmlr.com" target="_blank">@${r.blogName}</a></span><span><a href="https://bdsmlr.com/post/${r.postId}" target="_blank">post:${r.postId}</a></span></div>`)}</div>`;
    }
    if (this.activeTab === 'comments' && this.comments) {
      return html`<div class="detail-list">${this.comments.map(c => html`<div class="detail-item"><span>💬 <b>@${c.blogName}</b>: ${c.body}</span><span class="ts">${formatDate(c.createdAtUnix, 'friendly')}</span></div>`)}</div>`;
    }
    return nothing;
  }

  render() {
    if (!this.open || !this.post) return nothing;
    const p = this.post;

    return html`
      <button class="close-btn" @click=${(e: Event) => this.close(e)} title="Close (Esc)">×</button>
      <button class="main-nav-btn prev" ?disabled=${this.currentIndex <= 0} @click=${this.navigatePrev}>‹</button>
      <button class="main-nav-btn next" ?disabled=${this.currentIndex >= this.posts.length - 1} @click=${this.navigateNext}>›</button>

      <div class="lightbox-backdrop" @click=${(e: Event) => this.close(e)}>
        <div class="lightbox-content" @click=${(e: Event) => e.stopPropagation()}>
          <div class="media-container">${this.renderMedia()}</div>

          <div class="info-section">
            <div class="lightbox-links">${this.renderLinks()}</div>
            <div class="meta">Posted ${formatDate(p.createdAtUnix, 'friendly')}</div>
            
            <div class="stats-bar">
              <button class="stat-btn ${this.activeTab === 'likes' ? 'active' : ''}" @click=${() => this.toggleTab('likes')}>❤️ ${p.likesCount || 0}</button>
              <button class="stat-btn ${this.activeTab === 'reblogs' ? 'active' : ''}" @click=${() => this.toggleTab('reblogs')}>♻️ ${p.reblogsCount || 0}</button>
              <button class="stat-btn ${this.activeTab === 'comments' ? 'active' : ''}" @click=${() => this.toggleTab('comments')}>💬 ${p.commentsCount || 0}</button>
            </div>

            ${this.renderEngagementDetail()}

            <div class="tags">${(p.tags || []).map(t => html`<span class="tag">#${t}</span>`)}</div>
            <div class="body-text">${unsafeHTML(p.content?.html || p.body || '')}</div>
          </div>

          <div class="info-section gutter-section">
            <h3 style="margin-top: 0;">More like this ✨</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
              ${repeat(this.relatedPosts, r => r.post_id, r => {
                const h = (r as any)._hydratedPost;
                const raw = h?._media?.url || h?.content?.thumbnail;
                return html`<div class="gutter-item" @click=${() => this.navigateToRelated(r)}>${raw ? html`<img src=${resolveMediaUrl(raw, 'gutter')} />` : html`<div class="gutter-skeleton"></div>`}</div>`;
              })}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
