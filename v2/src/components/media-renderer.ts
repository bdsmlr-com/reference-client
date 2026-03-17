import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { resolveMediaUrl, isAnimation, probeNextBucket, type MediaRenderType } from '../services/media-resolver.js';

/**
 * Universal Media Renderer
 * Centralizes all <img> vs <video> logic, error handling, and bucket probing.
 */
@customElement('media-renderer')
export class MediaRenderer extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      background: #000;
      overflow: hidden;
    }

    img, video {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: inherit; /* Allow parent to control fit (cover/contain) */
    }

    .error-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--bg-panel-alt);
      color: var(--text-muted);
      font-size: 12px;
      gap: 8px;
    }
  `;

  @property({ type: String }) src: string | undefined = '';
  @property({ type: String }) type: MediaRenderType = 'feed';
  @property({ type: String }) alt = '';
  @property({ type: Boolean }) loading = true;

  @state() private showPlaceholder = false;
  @state() private triedOriginal = false;

  private handleError(e: Event) {
    const el = e.target as HTMLElement;
    
    // 1. Try Authoritative Bucket Probing
    if (probeNextBucket(el)) return;

    // 2. Try Raw Backend URL (Final Fallback)
    if (el instanceof HTMLImageElement && !this.triedOriginal) {
      this.triedOriginal = true;
      if (this.src) {
        el.src = this.src;
        return;
      }
    }

    // 3. All fail -> Show placeholder
    this.showPlaceholder = true;
  }

  render() {
    // If src is truly missing, show a descriptive placeholder immediately
    if (!this.src) {
      return html`
        <div class="error-placeholder" style="background: #1a1a1a; border: 1px dashed #333;">
          <span style="font-size: 20px; opacity: 0.5;">❓</span>
          <span style="font-size: 10px; opacity: 0.3;">No Source</span>
        </div>
      `;
    }

    if (this.showPlaceholder) {
      return html`
        <div class="error-placeholder" style="background: #1a1a1a; border: 1px solid #442222;">
          <span style="font-size: 20px; opacity: 0.5;">🖼️</span>
          <span style="font-size: 10px; opacity: 0.3;">Load Failed</span>
        </div>
      `;
    }

    const isAnim = isAnimation(this.src);
    const resolvedUrl = resolveMediaUrl(this.src, this.type);
    const posterUrl = resolveMediaUrl(this.src, 'poster');

    if (!resolvedUrl) {
      return html`
        <div class="error-placeholder" style="background: #221111; border: 1px solid #ff4444;">
          <span style="font-size: 20px;">🚫</span>
          <span style="font-size: 10px; color: #ff4444;">No Host</span>
        </div>
      `;
    }

    if (isAnim) {
      return html`
        <video 
          autoplay 
          loop 
          muted 
          playsinline 
          webkit-playsinline 
          preload="metadata" 
          poster=${posterUrl}
          style="object-fit: inherit;"
        >
          <source src=${resolvedUrl} type="video/mp4" @error=${this.handleError}>
        </video>
      `;
    }

    return html`
      <img 
        src=${resolvedUrl} 
        alt=${this.alt} 
        loading="lazy" 
        style="object-fit: inherit;"
        @error=${this.handleError} 
      />
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-renderer': MediaRenderer;
  }
}
