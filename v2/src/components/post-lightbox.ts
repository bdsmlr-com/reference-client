import { LitElement, html, css, nothing, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
import type { Like, Comment, Reblog } from '../types/api.js';
import { apiClient } from '../services/client.js';
import { formatDate, getTooltipDate } from '../services/date-formatter.js';
import { EventNames, type LightboxNavigateDetail } from '../types/events.js';
import { BREAKPOINTS } from '../types/ui-constants.js';
// Z-index values follow scale from types/ui-constants.ts: STICKY=50, DROPDOWN=100, MODAL=1000, MODAL_CONTROLS=1001

import { repeat } from 'lit/directives/repeat.js';
import { when } from 'lit/directives/when.js';
import { recService, type RecResult } from '../services/recommendation-api.js';

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
        z-index: 1000; /* Z_INDEX.MODAL - above sticky nav (50) and dropdowns (100) */
        justify-content: center;
        align-items: center;
        padding: 20px;
        overflow-y: auto;
      }

      :host([open]) {
        display: flex;
      }

      .lightbox-backdrop {
        position: fixed;
        inset: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 60px 20px 20px;
        overflow-y: auto;
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

      .lightbox-panel {
        max-width: 95vw;
        width: 1200px;
        max-height: 90vh;
        display: flex;
        flex-direction: row;
        align-items: stretch;
        position: relative;
        overflow: hidden;
        background: var(--bg-panel);
        border-radius: 8px;
        transition: width 0.3s ease;
      }

      .lightbox-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        min-width: 0;
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

      .media-wrapper {
        position: relative;
        width: 100%;
        flex: 1;
        display: flex;
        background: black;
        overflow: hidden;
      }

      .lightbox-media {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .related-toggle {
        position: absolute;
        top: 12px;
        right: 12px;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 10;
        font-size: 18px;
        transition: background 0.2s;
      }

      .related-toggle:hover {
        background: var(--accent);
      }

      .related-gutter {
        width: 0;
        background: var(--bg-panel-alt);
        border-left: 0 solid var(--border);
        display: flex;
        flex-direction: column;
        transition: width 0.3s ease, border-width 0.3s;
        overflow: hidden;
      }

      .related-gutter.open {
        width: 130px;
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

      .gutter-item img {
        width: 100%;
        height: auto;
        display: block;
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

      .gutter-toast {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        background: var(--accent);
        color: white;
        padding: 8px 16px;
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

      .lightbox-media img, .lightbox-media video {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      .back-stack-btn {
        position: absolute;
        top: -40px;
        left: 0;
        background: var(--accent);
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        z-index: 1002;
      }

      .back-stack-btn:hover {
        background: var(--accent-hover);
      }

      .lightbox-info {
        background: var(--bg-panel);
        padding: 16px;
        width: 100%;
        max-width: 800px;
        box-sizing: border-box;
        overflow-y: auto;
        max-height: 40vh;
      }

      /* Related posts styles */
      .related-section {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid var(--border);
        width: 100%;
      }

      .related-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .related-grid {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 8px;
        scrollbar-width: thin;
      }

      .related-item {
        flex: 0 0 auto;
        width: 150px;
        height: auto;
        border-radius: 4px;
        overflow: hidden;
        cursor: pointer;
        background: var(--bg-panel-alt);
        border: 1px solid var(--border);
      }

      .related-item img {
        width: 100%;
        height: auto;
        display: block;
      }

      .related-item:hover {
        border-color: var(--accent);
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

      .lightbox-media {
        width: 100%;
        max-width: 800px;
        display: flex;
        justify-content: center;
      }

      .lightbox-media img {
        width: 100%;
        max-width: 800px;
        max-height: 70vh;
        object-fit: contain;
        border-radius: 0 0 8px 8px;
        touch-action: none;
        transition: transform 0.1s ease-out;
      }

      .lightbox-media img.zoomed {
        cursor: grab;
      }

      .lightbox-media img.zoomed:active {
        cursor: grabbing;
      }

      .zoom-hint {
        position: absolute;
        bottom: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg-panel);
        color: var(--text-muted);
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 11px;
        z-index: 1001; /* Z_INDEX.MODAL_CONTROLS */
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
      }

      .zoom-hint.visible {
        opacity: 1;
      }

      .lightbox-media video {
        width: 100%;
        max-width: 800px;
        max-height: 70vh;
        border-radius: 0 0 8px 8px;
      }

      .lightbox-text {
        background: var(--bg-panel-alt);
        padding: 20px;
        border-radius: 0 0 8px 8px;
        width: 100%;
        max-width: 800px;
        max-height: 70vh;
        overflow-y: auto;
        font-size: 14px;
        line-height: 1.6;
        color: var(--text-primary);
        box-sizing: border-box;
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
        z-index: 1001; /* Z_INDEX.MODAL_CONTROLS */
      }

      .close-btn:hover {
        background: var(--accent);
        color: white;
      }

      .nav-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
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
        z-index: 1001; /* Z_INDEX.MODAL_CONTROLS */
        transition: all 0.2s;
      }

      .nav-btn:hover:not(:disabled) {
        background: var(--accent);
        color: white;
      }

      .nav-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .nav-btn.prev {
        left: 16px;
      }

      .nav-btn.next {
        right: 16px;
      }

      .nav-counter {
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg-panel);
        color: var(--text-muted);
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        z-index: 1001; /* Z_INDEX.MODAL_CONTROLS */
      }

      /* Mobile: max-width below BREAKPOINTS.MOBILE */
      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {
        .lightbox-info {
          max-width: 100%;
        }
        .lightbox-text {
          max-width: 100%;
        }
      }
    `,
  ];

  @state() private currentImageIndex = 0;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Object }) post: ProcessedPost | null = null;
  @property({ type: Array }) posts: ProcessedPost[] = [];
  @property({ type: Number }) currentIndex = -1;

  @state() private tagsExpanded = false;
  @state() private loadingLikes = false;
  @state() private loadingComments = false;
  @state() private loadingReblogs = false;
  @state() private likes: Like[] | null = null;
  @state() private comments: Comment[] | null = null;
  @state() private reblogs: Reblog[] | null = null;
  @state() private activeDetail: 'likes' | 'comments' | 'reblogs' | null = null;

  // Deep Dive Stack
  @state() private navigationStack: ProcessedPost[] = [];
  @state() private relatedPosts: RecResult[] | null = null;
  @state() private loadingRelated = false;
  @state() private gutterOpen = false;
  @state() private gutterExhausted = false;
  @state() private gutterOffset = 0;
  @state() private toastMessage = '';

  // Touch/swipe tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;
  private isSwiping = false;

  // Pinch-to-zoom tracking
  @state() private zoomScale = 1;
  @state() private zoomTranslateX = 0;
  @state() private zoomTranslateY = 0;
  @state() private showZoomHint = false;
  private isPinching = false;
  private pinchStartDistance = 0;
  private pinchStartScale = 1;
  private panStartX = 0;
  private panStartY = 0;
  private panStartTranslateX = 0;
  private panStartTranslateY = 0;
  private isPanning = false;
  private zoomHintTimeout: ReturnType<typeof setTimeout> | null = null;

  // Focus trap tracking
  private previouslyFocusedElement: HTMLElement | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleTouchStart = (e: TouchEvent): void => {
    if (!this.canNavigate) return;
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.isSwiping = true;
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (!this.isSwiping) return;
    const touch = e.touches[0];
    this.touchEndX = touch.clientX;
    this.touchEndY = touch.clientY;
  };

  private handleTouchEnd = (): void => {
    if (this.isPinching) {
      this.isPinching = false;
      // Show zoom hint if zoomed in
      if (this.zoomScale > 1) {
        this.showZoomHintTemporarily();
      }
      return;
    }

    if (this.isPanning) {
      this.isPanning = false;
      return;
    }

    if (!this.isSwiping) return;
    this.isSwiping = false;

    const deltaX = this.touchEndX - this.touchStartX;
    const deltaY = this.touchEndY - this.touchStartY;
    const minSwipeDistance = 50;

    // Only trigger if horizontal swipe is dominant (more horizontal than vertical)
    // and not zoomed in
    if (this.zoomScale === 1 && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        // Swipe right -> previous
        this.navigatePrev();
      } else {
        // Swipe left -> next
        this.navigateNext();
      }
    }

    // Reset
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchEndX = 0;
    this.touchEndY = 0;
  };

  // Pinch-to-zoom handlers
  private getDistanceBetweenTouches(touches: TouchList): number {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private handleImageTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      // Start pinch gesture
      e.preventDefault();
      this.isPinching = true;
      this.isSwiping = false;
      this.pinchStartDistance = this.getDistanceBetweenTouches(e.touches);
      this.pinchStartScale = this.zoomScale;
    } else if (e.touches.length === 1 && this.zoomScale > 1) {
      // Start pan gesture when zoomed
      e.preventDefault();
      this.isPanning = true;
      this.isSwiping = false;
      this.panStartX = e.touches[0].clientX;
      this.panStartY = e.touches[0].clientY;
      this.panStartTranslateX = this.zoomTranslateX;
      this.panStartTranslateY = this.zoomTranslateY;
    }
  };

  private handleImageTouchMove = (e: TouchEvent): void => {
    if (this.isPinching && e.touches.length === 2) {
      e.preventDefault();
      const currentDistance = this.getDistanceBetweenTouches(e.touches);
      const scaleDelta = currentDistance / this.pinchStartDistance;
      let newScale = this.pinchStartScale * scaleDelta;

      // Clamp scale between 1x and 4x
      newScale = Math.max(1, Math.min(4, newScale));
      this.zoomScale = newScale;

      // Reset translation when zooming back to 1x
      if (newScale === 1) {
        this.zoomTranslateX = 0;
        this.zoomTranslateY = 0;
      }
    } else if (this.isPanning && e.touches.length === 1 && this.zoomScale > 1) {
      e.preventDefault();
      const deltaX = e.touches[0].clientX - this.panStartX;
      const deltaY = e.touches[0].clientY - this.panStartY;

      // Calculate max translation based on zoom level
      const maxTranslate = (this.zoomScale - 1) * 150;

      this.zoomTranslateX = Math.max(-maxTranslate, Math.min(maxTranslate, this.panStartTranslateX + deltaX));
      this.zoomTranslateY = Math.max(-maxTranslate, Math.min(maxTranslate, this.panStartTranslateY + deltaY));
    }
  };

  private handleImageTouchEnd = (): void => {
    if (this.isPinching) {
      this.isPinching = false;
      if (this.zoomScale > 1) {
        this.showZoomHintTemporarily();
      }
    }
    if (this.isPanning) {
      this.isPanning = false;
    }
  };

  private handleImageDoubleTap = (e: MouseEvent | TouchEvent): void => {
    e.preventDefault();
    if (this.zoomScale > 1) {
      // Reset zoom
      this.resetZoom();
    } else {
      // Zoom to 2x
      this.zoomScale = 2;
      this.showZoomHintTemporarily();
    }
  };

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
    }, 2000);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.open) return;

    switch (e.key) {
      case 'Escape':
        this.close();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.navigatePrev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.navigateNext();
        break;
      case 'Tab':
        this.handleTabKey(e);
        break;
    }
  };

  private handleTabKey(e: KeyboardEvent): void {
    const focusableElements = this.getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Get currently focused element within shadow DOM
    const activeElement = this.shadowRoot?.activeElement as HTMLElement | null;

    if (e.shiftKey) {
      // Shift+Tab: if focus is on first element, wrap to last
      if (activeElement === firstElement || !activeElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: if focus is on last element, wrap to first
      if (activeElement === lastElement || !activeElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.shadowRoot) return [];

    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    return Array.from(
      this.shadowRoot.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter((el) => {
      // Filter out hidden elements
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  private get canNavigate(): boolean {
    return this.posts.length > 1;
  }

  private get hasPrev(): boolean {
    return this.currentIndex > 0;
  }

  private get hasNext(): boolean {
    return this.currentIndex < this.posts.length - 1;
  }

  private navigatePrev(): void {
    if (this.hasPrev) {
      this.dispatchEvent(
        new CustomEvent<LightboxNavigateDetail>(EventNames.NAVIGATE, {
          detail: { direction: 'prev', index: this.currentIndex - 1 },
        })
      );
    }
  }

  private navigateNext(): void {
    if (this.hasNext) {
      this.dispatchEvent(
        new CustomEvent<LightboxNavigateDetail>(EventNames.NAVIGATE, {
          detail: { direction: 'next', index: this.currentIndex + 1 },
        })
      );
    }
  }

  private async toggleGutter(): Promise<void> {
    // If closing, just close
    if (this.gutterOpen) {
      this.gutterOpen = false;
      return;
    }

    // If opening, fetch if needed
    if (!this.relatedPosts && !this.loadingRelated) {
      await this.fetchRelatedPosts(true);
    }
    
    if (this.relatedPosts && this.relatedPosts.length === 0) {
      this.showToast('No related content found');
      return;
    }

    this.gutterOpen = true;
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    setTimeout(() => {
      this.toastMessage = '';
    }, 3000);
  }

  private async fetchRelatedPosts(isInitial = true): Promise<void> {
    if (!this.post || this.loadingRelated || (!isInitial && this.gutterExhausted)) return;
    
    if (isInitial) {
      this.gutterOffset = 0;
      this.gutterExhausted = false;
      this.relatedPosts = null;
    }

    this.loadingRelated = true;
    try {
      // Fetch batch of 20
      const limit = 20;
      const recs = await recService.getSimilarPosts(this.post.id, limit, this.gutterOffset);
      
      if (recs.length < limit) {
        this.gutterExhausted = true;
      }

      const postIds = recs.map(r => r.post_id).filter((id): id is number => !!id);
      if (postIds.length > 0) {
        const { extractMedia } = await import('../types/post.js');
        const postMap = new Map();
        
        // Hydrate this batch
        const resp = await apiClient.posts.batchGet({ post_ids: postIds });
        (resp.posts || []).forEach(p => postMap.set(p.id, { ...p, _media: extractMedia(p) }));
        
        const hydratedRecs = recs.map(r => ({
          ...r,
          _hydratedPost: r.post_id ? postMap.get(r.post_id) : undefined
        })) as any;

        if (isInitial) {
          this.relatedPosts = hydratedRecs;
        } else {
          this.relatedPosts = [...(this.relatedPosts || []), ...hydratedRecs];
        }
        
        this.gutterOffset += recs.length;
      } else {
        if (isInitial) this.relatedPosts = [];
        this.gutterExhausted = true;
      }
    } catch (e) {
      console.error('Failed to fetch related posts', e);
      if (isInitial) this.relatedPosts = [];
    } finally {
      this.loadingRelated = false;
    }
  }

  private handleGutterScroll(e: Event): void {
    const el = e.target as HTMLElement;
    const threshold = 100;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      this.fetchRelatedPosts(false);
    }
  }

  private async navigateToRelated(rec: RecResult): Promise<void> {
    if (!this.post || !rec.post_id) return;
    
    // Push current to stack
    this.navigationStack = [...this.navigationStack, this.post];
    
    // Reset engagement details immediately
    this.likes = null;
    this.comments = null;
    this.reblogs = null;
    this.activeDetail = null;
    this.relatedPosts = null;
    this.gutterOffset = 0;
    this.gutterExhausted = false;

    // Fetch full post data for the new post
    try {
      const resp = await apiClient.posts.get(rec.post_id);
      if (resp.post) {
        const { extractMedia } = await import('../types/post.js');
        const newPost: ProcessedPost = {
          ...resp.post,
          _media: extractMedia(resp.post)
        };
        this.post = newPost;
        this.currentIndex = -1; 
        
        // Scroll panels back to top
        this.shadowRoot?.querySelector('.lightbox-main')?.scrollTo(0, 0);
        this.shadowRoot?.querySelector('.lightbox-info')?.scrollTo(0, 0);
        
        // Refresh related if gutter is open
        if (this.gutterOpen) {
          this.fetchRelatedPosts(true);
        }
      }
    } catch (e) {
      console.error('Failed to navigate to related post', e);
    }
  }

  private popStack(): void {
    if (this.navigationStack.length === 0) return;
    const prev = this.navigationStack[this.navigationStack.length - 1];
    this.navigationStack = this.navigationStack.slice(0, -1);
    this.post = prev;
    // If returning to a post from the original list, we could try to restore index, 
    // but simplified for now is to keep it -1 unless we store indices too.
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
    this.navigationStack = [];
    this.relatedPosts = null;
    this.gutterOpen = false;
    this.gutterExhausted = false;
    this.gutterOffset = 0;
    this.resetZoom();
    this.dispatchEvent(new CustomEvent(EventNames.CLOSE));
  }

  private toggleTags(): void {
    this.tagsExpanded = !this.tagsExpanded;
  }

  private async fetchLikes(): Promise<void> {
    if (!this.post || this.loadingLikes) return;
    this.loadingLikes = true;
    this.activeDetail = 'likes';
    try {
      const data = await apiClient.engagement.getLikes(this.post.id);
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
      const data = await apiClient.engagement.getComments(this.post.id);
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
      const data = await apiClient.engagement.getReblogs(this.post.id);
      this.reblogs = data.reblogs || [];
    } catch {
      this.reblogs = [];
    }
    this.loadingReblogs = false;
  }

  private handleImageError(e: Event): void {
    const img = e.target as HTMLImageElement;
    const src = img.src;

    // If a preview URL failed, fall back to the original image URL
    if (src.includes('/preview/') && !img.dataset.triedOriginal) {
      img.dataset.triedOriginal = 'true';
      img.src = src.replace(/\/preview\/[^/]+\//, '/');
      return;
    }

    // Try CDN fallback (ocdn -> cdn)
    if (src.includes('ocdn012.bdsmlr.com') && !img.dataset.triedFallback) {
      img.dataset.triedFallback = 'true';
      img.src = src.replace('ocdn012.bdsmlr.com', 'cdn012.bdsmlr.com');
      return;
    }

    // If everything failed, show placeholder
    if (!img.dataset.showedPlaceholder) {
      img.dataset.showedPlaceholder = 'true';
      img.style.display = 'none';
      const placeholder = document.createElement('div');
      
      // If the failing image is in the gutter, use gutter-specific skeleton
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

  private async signUnsignedImages(container: HTMLElement): Promise<void> {
    const imgs = container.querySelectorAll('img');
    for (const img of imgs) {
      if (img.src.includes('bdsmlr.com') && !img.src.includes('?t=')) {
        try {
          img.src = await apiClient.media.signUrl(img.src);
        } catch {
          // Ignore signing errors
        }
      }
    }
  }

  updated(changedProperties: Map<string, unknown>): void {
    // Handle focus management when lightbox opens/closes
    if (changedProperties.has('open')) {
      if (this.open) {
        // Save currently focused element before opening
        this.previouslyFocusedElement = document.activeElement as HTMLElement | null;
        // Focus the close button after the render completes
        requestAnimationFrame(() => {
          const closeBtn = this.shadowRoot?.querySelector('.close-btn') as HTMLElement | null;
          if (closeBtn) {
            closeBtn.focus();
          }
        });
      } else {
        // Restore focus to previously focused element when closing
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
      this.relatedPosts = null;
      this.gutterOffset = 0;
      this.gutterExhausted = false;
      this.resetZoom();

      if (this.gutterOpen) {
        this.fetchRelatedPosts(true);
      }

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

  private renderLinks(): unknown {
    if (!this.post) return nothing;
    const post = this.post;
    const isReblog = post.originPostId && post.originPostId !== post.id;
    const isDeleted = !!post.deletedAtUnix;
    const isOriginDeleted = !!post.originDeletedAtUnix;

    // Use dynamic icon based on post type
    const typeIcon = {
      0: '❓', // Unspecified
      1: '📝', // Text
      2: '🖼️', // Image
      3: '🎬', // Video
      4: '🔊', // Audio
      5: '🔗', // Link
      6: '💬', // Chat
      7: '📜', // Quote
    }[post.type as number] || '📄';

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
    const post = this.post;
    const isReblog = post.originPostId && post.originPostId !== post.id;
    const isDeleted = !!post.deletedAtUnix;
    const isOriginDeleted = !!post.originDeletedAtUnix;

    let meta = isReblog ? `OP: ${post.originPostId} | RB: ${post.id}` : `Post: ${post.id}`;
    meta += ` | Created: ${formatDate(post.createdAtUnix, 'datetime')}`;
    if (isDeleted) meta += ` | Deleted: ${formatDate(post.deletedAtUnix, 'datetime')}`;
    if (isOriginDeleted) meta += ` | Origin deleted: ${formatDate(post.originDeletedAtUnix, 'datetime')}`;

    return meta;
  }

  private renderMedia(): unknown {
    if (!this.post) return nothing;
    const media = this.post._media;
    const files = this.post.content?.files || [];

    if (media.type === 'video' && media.videoUrl) {
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
    }

    if (media.type === 'image') {
      const currentUrl = files[this.currentImageIndex] || media.url;
      if (!currentUrl) return nothing;
      
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
      // Filter to show only likes with identifiable info first, then others
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
}

declare global {
  interface HTMLElementTagNameMap {
    'post-lightbox': PostLightbox;
  }
}
