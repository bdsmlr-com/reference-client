import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { resolveMediaUrl, isAnimation, isNativeVideo, type MediaRenderType } from '../services/media-resolver.js';
import { isAdminMode } from '../services/blog-resolver.js';
import { getMediaBehavior } from '../services/media-behavior.js';
import { useGifPosters } from '../config.js';
import { MEDIA_PLACEHOLDER_ASPECT_RATIO } from '../types/ui-constants.js';
import { mediaChromeStyles } from '../styles/media-chrome.js';
import { compensateScrollForAboveViewportResize } from '../services/media-scroll-anchor.js';
import {
  MEDIA_VIEWPORT_PRIME_DEBUG,
  mediaViewportPrime,
} from '../services/media-viewport-prime.js';

type ProbeFailureReason = 'missing-or-404' | 'timeout' | 'token-or-auth' | 'codec-or-playback' | 'other-load-error';

const animatedAlternateMissCache = new Set<string>();
const animatedAlternateProbeCache = new Map<string, Promise<ProbeFailureReason>>();
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
  const usesSignedDeliveryToken = Boolean(url && /[?&](e|t)=/i.test(url));
  if (code === MEDIA_ERR_DECODE || code === MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return 'codec-or-playback';
  }
  if (code === MEDIA_ERR_NETWORK && !usesSignedDeliveryToken) {
    return 'other-load-error';
  }
  if (usesSignedDeliveryToken) {
    return 'token-or-auth';
  }
  return 'other-load-error';
}

async function probeAnimatedAlternateFailure(url: string | undefined): Promise<ProbeFailureReason> {
  if (!url) return 'other-load-error';
  const cacheKey = canonicalAnimatedAlternateIdentity(url);
  if (cacheKey) {
    const inFlight = animatedAlternateProbeCache.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
  }

  const probe = (async (): Promise<ProbeFailureReason> => {
    try {
      const response = await fetch(url, { method: 'HEAD', mode: 'cors', cache: 'no-store' });
      if (response.status === 404) {
        return 'missing-or-404';
      }
      if (response.status === 401 || response.status === 403) {
        return 'token-or-auth';
      }
      return 'other-load-error';
    } catch {
      return 'other-load-error';
    } finally {
      if (cacheKey) {
        animatedAlternateProbeCache.delete(cacheKey);
      }
    }
  })();

  if (cacheKey) {
    animatedAlternateProbeCache.set(cacheKey, probe);
  }
  return probe;
}

@customElement('media-renderer')
export class MediaRenderer extends LitElement {
  static styles = [
    mediaChromeStyles,
    css`
    :host {
      display: block;
      width: 100%;
      height: auto;
      position: relative;
      background: transparent;
      overflow: hidden;
    }

    /* Deferred outline: on when MEDIA_VIEWPORT_PRIME_DEBUG is true (rebuild to toggle). */
    :host([prime-debug]:not([primed])) {
      border: 2px solid red;
      box-shadow: inset 0 0 0 2px red;
    }

    :host([fill-mode]),
    :host([reserve-space]) {
      background: var(--media-chrome-bg);
    }

    :host([fill-mode]) {
      height: 100%;
    }

    :host([reserve-space]) {
      aspect-ratio: var(--media-aspect-ratio, ${MEDIA_PLACEHOLDER_ASPECT_RATIO});
      height: auto;
      overflow-anchor: none;
    }

    :host([detail-mode]) {
      width: auto;
      height: auto;
      max-width: 100%;
      background: transparent;
      overflow: visible;
    }

    /* Redaction must clip scaled blur even when detail-mode sets overflow:visible. */
    :host([redacted]) {
      overflow: hidden;
    }

    :host([square-crop-mode]) {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    :host([reserve-space]) .video-shell {
      width: 100%;
      height: 100%;
      background-color: transparent;
    }

    :host([reserve-space]) img,
    :host([reserve-space]) video {
      width: 100%;
      height: 100%;
      object-fit: contain;
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
      background-color: var(--media-chrome-bg);
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

    .redaction-shell {
      overflow: hidden;
      width: 100%;
      height: 100%;
      position: relative;
      pointer-events: none;
      /* Bridge host object-fit (set by parents) to img/video inherit. */
      object-fit: inherit;
    }

    :host([detail-mode]) .redaction-shell {
      height: auto;
    }

    /*
     * EXPERIMENT — fake pixel grid over blur. Tune via :root:
     *   --redaction-mosaic-opacity (default 0.28)
     *   --redaction-mosaic-size    (default 5px)
     *   --redaction-mosaic-blend   (default soft-light; try overlay / hard-light / difference)
     * Discard if it looks rubbish.
     */
    .redaction-mosaic {
      position: absolute;
      inset: 0;
      z-index: 2;
      pointer-events: none;
      opacity: var(--redaction-mosaic-opacity, 0.28);
      mix-blend-mode: var(--redaction-mosaic-blend, soft-light);
      image-rendering: pixelated;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2'%3E%3Crect width='1' height='1' fill='%23fff'/%3E%3Crect x='1' y='1' width='1' height='1' fill='%23fff'/%3E%3Crect x='1' width='1' height='1' fill='%23000'/%3E%3Crect y='1' width='1' height='1' fill='%23000'/%3E%3C/svg%3E");
      background-size: var(--redaction-mosaic-size, 5px) var(--redaction-mosaic-size, 5px);
    }

    /*
     * Base 8px fallback first (older engines that ignore calc/vars).
     * Then surface-specific factors via CSS variables (console-tunable on :root).
     *   --redaction-blur-factor-thumb (default 0.75) → cards / gutters
     *   --redaction-blur-factor-full  (default 2)    → feed / detail / lightbox
     */
    :host([redacted]) img,
    :host([redacted]) video {
      filter: blur(8px);
      filter: blur(calc(8px * var(--redaction-blur-factor-thumb, 0.75)));
      transform: scale(1.08);
    }

    :host([redacted][redaction-full]) img,
    :host([redacted][redaction-full]) video {
      filter: blur(8px);
      filter: blur(calc(8px * var(--redaction-blur-factor-full, 2)));
    }
  `,
  ];

  @property({ type: String }) src: string | undefined = '';
  @property({ type: String }) posterSrc: string | undefined = '';
  @property({ type: String }) alternateVideoSrc: string | undefined = '';
  @property({ type: String }) fallbackSrc: string | undefined = '';
  @property({ type: String }) type: MediaRenderType = 'feed';
  @property({ type: String }) alt = '';
  @property({ type: Boolean }) forceImage = false;
  @property({ type: Boolean, reflect: true }) redacted = false;
  @property({ type: Boolean }) loading = true;
  @property({ type: Boolean }) autoplayVideo?: boolean;
  @property({ type: Boolean }) controlsVideo?: boolean;
  @property({ type: Boolean }) loopVideo?: boolean;
  @property({ type: String, attribute: 'alternate-fallback-reason', reflect: true }) alternateFallbackReason: ProbeFailureReason | '' = '';
  @property({ type: Boolean, reflect: true }) primed = false;

  @state() private showPlaceholder = false;
  @state() private showPosterFrame = true;
  @state() private retryGeneration = 0;
  @state() private alternatePlaybackFailed = false;
  @state() private knownAspectRatio: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.toggleAttribute('prime-debug', MEDIA_VIEWPORT_PRIME_DEBUG);
    if (this.primed) return;
    mediaViewportPrime.observe(this, () => {
      this.primed = true;
    });
  }

  disconnectedCallback(): void {
    mediaViewportPrime.unobserve(this);
    super.disconnectedCallback();
  }

  private getCachedAlternateFailure(): ProbeFailureReason | '' {
    if (!this.alternateVideoSrc) return '';
    const cacheKey = canonicalAnimatedAlternateIdentity(this.alternateVideoSrc);
    if (!cacheKey) return '';
    return animatedAlternateMissCache.has(cacheKey) ? 'missing-or-404' : '';
  }

  private syncAlternateFallbackReasonFromCache(): void {
    this.alternateFallbackReason = this.getCachedAlternateFailure();
  }

  private getSurfaceModes(): { fillMode: boolean; isDetailSurface: boolean; reserveSpace: boolean } {
    const isDetailSurface = this.type === 'detail' || this.type === 'post-detail';
    const fillMode =
      this.type === 'card' ||
      this.type === 'gallery-grid' ||
      this.type === 'gallery-masonry' ||
      this.type === 'gutter' ||
      this.type === 'lightbox';
    return {
      fillMode,
      isDetailSurface,
      reserveSpace: !fillMode && !isDetailSurface,
    };
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    if (
      changed.has('type')
      || changed.has('knownAspectRatio')
      || changed.has('src')
      || changed.has('retryGeneration')
    ) {
      const { fillMode, isDetailSurface } = this.getSurfaceModes();
      this.syncReserveSpaceAttributes(fillMode, isDetailSurface);
    }
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('src') || changed.has('posterSrc') || changed.has('alternateVideoSrc') || changed.has('fallbackSrc')) {
      this.showPlaceholder = false;
      this.showPosterFrame = true;
      this.alternatePlaybackFailed = false;
      this.dispatchMediaStateChange(false);
      this.syncAlternateFallbackReasonFromCache();
      this.knownAspectRatio = null;
    }

    if (changed.has('retryGeneration') || changed.has('knownAspectRatio') || changed.has('src')) {
      this.queueIntrinsicAspectSync();
    }
  }

  private queueIntrinsicAspectSync(): void {
    if (this.knownAspectRatio !== null) return;
    requestAnimationFrame(() => {
      if (this.knownAspectRatio !== null) return;
      const poster = this.shadowRoot?.querySelector('img.poster-frame:not(.hidden)');
      const image = this.shadowRoot?.querySelector('img:not(.poster-frame)');
      const video = this.shadowRoot?.querySelector('video');
      if (poster instanceof HTMLImageElement) {
        this.applyIntrinsicAspectFromImage(poster);
      } else if (image instanceof HTMLImageElement) {
        this.applyIntrinsicAspectFromImage(image);
      } else if (video instanceof HTMLVideoElement) {
        this.applyIntrinsicAspectFromVideo(video);
      }
    });
  }

  private applyIntrinsicAspectFromImage(image: HTMLImageElement): void {
    if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
    this.commitIntrinsicAspectRatio(image.naturalWidth / image.naturalHeight);
  }

  private applyIntrinsicAspectFromVideo(video: HTMLVideoElement): void {
    if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
    this.commitIntrinsicAspectRatio(video.videoWidth / video.videoHeight);
  }

  private commitIntrinsicAspectRatio(nextRatio: number): void {
    if (this.knownAspectRatio === nextRatio) return;

    const { reserveSpace } = this.getSurfaceModes();
    const anchorTop = reserveSpace ? this.getBoundingClientRect().top : 0;
    const oldHeight = reserveSpace ? this.offsetHeight : 0;

    this.knownAspectRatio = nextRatio;

    if (!reserveSpace || oldHeight <= 0) return;

    void this.updateComplete.then(() => {
      requestAnimationFrame(() => {
        compensateScrollForAboveViewportResize({
          anchorTop,
          heightDelta: this.offsetHeight - oldHeight,
        });
      });
    });
  }

  private handleImageLoad = (event: Event): void => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    this.applyIntrinsicAspectFromImage(image);
  };

  private handleVideoMetadata = (event: Event): void => {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement)) return;
    this.applyIntrinsicAspectFromVideo(video);
  };

  private syncReserveSpaceAttributes(fillMode: boolean, isDetailSurface: boolean): void {
    const reserveSpace = !fillMode && !isDetailSurface;
    this.toggleAttribute('reserve-space', reserveSpace);
    this.toggleAttribute('intrinsic-known', reserveSpace && this.knownAspectRatio !== null);
    if (!reserveSpace) {
      this.style.removeProperty('--media-aspect-ratio');
      return;
    }
    const aspectRatio = this.knownAspectRatio ?? MEDIA_PLACEHOLDER_ASPECT_RATIO;
    this.style.setProperty('--media-aspect-ratio', String(aspectRatio));
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

  private markAlternateUnavailable(reason: ProbeFailureReason): void {
    // GIF fallback whenever the MP4 alternate won't play — confirmed miss or
    // codec/format failure (browsers often report missing/corrupt MP4s as code 4).
    if (reason !== 'missing-or-404' && reason !== 'codec-or-playback') {
      return;
    }
    if (reason === 'missing-or-404') {
      const cacheKey = canonicalAnimatedAlternateIdentity(this.alternateVideoSrc);
      if (cacheKey) {
        animatedAlternateMissCache.add(cacheKey);
      }
    }
    this.alternateFallbackReason = reason;
    this.alternatePlaybackFailed = true;
    this.showPosterFrame = true;
  }


  private async confirmAlternateFailureReason(
    alternateUrl: string | undefined,
    initialReason: ProbeFailureReason,
  ): Promise<void> {
    const finalReason = initialReason === 'token-or-auth'
      ? await probeAnimatedAlternateFailure(alternateUrl)
      : initialReason;
    if (alternateUrl !== this.alternateVideoSrc) {
      return;
    }
    if (finalReason === 'missing-or-404' || finalReason === 'codec-or-playback') {
      this.markAlternateUnavailable(finalReason);
      return;
    }
    this.alternateFallbackReason = finalReason;
  }

  private handleError(e: Event) {
    const el = e.target as HTMLElement;
    if (Boolean(this.alternateVideoSrc) && el.tagName === 'VIDEO') {
      const mediaError = (el as HTMLMediaElement).error;
      const reason = classifyProbeFailure(this.alternateVideoSrc, mediaError);
      if (reason === 'codec-or-playback') {
        this.markAlternateUnavailable(reason);
        return;
      }
      void this.confirmAlternateFailureReason(this.alternateVideoSrc, reason);
      return;
    }

    this.showPlaceholder = true;
    this.dispatchMediaStateChange(true);
  }

  private handleRetry = (): void => {
    this.showPlaceholder = false;
    this.showPosterFrame = true;
    this.alternatePlaybackFailed = false;
    const cacheKey = canonicalAnimatedAlternateIdentity(this.alternateVideoSrc);
    if (cacheKey) {
      animatedAlternateMissCache.delete(cacheKey);
    }
    this.alternateFallbackReason = '';
    this.retryGeneration += 1;
    this.dispatchMediaStateChange(false);
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

  private resolveVideoPosterUrl(
    posterSrc: string | undefined,
    baseImageSrc: string,
    resolvedImageUrl: string,
  ): string {
    if (posterSrc && !isAnimation(posterSrc)) {
      return resolveMediaUrl(posterSrc, 'poster');
    }

    if (!useGifPosters()) {
      return '';
    }

    const posterSource = posterSrc || baseImageSrc;
    const posterUrl = resolveMediaUrl(posterSource, 'poster');
    return posterUrl || resolvedImageUrl;
  }

  private isFullSurfaceRedaction(): boolean {
    return (
      this.type === 'feed'
      || this.type === 'masonry'
      || this.type === 'detail'
      || this.type === 'post-detail'
      || this.type === 'lightbox'
    );
  }

  private wrapIfRedacted(content: unknown) {
    if (!this.redacted) return content;
    // EXPERIMENT mosaic overlay — drop .redaction-mosaic + CSS block to discard.
    return html`
      <div class="redaction-shell">
        ${content}
        <div class="redaction-mosaic" aria-hidden="true"></div>
      </div>
    `;
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

    // Defer img/video until the host is in (or near) the viewport — no src, no bytes.
    if (!this.primed) {
      const { fillMode, isDetailSurface } = this.getSurfaceModes();
      this.syncReserveSpaceAttributes(fillMode, isDetailSurface);
      this.toggleAttribute('fill-mode', fillMode);
      this.toggleAttribute('detail-mode', isDetailSurface);
      return nothing;
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
    const { fillMode, isDetailSurface, reserveSpace } = this.getSurfaceModes();
    const usesRawAlias = resolvedImageUrl.includes('/raw/s3://');
    const alternateMissMemoized = this.getCachedAlternateFailure() === 'missing-or-404';
    const shouldUseAlternateVideo = Boolean(this.alternateVideoSrc)
      && !alternateMissMemoized
      && !this.alternatePlaybackFailed;
    const isAnim = isAnimation(baseImageSrc);
    const treatAnimationAsVideo = this.alternateVideoSrc
      ? shouldUseAlternateVideo
      : !this.forceImage && isAnim && !isDetailSurface && !usesRawAlias;
    const resolvedPrimaryUrl = shouldUseAlternateVideo ? resolvedAlternateVideoUrl : resolvedImageUrl;
    const isVideoSource = shouldUseAlternateVideo || (!this.forceImage && !this.alternateVideoSrc && (treatAnimationAsVideo || isNativeVideo(resolvedPrimaryUrl) || resolvedPrimaryUrl.includes('format:mp4')));
    const effectivePoster = this.resolveVideoPosterUrl(this.posterSrc, baseImageSrc, resolvedImageUrl);
    const squareCropMode =
      this.type === 'card' ||
      this.type === 'gallery-grid' ||
      this.type === 'gutter';
    this.toggleAttribute('fill-mode', fillMode);
    this.toggleAttribute('square-crop-mode', squareCropMode);
    const detailFitStyle = 'object-fit: contain; max-width: min(100%, calc(100vw - 40px)); max-height: calc(min(78vh, 920px) - 20px); width: auto; height: auto; margin: 0 auto;';
    this.toggleAttribute('detail-mode', isDetailSurface);
    this.toggleAttribute('redaction-full', this.redacted && this.isFullSurfaceRedaction());
    const mediaStyle = isDetailSurface
      ? detailFitStyle
      : fillMode
      ? 'object-fit: inherit; width: 100%; height: 100%;'
      : reserveSpace
      ? 'object-fit: contain; width: 100%; height: 100%;'
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
      const effectivePreload = defaultPreload;
      const posterOverlayVisible = Boolean(effectivePoster) && this.showPosterFrame;
      const nonFillVideoStyle = isDetailSurface
        ? detailFitStyle
        : posterOverlayVisible
        ? 'object-fit: contain; width: 100%; height: 100%; background: transparent; position: absolute; inset: 0;'
        : 'object-fit: contain; width: 100%; height: auto; background: transparent; position: static;';
      const videoStyle = fillMode ? mediaStyle : nonFillVideoStyle;

      if (!fillMode) {
        return this.wrapIfRedacted(keyed(this.retryGeneration, html`
          <div class="video-shell">
            ${effectivePoster ? html`
              <img
                class="poster-frame ${posterOverlayVisible ? '' : 'hidden'}"
                src=${effectivePoster}
                alt=""
                @load=${this.handleImageLoad}
                @error=${this.handlePosterFrameError}
              />
            ` : nothing}
            <video
              src=${resolvedPrimaryUrl}
              ?autoplay=${effectiveAutoplay}
              ?controls=${effectiveControls}
              ?loop=${effectiveLoop}
              muted
              playsinline
              webkit-playsinline
              preload=${effectivePreload}
              ${effectivePoster ? html`poster=${effectivePoster}` : nothing}
              style=${videoStyle}
              @error=${this.handleError}
              @loadedmetadata=${this.handleVideoMetadata}
              @loadeddata=${this.handleVideoReady}
              @play=${this.handleVideoReady}
            ></video>
          </div>
          ${this.renderDebug(resolvedPrimaryUrl)}
        `));
      }

      return this.wrapIfRedacted(keyed(this.retryGeneration, html`
        <video
          src=${resolvedPrimaryUrl}
          ?autoplay=${effectiveAutoplay}
          ?controls=${effectiveControls}
          ?loop=${effectiveLoop}
          muted
          playsinline
          webkit-playsinline
          preload=${effectivePreload}
          ${effectivePoster ? html`poster=${effectivePoster}` : nothing}
          style=${videoStyle}
          @error=${this.handleError}
          @loadedmetadata=${this.handleVideoMetadata}
          @loadeddata=${this.handleVideoReady}
          @play=${this.handleVideoReady}
        ></video>
        ${this.renderDebug(resolvedPrimaryUrl)}
      `));
    }

    return this.wrapIfRedacted(keyed(this.retryGeneration, html`
      <img
        src=${resolvedImageUrl}
        alt=${this.alt}
        loading="lazy"
        decoding="async"
        style=${mediaStyle}
        @load=${this.handleImageLoad}
        @error=${this.handleError}
      />
      ${this.renderDebug(resolvedImageUrl)}
    `));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-renderer': MediaRenderer;
  }
}
