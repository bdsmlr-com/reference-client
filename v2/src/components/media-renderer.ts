import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { resolveMediaUrl, isAnimation, isNativeVideo, probeNextBucket, type MediaRenderType } from '../services/media-resolver.js';
import { isAdminMode } from '../services/blog-resolver.js';
import { getMediaBehavior } from '../services/media-behavior.js';

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
      height: auto;
      position: relative;
      background: #000;
      overflow: hidden;
    }

    :host([fill-mode]) {
      height: 100%;
    }

    img, video {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: inherit;
    }
    .video-shell {
      width: 100%;
      background-color: #000;
      position: relative;
    }
    .poster-frame {
      display: block;
      width: 100%;
      height: auto;
    }
    .poster-frame.hidden {
      display: none;
      pointer-events: none;
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

    .admin-debug {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0,0,0,0.8);
      color: #00ff00;
      font-family: monospace;
      font-size: 9px;
      padding: 4px;
      z-index: 10;
      pointer-events: none;
      word-break: break-all;
      border-top: 1px solid #00ff00;
    }
  `;

  @property({ type: String }) src: string | undefined = '';
  @property({ type: String }) posterSrc: string | undefined = '';
  @property({ type: String }) type: MediaRenderType = 'feed';
  @property({ type: String }) alt = '';
  @property({ type: Boolean }) loading = true;
  @property({ type: Boolean }) autoplayVideo?: boolean;
  @property({ type: Boolean }) controlsVideo?: boolean;
  @property({ type: Boolean }) loopVideo?: boolean;

  @state() private showPlaceholder = false;
  @state() private showPosterFrame = true;

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('src') || changed.has('posterSrc')) {
      this.showPosterFrame = true;
    }
  }

  private handleVideoReady = (): void => {
    this.showPosterFrame = false;
  };

  private handlePosterFrameError = (): void => {
    // Poster is best-effort only. Do not fail the whole media renderer.
    this.showPosterFrame = false;
  };

  private handleError(e: Event) {
    const el = e.target as HTMLElement;
    
    // Only retry within the media gateway path. Do not fall back to direct CDN URLs.
    if (probeNextBucket(el)) return;
    this.showPlaceholder = true;
  }

  private renderDebug(resolvedUrl: string) {
    if (!isAdminMode()) return nothing;
    // Only show simple debug if NOT in lightbox (lightbox has its own panel)
    if (this.type === 'lightbox') return nothing;
    
    return html`
      <div class="admin-debug">
        ${resolvedUrl.substring(0, 60)}...
      </div>
    `;
  }

  render() {
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
    // Treat animations as video to leverage mp4 transcoding; also video if explicit format:mp4 or native video.
    const isVideoSource = isAnim || isNativeVideo(resolvedUrl) || resolvedUrl.includes('format:mp4');
    const posterSource = this.posterSrc || this.src;
    const posterUrl = resolveMediaUrl(posterSource, 'poster');
    const effectivePoster = posterUrl || resolvedUrl;
    const fillMode = this.type === 'gallery-grid' || this.type === 'gallery-masonry' || this.type === 'gutter' || this.type === 'lightbox';
    this.toggleAttribute('fill-mode', fillMode);
    const mediaStyle = fillMode
      ? 'object-fit: inherit; width: 100%; height: 100%;'
      : 'object-fit: contain; width: 100%; height: auto;';

    if (!resolvedUrl) {
      return html`
        <div class="error-placeholder" style="background: #221111; border: 1px solid #ff4444;">
          <span style="font-size: 20px;">🚫</span>
          <span style="font-size: 10px; color: #ff4444;">No Host</span>
        </div>
      `;
    }

    if (isVideoSource && this.type !== 'poster') {
      const behavior = getMediaBehavior(this.type);
      const effectiveAutoplay = this.autoplayVideo ?? behavior.autoplay;
      const effectiveControls = this.controlsVideo ?? behavior.controls;
      const effectiveLoop = this.loopVideo ?? behavior.loop;
      const defaultPreload = behavior.preload ?? 'none';
      const effectivePreload = effectiveAutoplay && defaultPreload === 'none'
        ? 'metadata'
        : defaultPreload;
      const nonFillVideoStyle = this.showPosterFrame
        ? 'object-fit: contain; width: 100%; height: 100%; background: #000; position: absolute; inset: 0;'
        : 'object-fit: contain; width: 100%; height: auto; background: #000; position: static;';
      const videoStyle = fillMode ? mediaStyle : nonFillVideoStyle;

      if (!fillMode) {
        return html`
          <div class="video-shell">
            <img
              class="poster-frame ${this.showPosterFrame ? '' : 'hidden'}"
              src=${effectivePoster}
              alt=""
              @error=${this.handlePosterFrameError}
            />
            <video 
              src=${resolvedUrl}
              ?autoplay=${effectiveAutoplay}
              ?controls=${effectiveControls}
              ?loop=${effectiveLoop}
              muted 
              playsinline 
              webkit-playsinline 
              preload=${effectivePreload}
              poster=${effectivePoster}
              style=${videoStyle}
              @error=${this.handleError}
              @loadeddata=${this.handleVideoReady}
              @play=${this.handleVideoReady}
            ></video>
          </div>
          ${this.renderDebug(resolvedUrl)}
        `;
      }

      return html`
        <video 
          src=${resolvedUrl}
          ?autoplay=${effectiveAutoplay}
          ?controls=${effectiveControls}
          ?loop=${effectiveLoop}
          muted 
          playsinline 
          webkit-playsinline 
          preload=${effectivePreload}
          poster=${effectivePoster}
          style=${videoStyle}
          @error=${this.handleError}
          @loadeddata=${this.handleVideoReady}
          @play=${this.handleVideoReady}
        ></video>
        ${this.renderDebug(resolvedUrl)}
      `;
    }

    return html`
      <img 
        src=${resolvedUrl} 
        alt=${this.alt} 
        loading="lazy" 
        style=${mediaStyle}
        @error=${this.handleError} 
      />
      ${this.renderDebug(resolvedUrl)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-renderer': MediaRenderer;
  }
}
