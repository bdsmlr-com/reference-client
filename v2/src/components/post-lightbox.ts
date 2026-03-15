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
import type { Like, Comment, Reblog, PostType } from '../types/api.js';
import './media-renderer.js';

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

      .lightbox-content { width: 100%; max-width: 80vw; display: flex; flex-direction: column; gap: 24px; margin: 0 auto; }

      .media-stack {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .media-container {
        width: 100%; border-radius: 8px; overflow: hidden;
        position: relative; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      }

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

      /* Related Gutter ✨ */
      .gutter-section { margin-top: 24px; }
      .gutter-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 12px;
        width: 100%;
      }
      .gutter-item {
        aspect-ratio: 1/1;
        background: var(--bg-panel-alt);
        border-radius: 4px;
        overflow: hidden;
        cursor: pointer;
        border: 1px solid var(--border);
        transition: transform 0.2s;
      }
      .gutter-item:hover { transform: scale(1.05); border-color: var(--accent); }

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
      } else {
        document.body.style.overflow = '';
        this.removeEventListener('keydown', this.handleKeyDown);
      }
    }

    if (changedProperties.has('post') && this.post) {
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
    if (e.key === 'ArrowLeft') this.navigatePrev();
    if (e.key === 'ArrowRight') this.navigateNext();
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
        recs.forEach(r => { 
          if (r.post_id) {
            const p = hydratedMap.get(r.post_id);
            if (p) {
              // CRITICAL: Attach extracted media metadata
              (p as any)._media = extractMedia(p);
              (r as any)._hydratedPost = p;
            }
          }
        });
      }
      this.relatedPosts = [...this.relatedPosts, ...recs];
    } finally { this.loadingRelated = false; }
  }

  private async navigateToRelated(rec: RecResult) {
    if (!this.post || !rec.post_id) return;
    this.navigationStack = [...this.navigationStack, this.post];
    const hydrated = (rec as any)._hydratedPost;
    if (hydrated) { 
      this.post = hydrated;
      this.currentIndex = -1;
    } 
    else {
      const resp = await apiClient.posts.get(rec.post_id);
      if (resp.post) {
        this.post = { ...resp.post, _media: extractMedia(resp.post) };
        this.currentIndex = -1;
      }
    }
  }

  private renderMedia() {
    if (!this.post) return nothing;
    // Defensive check: sometimes re-navigation or hydration gaps might miss this
    const media = this.post._media || extractMedia(this.post);
    if (!media) return this.renderGhost('🖼️', false, false, 'Media Error');

    const files = this.post.content?.files || [];
    const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
    const isTombstone = !media.url && !this.post.body;

    const mediaSources = files.length > 0 ? files : (media.videoUrl || media.url ? [media.videoUrl || media.url] : []);

    if (mediaSources.length === 0) {
      return this.renderGhost(media.type === 'video' ? '🎬' : '🖼️', isAdmin, isTombstone, 'Content Unavailable');
    }

    return html`
      <div class="media-stack">
        ${mediaSources.map(src => html`
          <div class="media-container">
            <media-renderer .src=${src} .type=${'lightbox'}></media-renderer>
          </div>
        `)}
      </div>
    `;
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
          <div class="media-container" style="background:transparent; box-shadow:none;">
            ${this.renderMedia()}
          </div>

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
            ${this.loadingRelated ? html`<loading-spinner message="Finding related posts..."></loading-spinner>` : ''}
            
            ${!this.loadingRelated && this.relatedPosts.length === 0 ? html`
              <div style="text-align: center; padding: 20px; opacity: 0.5; font-size: 13px;">No related posts found.</div>
            ` : ''}

            <div class="gutter-grid">
              ${repeat(this.relatedPosts, r => r.post_id, r => {
                const h = (r as any)._hydratedPost;
                if (!h) return html`<div class="gutter-skeleton"></div>`;
                
                const raw = h._media?.url || h._media?.videoUrl || h.content?.thumbnail;
                return html`
                  <div class="gutter-item" @click=${() => this.navigateToRelated(r)}>
                    <media-renderer .src=${raw} .type=${'gutter'}></media-renderer>
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
