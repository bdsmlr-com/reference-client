import { LitElement, html, css, nothing, unsafeCSS } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { formatDate, getTooltipDate } from '../services/date-formatter.js';
import { EventNames, type LightboxNavigateDetail } from '../types/events.js';
import { BREAKPOINTS } from '../types/ui-constants.js';
import { repeat } from 'lit/directives/repeat.js';
import { when } from 'lit/directives/when.js';
import { recService, type RecResult } from '../services/recommendation-api.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { POST_TYPE_ICONS, type ProcessedPost } from '../types/post.js';
import { type PostType, type Like, type Comment } from '../types/api.js';

@customElement('post-lightbox')
export class PostLightbox extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }

      .ghost {
        background: linear-gradient(
          90deg,
          var(--bg-panel-alt) 25%,
          var(--border) 50%,
          var(--bg-panel-alt) 75%
        );
        background-size: 200% 100%;
        animation: shimmer 2s infinite linear;
      }

      .error-ghost {
        background: var(--bg-panel-alt);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        gap: 8px;
        width: 100%;
        min-height: 300px;
        border-radius: 4px;
      }

      .error-icon {
        font-size: 32px;
        opacity: 0.5;
      }

      .image-nav-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.5);
        color: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 5;
        font-size: 24px;
        transition: background 0.2s;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .image-nav-btn:hover {
        background: var(--accent);
      }

      .image-nav-btn.prev { left: 12px; }
      .image-nav-btn.next { right: 12px; }

      .image-counter {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 5;
        backdrop-filter: blur(4px);
      }

      .lightbox-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(8px);
      }

      .lightbox-panel {
        max-width: 95vw;
        width: 1200px;
        max-height: 90vh;
        display: flex;
        background: var(--bg-panel);
        border-radius: 8px;
        overflow: hidden;
        position: relative;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      }

      .lightbox-main {
        flex: 1;
        display: flex;
        flex-direction: row;
        height: 90vh;
        min-width: 0;
      }

      .media-wrapper {
        position: relative;
        width: 100%;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #000;
        overflow: hidden;
      }

      .lightbox-media {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }

      .lightbox-media img,
      .lightbox-media video {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        touch-action: none;
      }

      .lightbox-info {
        width: 400px;
        flex-shrink: 0;
        padding: 24px;
        display: flex;
        flex-direction: column;
        border-left: 1px solid var(--border);
        overflow-y: auto;
        background: var(--bg-panel);
      }

      .lightbox-links {
        font-size: 14px;
        margin-bottom: 12px;
        color: var(--text-muted);
        line-height: 1.6;
      }

      .lightbox-links a {
        color: var(--accent);
        text-decoration: none;
        font-weight: 600;
      }

      .lightbox-links a:hover {
        text-decoration: underline;
      }

      .meta {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 24px;
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 24px;
      }

      .tag {
        background: var(--bg-panel-alt);
        padding: 4px 10px;
        border-radius: 14px;
        font-size: 12px;
        color: var(--text);
        border: 1px solid var(--border);
      }

      .lightbox-stats {
        display: flex;
        gap: 16px;
        margin-bottom: 24px;
        border-bottom: 1px solid var(--border);
        padding-bottom: 16px;
      }

      .stat-btn {
        background: none;
        border: none;
        color: var(--text);
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 4px;
        transition: background 0.2s;
      }

      .stat-btn:hover {
        background: var(--bg-panel-alt);
      }

      .detail-section {
        flex: 1;
      }

      .detail-item {
        padding: 8px 0;
        font-size: 13px;
        border-bottom: 1px solid var(--border-subtle);
      }

      .close-btn {
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 1001;
        font-size: 24px;
        transition: background 0.2s;
        backdrop-filter: blur(4px);
      }

      .close-btn:hover {
        background: #ff4444;
      }

      .nav-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.5);
        color: white;
        border: none;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 1001;
        font-size: 32px;
        transition: all 0.2s;
        backdrop-filter: blur(4px);
      }

      .nav-btn:hover:not(:disabled) {
        background: var(--accent);
        width: 70px;
        height: 70px;
      }

      .nav-btn:disabled {
        opacity: 0.2;
        cursor: not-allowed;
      }

      .nav-btn.prev { left: 40px; }
      .nav-btn.next { right: 40px; }

      .nav-counter {
        position: absolute;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        background: rgba(0, 0, 0, 0.5);
        padding: 6px 16px;
        border-radius: 20px;
        font-size: 14px;
        backdrop-filter: blur(4px);
        z-index: 1001;
      }

      .related-toggle {
        position: absolute;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 10;
        font-size: 20px;
        transition: transform 0.2s;
        backdrop-filter: blur(4px);
      }

      .related-toggle:hover {
        transform: scale(1.1);
        background: var(--accent);
      }

      .related-gutter {
        width: 0;
        border-left: 0 solid var(--border);
        background: var(--bg-panel-alt);
        transition: width 0.3s ease;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .related-gutter.open {
        width: 140px;
        border-left-width: 1px;
      }

      .gutter-content {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }

      .gutter-item {
        width: 100px;
        height: auto;
        min-height: 100px;
        border-radius: 4px;
        cursor: pointer;
        border: 1px solid var(--border);
        transition: border-color 0.2s;
        background: var(--bg-panel-alt);
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .gutter-item:hover {
        border-color: var(--accent);
      }

      .gutter-item img {
        width: 100%;
        height: auto;
        display: block;
        border-radius: 3px;
      }

      .gutter-skeleton {
        width: 100px;
        height: 100px;
        flex-shrink: 0;
        background: linear-gradient(90deg, var(--bg-panel-alt) 25%, var(--border) 50%, var(--bg-panel-alt) 75%);
        background-size: 200% 100%;
        animation: gutter-pulse 1.5s infinite linear;
        border-radius: 4px;
      }

      @keyframes gutter-pulse {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      .back-stack-btn {
        position: absolute;
        top: 20px;
        left: 20px;
        background: var(--accent);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        z-index: 1001;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }

      .gutter-toast {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        background: var(--accent);
        color: white;
        padding: 8px;
        text-align: center;
        font-size: 13px;
        font-weight: 600;
        z-index: 100;
        transform: translateY(-100%);
        transition: transform 0.3s ease;
      }

      .gutter-toast.visible {
        transform: translateY(0);
      }

      .diagnostic-label {
        font-family: monospace;
        font-size: 9px;
        background: rgba(0,0,0,0.7);
        color: #00ff00;
        padding: 2px 4px;
        border-radius: 2px;
        margin-bottom: 8px;
        text-transform: uppercase;
      }

      @media (max-width: ${unsafeCSS(BREAKPOINTS.TABLET)}px) {
        .lightbox-panel {
          width: 100vw;
          height: 100vh;
          max-width: none;
          max-height: none;
          border-radius: 0;
        }
        .lightbox-main {
          flex-direction: column;
          height: 100vh;
        }
        .lightbox-info {
          width: 100%;
          height: auto;
          flex: none;
          padding: 20px;
        }
        .nav-btn {
          width: 44px;
          height: 44px;
          font-size: 24px;
        }
        .nav-btn.prev { left: 10px; }
        .nav-btn.next { right: 10px; }
      }
    `,
  ];

  @state() private currentImageIndex = 0;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Object }) post: ProcessedPost | null = null;
  @property({ type: Array }) posts: ProcessedPost[] = [];
  @property({ type: Number }) currentIndex = -1;

  @state() private likes: Like[] | null = null;
  @state() private comments: Comment[] | null = null;
  @state() private reblogs: any[] | null = null;
  @state() private activeDetail: 'likes' | 'comments' | 'reblogs' | null = null;
  
  @state() private loadingLikes = false;
  @state() private loadingComments = false;
  @state() private loadingReblogs = false;
  @state() private loadingRelated = false;
  @state() private gutterOpen = false;
  @state() private relatedPosts: RecResult[] = [];
  @state() private toastMessage: string | null = null;
  @state() private navigationStack: ProcessedPost[] = [];

  @state() private tagsExpanded = false;

  // Zoom/Pinch state
  @state() private zoomScale = 1;
  @state() private zoomTranslateX = 0;
  @state() private zoomTranslateY = 0;
  private isPinching = false;
  private initialPinchDistance = 0;
  private initialPinchScale = 1;
  private zoomHintTimeout: any = null;
  @state() private showZoomHint = false;

  private previouslyFocusedElement: HTMLElement | null = null;

  updated(changedProperties: Map<string, any>): void {
    super.updated(changedProperties);
    if (changedProperties.has('open')) {
      if (this.open) {
        this.previouslyFocusedElement = document.activeElement as HTMLElement;
        document.body.style.overflow = 'hidden';
        this.addEventListener('keydown', this.handleKeyDown);
        this.resetZoom();
        this.currentImageIndex = 0;
        this.showZoomHintTemporarily();
      } else {
        document.body.style.overflow = '';
        this.removeEventListener('keydown', this.handleKeyDown);
        if (this.previouslyFocusedElement) {
          this.previouslyFocusedElement.focus();
          this.previouslyFocusedElement = null;
        }
      }
    }

    if (changedProperties.has('post') && this.post) {
      this.currentImageIndex = 0;
      this.tagsExpanded = false;
      this.likes = null;
      this.comments = null;
      this.reblogs = null;
      this.activeDetail = null;
      this.resetZoom();
      this.shadowRoot?.querySelector('.lightbox-media')?.scrollTo(0, 0);
      this.shadowRoot?.querySelector('.lightbox-info')?.scrollTo(0, 0);
      
      // Refresh related if gutter is open
      if (this.gutterOpen) {
        this.fetchRelatedPosts(true);
      }
    }
  }

  private nextImage(e: Event): void {
    e.stopPropagation();
    const files = this.post?.content?.files || [];
    if (this.currentImageIndex < files.length - 1) {
      this.currentImageIndex++;
      this.resetZoom();
    }
  }

  private prevImage(e: Event): void {
    e.stopPropagation();
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
      this.resetZoom();
    }
  }

  private resetZoom(): void {
    this.zoomScale = 1;
    this.zoomTranslateX = 0;
    this.zoomTranslateY = 0;
    this.showZoomHint = false;
  }

  private showZoomHintTemporarily(): void {
    if (this.zoomHintTimeout) {
      clearTimeout(this.zoomHintTimeout);
    }
    this.showZoomHint = true;
    this.zoomHintTimeout = setTimeout(() => {
      this.showZoomHint = false;
    }, 3000);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.open) return;
    
    switch (e.key) {
      case 'Escape':
        this.close();
        break;
      case 'ArrowLeft':
        if (this.currentImageIndex > 0) {
          this.prevImage(e);
        } else {
          this.navigatePrev();
        }
        break;
      case 'ArrowRight':
        const files = this.post?.content?.files || [];
        if (this.currentImageIndex < files.length - 1) {
          this.nextImage(e);
        } else {
          this.navigateNext();
        }
        break;
    }
  };

  private close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent(EventNames.CLOSE));
  }

  private navigatePrev() {
    if (this.hasPrev) {
      this.dispatchEvent(new CustomEvent<LightboxNavigateDetail>(EventNames.NAVIGATE, {
        detail: { direction: 'prev', index: this.currentIndex - 1 }
      }));
    }
  }

  private navigateNext() {
    if (this.hasNext) {
      this.dispatchEvent(new CustomEvent<LightboxNavigateDetail>(EventNames.NAVIGATE, {
        detail: { direction: 'next', index: this.currentIndex + 1 }
      }));
    }
  }


  private get hasPrev() {
    return this.currentIndex > 0;
  }

  private get hasNext() {
    return this.currentIndex < this.posts.length - 1;
  }

  private get canNavigate() {
    return this.posts.length > 1;
  }

  private handleBackdropClick() {
    this.close();
  }

  private toggleTags(e: Event) {
    e.stopPropagation();
    this.tagsExpanded = !this.tagsExpanded;
  }

  private async fetchLikes() {
    if (!this.post || this.loadingLikes) return;
    if (this.activeDetail === 'likes') {
      this.activeDetail = null;
      return;
    }
    this.loadingLikes = true;
    try {
      const resp = await apiClient.engagement.getLikes(this.post.id);
      this.likes = resp.likes || [];
      this.activeDetail = 'likes';
    } catch (e) {
      this.likes = [];
    } finally {
      this.loadingLikes = false;
    }
  }

  private async fetchComments() {
    if (!this.post || this.loadingComments) return;
    if (this.activeDetail === 'comments') {
      this.activeDetail = null;
      return;
    }
    this.loadingComments = true;
    try {
      const resp = await apiClient.engagement.getComments(this.post.id);
      this.comments = resp.comments || [];
      this.activeDetail = 'comments';
    } catch (e) {
      this.comments = [];
    } finally {
      this.loadingComments = false;
    }
  }

  private async fetchReblogs() {
    if (!this.post || this.loadingReblogs) return;
    if (this.activeDetail === 'reblogs') {
      this.activeDetail = null;
      return;
    }
    this.loadingReblogs = true;
    try {
      const resp = await apiClient.engagement.getReblogs(this.post.id);
      this.reblogs = resp.reblogs || [];
      this.activeDetail = 'reblogs';
    } catch (e) {
      this.reblogs = [];
    } finally {
      this.loadingReblogs = false;
    }
  }

  private async toggleGutter() {
    this.gutterOpen = !this.gutterOpen;
    if (this.gutterOpen && this.relatedPosts.length === 0) {
      this.fetchRelatedPosts(true);
    }
  }

  private async fetchRelatedPosts(clearFirst = false) {
    if (!this.post || this.loadingRelated) return;
    
    if (clearFirst) {
      this.relatedPosts = [];
    }

    this.loadingRelated = true;
    try {
      const recs = await recService.getSimilarPosts(this.post.id, 12, this.relatedPosts.length);
      const postIds = recs.map(r => r.post_id).filter((id): id is number => !!id);
      
      if (postIds.length > 0) {
        const batchResp = await apiClient.posts.batchGet({ post_ids: postIds });
        const hydratedMap = new Map(batchResp.posts?.map(p => [p.id, p]));
        
        recs.forEach(r => {
          if (r.post_id) {
            (r as any)._hydratedPost = hydratedMap.get(r.post_id);
          }
        });
      }

      this.relatedPosts = [...this.relatedPosts, ...recs];
    } catch (e) {
      console.error('Failed to fetch related posts', e);
    } finally {
      this.loadingRelated = false;
    }
  }

  private handleGutterScroll(e: Event) {
    const el = e.target as HTMLElement;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      this.fetchRelatedPosts(false);
    }
  }

  private showToast(msg: string) {
    this.toastMessage = msg;
    setTimeout(() => {
      this.toastMessage = null;
    }, 3000);
  }

  /**
   * Normalize any CDN URL to fix broken TLS on ocdn012.
   */
  private normalizeUrl(url: string | undefined): string {
    if (!url) return '';
    let normalized = url;
    if (normalized.includes('ocdn012.bdsmlr.com')) {
      normalized = normalized.replace('ocdn012.bdsmlr.com', 'cdn012.bdsmlr.com');
    }
    return normalized;
  }

  /**
   * Rewrite CDN URLs to use imageproxy for thumbnails.
   */
  private getProxyUrl(url: string | undefined): string {
    if (!url) return '';
    const normalized = this.normalizeUrl(url);
    if (normalized.includes('bdsmlr.com/uploads/') && !normalized.includes('/preview/')) {
      return normalized.replace('/uploads/', '/uploads/preview/100x/');
    }
    return normalized;
  }

  private async navigateToRelated(rec: RecResult): Promise<void> {
    if (!this.post || !rec.post_id) return;
    
    // Push current to stack
    this.navigationStack = [...this.navigationStack, this.post];
    
    const hydrated = (rec as any)._hydratedPost;
    if (hydrated) {
      this.post = hydrated;
    } else {
      // Fallback: fetch detail if not hydrated
      try {
        const resp = await apiClient.posts.get(rec.post_id);
        if (resp.post) {
          this.post = {
            ...resp.post,
            _media: extractMedia(resp.post)
          };
        }
      } catch (e) {
        this.showToast('Failed to load related post');
      }
    }
  }

  private popStack() {
    if (this.navigationStack.length === 0) return;
    const prev = this.navigationStack[this.navigationStack.length - 1];
    this.navigationStack = this.navigationStack.slice(0, -1);
    this.post = prev;
  }

  private handleImageError(e: Event): void {
    const img = e.target as HTMLImageElement;
    const src = img.src;

    if (src.includes('/preview/') && !img.dataset.triedOriginal) {
      img.dataset.triedOriginal = 'true';
      img.src = src.replace(/\/preview\/[^/]+\//, '/');
      return;
    }

    if (src.includes('ocdn012.bdsmlr.com') && !img.dataset.triedFallback) {
      img.dataset.triedFallback = 'true';
      img.src = src.replace('ocdn012.bdsmlr.com', 'cdn012.bdsmlr.com');
      return;
    }

    if (!img.dataset.showedPlaceholder) {
      img.dataset.showedPlaceholder = 'true';
      img.style.display = 'none';
      const placeholder = document.createElement('div');
      const isInGutter = img.closest('.gutter-content');
      placeholder.className = isInGutter ? 'gutter-skeleton' : 'error-ghost ghost';
      if (!isInGutter) {
        placeholder.innerHTML = `
          <span class="error-icon">🖼️</span>
          <span style="font-size: 13px; opacity: 0.7;">Content Unavailable</span>
        `;
      }
      img.parentElement?.insertBefore(placeholder, img);
    }
  }

  private renderLinks(): unknown {
    if (!this.post) return nothing;
    const post = this.post;
    const isReblog = post.originPostId && post.originPostId !== post.id;
    const isDeleted = !!post.deletedAtUnix;
    const isOriginDeleted = !!post.originDeletedAtUnix;

    const typeVal = typeof post.type === 'string' ? {
      'POST_TYPE_TEXT': 1,
      'POST_TYPE_IMAGE': 2,
      'POST_TYPE_VIDEO': 3,
      'POST_TYPE_AUDIO': 4,
      'POST_TYPE_LINK': 5,
      'POST_TYPE_CHAT': 6,
      'POST_TYPE_QUOTE': 7
    }[post.type] || parseInt(post.type, 10) : post.type;

    const typeIcon = POST_TYPE_ICONS[typeVal as PostType] || '📄';

    if (isReblog) {
      let originPart;
      if (isOriginDeleted) {
        originPart = html`${typeIcon} <span class="deleted-text">[deleted]</span>`;
      } else {
        const originBlogName = post.originBlogName || 'unknown';
        originPart = html`
          ${typeIcon} <a href="https://${originBlogName}.bdsmlr.com" target="_blank">@${originBlogName}</a>
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
        return html`${typeIcon} <span class="deleted-text">@${blogName} / ${post.id} [deleted]</span>`;
      }
      return html`
        ${typeIcon} <a href="https://${blogName}.bdsmlr.com" target="_blank">@${blogName}</a>
        / <a href="https://${blogName}.bdsmlr.com/post/${post.id}" target="_blank">${post.id} ↗</a>
      `;
    }
  }

  private renderMeta(): unknown {
    if (!this.post) return nothing;
    return html`
      <div class="ts" title="${getTooltipDate(this.post.createdAtUnix)}">
        Posted ${formatDate(this.post.createdAtUnix, 'friendly')}
      </div>
    `;
  }

  private renderMedia(): unknown {
    if (!this.post) return nothing;
    const post = this.post;
    const media = post._media;
    const files = post.content?.files || [];
    const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
    const isTombstone = !media.url && !post.body;

    if (media.type === 'video') {
      if (media.videoUrl) {
        const videoUrl = this.normalizeUrl(media.videoUrl);
        return html`
          <div class="lightbox-media">
            <video controls autoplay muted @error=${(e: any) => {
              if (e.target.src.includes('ocdn012')) {
                e.target.src = e.target.src.replace('ocdn012.bdsmlr.com', 'cdn012.bdsmlr.com');
              }
            }}>
              <source src=${videoUrl} type="video/mp4" />
            </video>
          </div>
        `;
      } else {
        return html`
          <div class="error-ghost ghost" style="min-height: 300px; cursor: pointer;" @click=${this.toggleGutter}>
            <span class="error-icon">🎬</span>
            ${isAdmin ? html`<span class="diagnostic-label">${isTombstone ? '[TOMBSTONE]' : '[MISSING_URL]'}</span>` : ''}
            <div style="font-size: 48px; animation: pulse 2s infinite; margin: 20px 0;">✨</div>
            <span style="font-size: 14px; opacity: 0.7;">Video Unavailable</span>
            <span style="font-size: 11px; opacity: 0.5; margin-top: 8px;">Click for related alternatives</span>
          </div>
        `;
      }
    }

    if (media.type === 'image') {
      const currentUrl = files[this.currentImageIndex] || media.url;
      if (currentUrl) {
        const imageUrl = this.normalizeUrl(currentUrl);
        const zoomStyle = `transform: scale(${this.zoomScale}) translate(${this.zoomTranslateX / this.zoomScale}px, ${this.zoomTranslateY / this.zoomScale}px)`;
        
        return html`
          <div class="lightbox-media">
            ${files.length > 1 ? html`
              <button class="image-nav-btn prev" ?disabled=${this.currentImageIndex === 0} @click=${this.prevImage}>‹</button>
              <button class="image-nav-btn next" ?disabled=${this.currentImageIndex === files.length - 1} @click=${this.nextImage}>›</button>
              <div class="image-counter">${this.currentImageIndex + 1} / ${files.length}</div>
            ` : ''}
            <img
              src=${imageUrl}
              class=${this.zoomScale > 1 ? 'zoomed' : ''}
              style=${zoomStyle}
              @error=${this.handleImageError}
              @touchstart=${this.handleImageTouchStart}
              @touchmove=${this.handleImageTouchMove}
              @touchend=${this.handleImageTouchEnd}
              @dblclick=${this.handleImageDoubleTap}
            />
          </div>
        `;
      } else {
        return html`
          <div class="error-ghost ghost" style="min-height: 300px; cursor: pointer;" @click=${this.toggleGutter}>
            <span class="error-icon">🖼️</span>
            ${isAdmin ? html`<span class="diagnostic-label">${isTombstone ? '[TOMBSTONE]' : '[MISSING_URL]'}</span>` : ''}
            <div style="font-size: 48px; animation: pulse 2s infinite; margin: 20px 0;">✨</div>
            <span style="font-size: 14px; opacity: 0.7;">Content Unavailable</span>
            <span style="font-size: 11px; opacity: 0.5; margin-top: 8px;">Click for related alternatives</span>
          </div>
        `;
      }
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
        ? html`<img src=${this.normalizeUrl(media.url)} style="max-width:100%;margin-bottom:12px;border-radius:4px;" @error=${this.handleImageError} />`
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
      const title = media.title ? html`<h3 style="margin:0 0 12px 0;">${media.title}</h3>` : nothing;
      const text = media.text || '';
      return html`<div class="lightbox-text">${title}${unsafeHTML(text)}</div>`;
    }

    return html`<div class="lightbox-text"><em>No preview available</em></div>`;
  }

  private renderDetails(): unknown {
    if (this.activeDetail === 'likes' && this.likes !== null) {
      if (this.likes.length === 0) {
        return html`<div class="detail-section"><div class="detail-item">No likes</div></div>`;
      }
      const identifiedLikes = this.likes.filter((l) => l.blogName || l.blogId);
      const anonymousCount = this.likes.length - identifiedLikes.length;

      return html`
        <div class="detail-section">
          ${identifiedLikes.map((l) => {
            let nameHtml;
            if (l.blogName) {
              nameHtml = html`<a href="https://${l.blogName}.bdsmlr.com" target="_blank">@${l.blogName}</a>`;
            } else {
              nameHtml = html`<a href="https://bdsmlr.com/blog/${l.blogId}" target="_blank">blog #${l.blogId}</a>`;
            }
            return html`<div class="detail-item"><span class="ts" title="${getTooltipDate(l.createdAtUnix)}">${formatDate(l.createdAtUnix, 'friendly')}</span> ❤️ by ${nameHtml}</div>`;
          })}
          ${anonymousCount > 0
            ? html`<div class="detail-item" style="opacity: 0.7;">+ ${anonymousCount} anonymous user${anonymousCount > 1 ? 's' : ''}</div>`
            : ''}
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
              nameHtml = html`<a href="https://${c.blogName}.bdsmlr.com" target="_blank">@${c.blogName}</a>`;
            } else if (c.blogId) {
              nameHtml = html`<a href="https://bdsmlr.com/blog/${c.blogId}" target="_blank">blog #${c.blogId}</a>`;
            } else {
              nameHtml = html`<span style="opacity: 0.7;">anonymous</span>`;
            }
            return html`<div class="detail-item"><span class="ts" title="${getTooltipDate(c.createdAtUnix)}">${formatDate(c.createdAtUnix, 'friendly')}</span> 💬 ${nameHtml}: ${c.body || ''}</div>`;
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
            return html`<div class="detail-item"><span class="ts" title="${getTooltipDate(r.createdAtUnix)}">${formatDate(r.createdAtUnix, 'friendly')}</span> ♻️ by ${nameHtml}</div>`;
          })}
        </div>
      `;
    }

    return nothing;
  }

  private renderGutterItem(rec: any) {
    const hydrated = rec._hydratedPost;
    const thumbUrl = this.getProxyUrl(hydrated?._media?.url);
    
    return html`
      <div 
        class="gutter-item" 
        @click=${() => this.navigateToRelated(rec)} 
        title="Post by @${rec.post_owner}"
      >
        ${when(
          thumbUrl,
          () => html`<img src=${thumbUrl!} alt="Related" @error=${(e: any) => e.target.src = 'https://bdsmlr.com/static/img/no-image.png'} />`,
          () => html`<div class="gutter-skeleton"></div>`
        )}
      </div>
    `;
  }

  render() {
    if (!this.post) return nothing;

    const post = this.post;
    const isReblog = post.originPostId && post.originPostId !== post.id;
    const isDeleted = !!post.deletedAtUnix;
    const isRedacted = isDeleted || (!post.blogName && isReblog);
    const isTombstone = !post._media?.url && !post.body;

    return html`
      <button class="close-btn" @click=${this.close} aria-label="Close lightbox">×</button>
      
      ${this.navigationStack.length > 0
        ? html`
            <button class="back-stack-btn" @click=${this.popStack}>
              ← Back to previous post
            </button>
          `
        : nothing}

      ${this.currentIndex >= 0 && this.canNavigate
        ? html`
            <button
              class="nav-btn prev"
              ?disabled=${!this.hasPrev}
              @click=${this.navigatePrev}
              title="Previous (←)"
              aria-label="Previous post"
            >
              ‹
            </button>
            <button
              class="nav-btn next"
              ?disabled=${!this.hasNext}
              @click=${this.navigateNext}
              title="Next (→)"
              aria-label="Next post"
            >
              ›
            </button>
            <div class="nav-counter" aria-live="polite">${this.currentIndex + 1} / ${this.posts.length}</div>
          `
        : nothing}
      <div class="zoom-hint ${this.showZoomHint ? 'visible' : ''}" aria-hidden="true">
        ${this.zoomScale > 1 ? `${Math.round(this.zoomScale * 100)}% • Double-tap to reset` : 'Pinch to zoom'}
      </div>
      <div
        class="lightbox-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Post detail lightbox"
        @click=${this.handleBackdropClick}
        @touchstart=${this.handleTouchStart}
        @touchmove=${this.handleTouchMove}
        @touchend=${this.handleTouchEnd}
      >
        <div class="lightbox-panel" @click=${(e: Event) => e.stopPropagation()}>
          <div class="gutter-toast ${this.toastMessage ? 'visible' : ''}">
            ${this.toastMessage}
          </div>
          
          <div class="lightbox-main">
            <div class="media-wrapper">
              ${this.renderMedia()}
              <button class="related-toggle" @click=${this.toggleGutter} title="Related content">
                ${this.loadingRelated ? html`...` : html`✨`}
              </button>
            </div>
            
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
                  aria-label="Show ${this.post.likesCount || 0} likes"
                  aria-busy=${this.loadingLikes}
                >
                  ❤️ ${this.post.likesCount || 0}${this.loadingLikes ? '...' : ''}
                </button>
                <button
                  class="stat-btn ${this.loadingReblogs ? 'loading' : ''}"
                  @click=${this.fetchReblogs}
                  aria-label="Show ${this.post.reblogsCount || 0} reblogs"
                  aria-busy=${this.loadingReblogs}
                >
                  ♻️ ${this.post.reblogsCount || 0}${this.loadingReblogs ? '...' : ''}
                </button>
                <button
                  class="stat-btn ${this.loadingComments ? 'loading' : ''}"
                  @click=${this.fetchComments}
                  aria-label="Show ${this.post.commentsCount || 0} comments"
                  aria-busy=${this.loadingComments}
                >
                  💬 ${this.post.commentsCount || 0}${this.loadingComments ? '...' : ''}
                </button>
              </div>
              <div class="lightbox-details">${this.renderDetails()}</div>
            </div>
          </div>

          <aside class="related-gutter ${this.gutterOpen ? 'open' : ''}">
            <div class="gutter-content" @scroll=${this.handleGutterScroll}>
              <div style="font-weight: 600; margin-bottom: 8px;">More like this</div>
              
              ${repeat(
                this.relatedPosts || [],
                (rec: any) => rec.post_id || Math.random(),
                (rec: any) => this.renderGutterItem(rec)
              )}

              ${this.loadingRelated 
                ? html`
                    <div class="gutter-skeleton"></div>
                    <div class="gutter-skeleton"></div>
                    <div class="gutter-skeleton"></div>
                  `
                : ''}
            </div>
          </aside>
        </div>
      </div>
    `;
  }

  // Double tap to zoom helper
  private lastTap = 0;
  private handleImageDoubleTap(e: MouseEvent) {
    const now = Date.now();
    if (now - this.lastTap < 300) {
      if (this.zoomScale > 1) {
        this.resetZoom();
      } else {
        this.zoomScale = 2;
      }
    }
    this.lastTap = now;
  }

  // Touch handlers for zoom/pinch
  private handleImageTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      this.isPinching = true;
      this.initialPinchDistance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      this.initialPinchScale = this.zoomScale;
    }
  }

  private handleImageTouchMove(e: TouchEvent) {
    if (this.isPinching && e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const ratio = distance / this.initialPinchDistance;
      this.zoomScale = Math.min(Math.max(1, this.initialPinchScale * ratio), 4);
    }
  }

  private handleImageTouchEnd() {
    this.isPinching = false;
  }

  private handleTouchStart() {
    // Backdrop touch handling if needed
  }

  private handleTouchMove() {
    // Backdrop touch handling if needed
  }

  private handleTouchEnd() {
    // Backdrop touch handling if needed
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-lightbox': PostLightbox;
  }
}
