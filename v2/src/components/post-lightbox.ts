import { LitElement, html, css, nothing, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { EventNames, type LightboxNavigateDetail } from '../types/events.js';
import { BREAKPOINTS } from '../types/ui-constants.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { extractMedia, type ProcessedPost } from '../types/post.js';
import { isAdminMode } from '../services/blog-resolver.js';
import { resolveMediaUrl } from '../services/media-resolver.js';
import './media-renderer.js';
import './post-recommendations.js';
import './post-engagement.js';

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

      .admin-debug-panel {
        background: #000;
        color: #00ff00;
        font-family: monospace;
        font-size: 11px;
        padding: 16px;
        border-radius: 8px;
        border: 1px solid #00ff00;
        margin-bottom: 24px;
        word-break: break-all;
        line-height: 1.4;
      }
      .admin-debug-panel h4 { color: #fff; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; }
      .admin-debug-panel .entry { margin-bottom: 8px; }
      .admin-debug-panel .label { color: #888; margin-right: 8px; }

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

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('popstate', this.handlePopState);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('popstate', this.handlePopState);
  }

  private handlePopState = () => {
    if (this.open) {
      this.close();
    }
  };

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

  private renderAdminDebug() {
    if (!isAdminMode() || !this.post) return nothing;
    
    const media = this.post._media || extractMedia(this.post);
    const files = this.post.content?.files || [];
    const sources = files.length > 0 ? files : (media?.videoUrl || media?.url ? [media.videoUrl || media.url] : []);

    return html`
      <div class="admin-debug-panel">
        <h4>🛠️ Admin Media Debug</h4>
        <div class="entry"><span class="label">POST_ID:</span> ${this.post.id}</div>
        ${sources.map((src, i) => html`
          <div style="margin-top: 12px; border-top: 1px solid #333; padding-top: 8px;">
            <div class="entry"><span class="label">MEDIA[${i}] RAW:</span> ${src}</div>
            <div class="entry"><span class="label">MEDIA[${i}] RES:</span> ${resolveMediaUrl(src, 'lightbox')}</div>
          </div>
        `)}
      </div>
    `;
  }

  private renderMedia() {
    if (!this.post) return nothing;
    const media = this.post._media || extractMedia(this.post);
    if (!media) return this.renderGhost('🖼️', false, false, 'Media Error');

    const files = this.post.content?.files || [];
    const isAdmin = isAdminMode();
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
      <div class="error-ghost ghost">
        <span class="error-icon">${icon}</span>
        ${isAdmin ? html`<span class="diagnostic-label">${isTombstone ? '[TOMBSTONE]' : '[MISSING_URL]'}</span>` : ''}
        <div style="font-size: 48px; animation: pulse 2s infinite; margin: 20px 0;">✨</div>
        <span style="font-size: 14px; opacity: 0.7;">${label}</span>
      </div>
    `;
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
            ${this.renderAdminDebug()}

            <div class="body-text" style="margin-bottom: 32px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 24px;">
              ${unsafeHTML(p.content?.html || p.body || '')}
            </div>

            <post-engagement .post=${p}></post-engagement>

            <post-recommendations .postId=${p.id} mode="list"></post-recommendations>
          </div>
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
