import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { resolveMediaUrl, isAnimation, isNativeVideo, probeNextBucket, type MediaRenderType } from '../services/media-resolver.js';
import { isAdminMode } from '../services/blog-resolver.js';
import { getMediaBehavior } from '../services/media-behavior.js';

type ProbeStatus = 'unknown' | 'available' | 'unavailable';
type ProbeFailureReason = 'missing-or-404' | 'timeout' | 'token-or-auth' | 'codec-or-playback' | 'other-load-error';

const animatedAlternateAvailabilityCache = new Map<string, { available: boolean; reason?: ProbeFailureReason }>();
const MEDIA_ERR_NETWORK = 2;
const MEDIA_ERR_DECODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

function canonicalAnimatedAlternateIdentity(url: string | undefined, role = 'alternate-0'): string {
  if (!url) return '';
  const unsigned = url.split('?')[0];
  const match = unsigned.match(/\/uploads\/[^?#]+/i);
  return `${match?.[0] || unsigned}::${role}`;
}

function classifyProbeFailure(
  url: string | undefined,
  mediaError: { code?: number | null } | null | undefined,
): ProbeFailureReason {
  const code = mediaError?.code ?? undefined;
  if (code === MEDIA_ERR_DECODE || code === MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return 'codec-or-playback';
  }
  if (url && /[?&](e|t)=/i.test(url)) {
    return 'token-or-auth';
  }
  if (code === MEDIA_ERR_NETWORK) {
    return 'missing-or-404';
  }
  return 'other-load-error';
}

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

    :host([detail-mode]) {
      width: auto;
      height: auto;
      max-width: 100%;
      background: transparent;
      overflow: visible;
    }

    :host([fill-mode]) {
      height: 100%;
    }

    :host([square-crop-mode]) {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    img, video {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: inherit;
      object-position: center center;
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

    .retry-link {
      font-size: 10px;
      color: #b86a6a;
      cursor: pointer;
      user-select: none;
    }

    .retry-link:hover {
      color: #cf7a7a;
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
  @property({ type: String }) alternateVideoSrc: string | undefined = '';
  @property({ type: String }) fallbackSrc: string | undefined = '';
  @property({ type: String }) type: MediaRenderType = 'feed';
  @property({ type: String }) alt = '';
  @property({ type: Boolean }) forceImage = false;
  @property({ type: Boolean }) loading = true;
  @property({ type: Boolean }) autoplayVideo?: boolean;
  @property({ type: Boolean }) controlsVideo?: boolean;
  @property({ type: Boolean }) loopVideo?: boolean;
  @property({ type: String, attribute: 'alternate-fallback-reason', reflect: true }) alternateFallbackReason: ProbeFailureReason | '' = '';

  @state() private showPlaceholder = false;
  @state() private showPosterFrame = true;
  @state() private retryGeneration = 0;
  @state() private alternateProbeStatus: ProbeStatus = 'unknown';

  private alternateProbeToken = 0;

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('src') || changed.has('posterSrc') || changed.has('alternateVideoSrc') || changed.has('fallbackSrc')) {
      this.showPlaceholder = false;
      this.showPosterFrame = true;
      this.dispatchMediaStateChange(false);
      this.alternateProbeStatus = 'unknown';
      this.alternateFallbackReason = '';
    }

    if (changed.has('alternateVideoSrc') || changed.has('type') || changed.has('src')) {
      this.ensureAnimatedAlternateProbe();
    }
  }

  private dispatchMediaStateChange(failed: boolean): void {
    this.dispatchEvent(new CustomEvent('media-state-change', {
      detail: { failed },
      bubbles: true,
      composed: true,
    }));
  }

  private handleVideoReady = (): void => {
    this.showPosterFrame = false;
  };

  private handlePosterFrameError = (): void => {
    this.showPosterFrame = false;
  };

  private setAlternateUnavailable(reason: ProbeFailureReason): void {
    const cacheKey = canonicalAnimatedAlternateIdentity(this.alternateVideoSrc);
    if (cacheKey) {
      animatedAlternateAvailabilityCache.set(cacheKey, { available: false, reason });
    }
    this.alternateProbeStatus = 'unavailable';
    this.alternateFallbackReason = reason;
    this.showPosterFrame = true;
  }

  private handleError(e: Event) {
    const el = e.target as HTMLElement;
    const isAnimatedVideoFallback = Boolean(this.alternateVideoSrc) && (el.tagName === 'VIDEO' || this.alternateProbeStatus === 'available');

    if (isAnimatedVideoFallback) {
      const mediaError = (el as HTMLMediaElement).error;
      this.setAlternateUnavailable(classifyProbeFailure(this.alternateVideoSrc, mediaError));
      return;
    }

    if (probeNextBucket(el)) return;
    this.showPlaceholder = true;
    this.dispatchMediaStateChange(true);
  }

  private handleRetry = (): void => {
    this.showPlaceholder = false;
    this.showPosterFrame = true;
    this.retryGeneration += 1;
    this.dispatchMediaStateChange(false);
    this.ensureAnimatedAlternateProbe(true);
  };

  private handleRetryInteraction = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    this.handleRetry();
  };

  private renderDebug(resolvedUrl: string) {
    if (!isAdminMode()) return nothing;
    if (this.type === 'lightbox') return nothing;

    return html`
      <div class="admin-debug">
        ${resolvedUrl.substring(0, 60)}...
      </div>
    `;
  }

  private ensureAnimatedAlternateProbe(force = false): void {
    if (!this.alternateVideoSrc || this.type === 'poster') {
      this.alternateProbeStatus = 'unavailable';
      this.alternateFallbackReason = '';
      return;
    }

    const cacheKey = canonicalAnimatedAlternateIdentity(this.alternateVideoSrc);
    if (!force && cacheKey) {
      const cached = animatedAlternateAvailabilityCache.get(cacheKey);
      if (cached) {
        this.alternateProbeStatus = cached.available ? 'available' : 'unavailable';
        this.alternateFallbackReason = cached.available ? '' : cached.reason || '';
        return;
      }
    }

    if (typeof document === 'undefined') {
      this.alternateProbeStatus = 'unavailable';
      this.alternateFallbackReason = '';
      return;
    }

    const probeToken = ++this.alternateProbeToken;
    const probeUrl = resolveMediaUrl(this.alternateVideoSrc, this.type);
    const probeVideo = document.createElement('video');
    probeVideo.muted = true;
    probeVideo.preload = 'metadata';
    probeVideo.playsInline = true;
    let timeoutHandle = 0;

    const finalize = (available: boolean, reason?: ProbeFailureReason) => {
      if (probeToken !== this.alternateProbeToken) return;
      window.clearTimeout(timeoutHandle);
      probeVideo.removeAttribute('src');
      probeVideo.load();
      if (cacheKey) {
        animatedAlternateAvailabilityCache.set(cacheKey, { available, reason });
      }
      this.alternateProbeStatus = available ? 'available' : 'unavailable';
      this.alternateFallbackReason = available ? '' : reason || '';
    };

    probeVideo.addEventListener('loadedmetadata', () => finalize(true), { once: true });
    probeVideo.addEventListener('error', () => finalize(false, classifyProbeFailure(this.alternateVideoSrc, probeVideo.error)), { once: true });
    timeoutHandle = window.setTimeout(() => finalize(false, 'timeout'), 1500);
    probeVideo.src = probeUrl;
    probeVideo.load();
  }

  render() {
    const baseImageSrc = this.fallbackSrc || this.src;
    if (!baseImageSrc) {
      return html`
        <div class="error-placeholder" style="background: #1a1a1a; border: 1px dashed #333;">
          <span style="font-size: 20px; opacity: 0.5;">❓</span>
          <span style="font-size: 10px; opacity: 0.3;">No Source</span>
        </div>
      `;
    }

    if (this.showPlaceholder) {
      return html`
        <div
          class="error-placeholder"
          style="background: #1a1a1a; border: 1px solid #442222;"
          role="button"
          tabindex="0"
          @click=${this.handleRetryInteraction}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              this.handleRetry();
            }
          }}
        >
          <span style="font-size: 20px; opacity: 0.5;">🖼️</span>
          <span class="retry-link">Load Failed. Retry ⟳</span>
        </div>
      `;
    }

    const resolvedImageUrl = resolveMediaUrl(baseImageSrc, this.type);
    const resolvedAlternateVideoUrl = this.alternateVideoSrc ? resolveMediaUrl(this.alternateVideoSrc, this.type) : '';
    const isDetailSurface = this.type === 'detail' || this.type === 'post-detail';
    const usesRawAlias = resolvedImageUrl.includes('/raw/s3://');
    const shouldUseAlternateVideo = Boolean(this.alternateVideoSrc) && this.alternateProbeStatus === 'available';
    const isAnim = isAnimation(baseImageSrc);
    const treatAnimationAsVideo = this.alternateVideoSrc
      ? shouldUseAlternateVideo
      : !this.forceImage && isAnim && !isDetailSurface && !usesRawAlias;
    const resolvedPrimaryUrl = shouldUseAlternateVideo ? resolvedAlternateVideoUrl : resolvedImageUrl;
    const isVideoSource = shouldUseAlternateVideo || (!this.forceImage && !this.alternateVideoSrc && (treatAnimationAsVideo || isNativeVideo(resolvedPrimaryUrl) || resolvedPrimaryUrl.includes('format:mp4')));
    const posterSource = this.posterSrc || baseImageSrc;
    const posterUrl = resolveMediaUrl(posterSource, 'poster');
    const effectivePoster = posterUrl || resolvedImageUrl;
    const fillMode =
      this.type === 'card' ||
      this.type === 'gallery-grid' ||
      this.type === 'gallery-masonry' ||
      this.type === 'gutter' ||
      this.type === 'lightbox';
    const squareCropMode =
      this.type === 'card' ||
      this.type === 'gallery-grid' ||
      this.type === 'gutter';
    this.toggleAttribute('fill-mode', fillMode);
    this.toggleAttribute('square-crop-mode', squareCropMode);
    const detailFitStyle = 'object-fit: contain; max-width: min(100%, calc(100vw - 40px)); max-height: calc(min(78vh, 920px) - 20px); width: auto; height: auto; margin: 0 auto;';
    this.toggleAttribute('detail-mode', isDetailSurface);
    const mediaStyle = isDetailSurface
      ? detailFitStyle
      : fillMode
      ? 'object-fit: inherit; width: 100%; height: 100%;'
      : 'object-fit: contain; width: 100%; height: auto;';

    if (!resolvedPrimaryUrl) {
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
      const nonFillVideoStyle = isDetailSurface
        ? detailFitStyle
        : this.showPosterFrame
        ? 'object-fit: contain; width: 100%; height: 100%; background: #000; position: absolute; inset: 0;'
        : 'object-fit: contain; width: 100%; height: auto; background: #000; position: static;';
      const videoStyle = fillMode ? mediaStyle : nonFillVideoStyle;

      if (!fillMode) {
        return keyed(this.retryGeneration, html`
          <div class="video-shell">
            <img
              class="poster-frame ${this.showPosterFrame ? '' : 'hidden'}"
              src=${effectivePoster}
              alt=""
              @error=${this.handlePosterFrameError}
            />
            <video
              src=${resolvedPrimaryUrl}
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
          ${this.renderDebug(resolvedPrimaryUrl)}
        `);
      }

      return keyed(this.retryGeneration, html`
        <video
          src=${resolvedPrimaryUrl}
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
        ${this.renderDebug(resolvedPrimaryUrl)}
      `);
    }

    return keyed(this.retryGeneration, html`
      <img
        src=${resolvedImageUrl}
        alt=${this.alt}
        loading="lazy"
        style=${mediaStyle}
        @error=${this.handleError}
      />
      ${this.renderDebug(resolvedImageUrl)}
    `);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-renderer': MediaRenderer;
  }
}
