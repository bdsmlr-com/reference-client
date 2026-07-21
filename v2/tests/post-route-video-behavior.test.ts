// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

async function newRenderer() {
  await import('../src/components/media-renderer.js');
  return document.createElement('media-renderer') as any;
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('post route media behavior', () => {
  it('view-post renders post-detail-content directly without the reused feed-card shell', () => {
    const src = readFileSync(join(process.cwd(), 'src/pages/view-post.ts'), 'utf8');
    expect(src).toContain('<post-detail-content');
    expect(src).not.toContain('<post-feed-item');
    expect(src).not.toContain('@post-click=${this.handlePostClick}');
  });

  it('post-feed-item forwards contract-driven media roles to media-renderer', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/post-feed-item.ts'), 'utf8');
    expect(src).toContain('@property({ type: Boolean }) disableClick = false;');
    expect(src).toContain('@property({ type: Boolean }) videoAutoplay?: boolean;');
    expect(src).toContain('@property({ type: Boolean }) videoControls?: boolean;');
    expect(src).toContain('@property({ type: Boolean }) videoLoop?: boolean;');
    expect(src).toContain("import { toPresentationModel } from '../services/post-presentation.js';");
    expect(src).toContain("const mediaRenderType = presentation.media.preset as MediaRenderType;");
    expect(src).toContain('.autoplayVideo=${this.videoAutoplay}');
    expect(src).toContain('.controlsVideo=${this.videoControls}');
    expect(src).toContain('.loopVideo=${this.videoLoop}');
    expect(src).toContain('.type=${mediaRenderType}');
    expect(src).toContain("const animatedAlternateSrc = item.kind === 'IMAGE' && representationKind === 'ANIMATED_VIDEO'");
    expect(src).toContain('.alternateVideoSrc=${animatedAlternateSrc || undefined}');
    expect(src).toContain('.posterSrc=${posterSrc}');
    expect(src).toContain('.fallbackSrc=${fallbackSrc}');
    expect(src).toContain(".forceImage=${item.kind === 'IMAGE'}");
    expect(src).not.toContain("const rawUrl = media.type === 'video'");
  });

  it('media-renderer supports alternate video fallback and post-detail video mode defaults', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/media-renderer.ts'), 'utf8');
    expect(src).toContain('controls=${effectiveControls}');
    expect(src).toContain('autoplay=${effectiveAutoplay}');
    expect(src).toContain('loop=${effectiveLoop}');
    expect(src).toContain('@property({ type: String }) posterSrc');
    expect(src).toContain('@property({ type: String }) alternateVideoSrc');
    expect(src).toContain('@property({ type: Boolean }) forceImage = false;');
    expect(src).toContain("const effectivePreload = defaultPreload;");
    expect(src).toContain('const resolvedPrimaryUrl = shouldUseAlternateVideo ? resolvedAlternateVideoUrl : resolvedImageUrl;');
    expect(src).not.toContain('ensureAnimatedAlternateProbe');
    expect(src).not.toContain('probe-pending');
    expect(src).toContain('useGifPosters');
    expect(src).toContain('src=${resolvedPrimaryUrl}');
    expect(src).not.toContain('<source src=${resolvedUrl} type="video/mp4"');
    expect(src).toContain('class="poster-frame');
    expect(src).toContain('@error=${this.handlePosterFrameError}');
    expect(src).toContain('@loadeddata=${this.handleVideoReady}');
    expect(src).toContain('@play=${this.handleVideoReady}');
    expect(src).toContain("position: static;");
    expect(src).toContain("const detailFitStyle = 'object-fit: contain; max-width: min(100%, calc(100vw - 40px)); max-height: calc(min(78vh, 920px) - 20px); width: auto; height: auto; margin: 0 auto;';");
    expect(src).toContain("const isDetailSurface = this.type === 'detail' || this.type === 'post-detail';");
    expect(src).toContain('const isAnim = isAnimation(baseImageSrc);');
    expect(src).toContain("const alternateMissMemoized = this.getCachedAlternateFailure() === 'missing-or-404';");
    expect(src).toContain('&& !alternateMissMemoized');
    expect(src).toContain('&& !this.alternatePlaybackFailed');
    expect(src).toContain("const treatAnimationAsVideo = this.alternateVideoSrc");
    expect(src).toContain("!this.forceImage && !this.alternateVideoSrc");
    expect(src).toContain('animatedAlternateMissCache');
    expect(src).toContain('animatedAlternateProbeCache');
    expect(src).toContain('void this.confirmAlternateFailureReason(this.alternateVideoSrc, reason);');
    expect(src).toContain('markAlternateUnavailable');
    expect(src).toContain('probeAnimatedAlternateFailure');
    expect(src).not.toContain('alternateProbeStatus');
    expect(src).toContain('const behavior = getMediaBehavior(this.type);');
    expect(src).toContain('const effectiveAutoplay = this.autoplayVideo ?? behavior.autoplay;');
    expect(src).toContain("const defaultPreload = behavior.preload ?? 'none';");
    expect(src).toContain("this.type === 'card' ||");
    expect(src).toContain("const squareCropMode =");
    expect(src).toContain("this.type === 'gallery-grid' ||");
    expect(src).toContain("this.type === 'gutter';");
    expect(src).toContain("this.toggleAttribute('square-crop-mode', squareCropMode);");
    expect(src).toContain(":host([square-crop-mode]) {");
    expect(src).toContain("align-items: center;");
    expect(src).toContain("justify-content: center;");
    expect(src).toContain("object-position: center center;");
    expect(src).toContain("@click=${this.handleRetryInteraction}");
    expect(src).toContain('Load Failed. Retry ⟳');
    expect(src).toContain('color: #b86a6a;');
    expect(src).toContain('cursor: pointer;');
    expect(src).toContain('event.stopPropagation();');
    expect(src).toContain('event.preventDefault();');
  });

  it('falls back only after a confirmed signed alternate 404 and memoizes that miss', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 404 }));

    const renderer = await newRenderer();
    renderer.src = 'https://ocdn012.bdsmlr.com/uploads/photos/miss.gif?e=1&t=1';
    renderer.alternateVideoSrc = 'https://ocdn012.bdsmlr.com/uploads/photos/miss.mp4?e=1&t=1';
    renderer.fallbackSrc = renderer.src;
    renderer.forceImage = true;
    renderer.type = 'feed';

    renderer.handleError({
      target: {
        tagName: 'VIDEO',
        error: { code: 2 },
      },
    } as unknown as Event);
    await flushAsyncWork();

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      'https://ocdn012.bdsmlr.com/uploads/photos/miss.mp4?e=1&t=1',
      expect.objectContaining({ method: 'HEAD', mode: 'cors', cache: 'no-store' }),
    );
    expect(renderer.alternateFallbackReason).toBe('missing-or-404');
    expect(renderer.alternatePlaybackFailed).toBe(true);

    const memoized = await newRenderer();
    memoized.alternateVideoSrc = 'https://ocdn012.bdsmlr.com/uploads/photos/miss.mp4?e=2&t=2';
    memoized.syncAlternateFallbackReasonFromCache();
    expect(memoized.alternateFallbackReason).toBe('missing-or-404');
  });

  it('does not treat unsigned network, auth, or decode failures as missing alternates', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 403 });
    vi.stubGlobal('fetch', fetchMock);

    const unsignedRenderer = await newRenderer();
    unsignedRenderer.alternateVideoSrc = 'https://ocdn012.bdsmlr.com/uploads/photos/unsigned.mp4';
    unsignedRenderer.handleError({
      target: {
        tagName: 'VIDEO',
        error: { code: 2 },
      },
    } as unknown as Event);
    await flushAsyncWork();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(unsignedRenderer.alternateFallbackReason).toBe('other-load-error');
    expect(unsignedRenderer.alternatePlaybackFailed).toBe(false);

    const signedRenderer = await newRenderer();
    signedRenderer.alternateVideoSrc = 'https://ocdn012.bdsmlr.com/uploads/photos/auth.mp4?e=1&t=1';
    signedRenderer.handleError({
      target: {
        tagName: 'VIDEO',
        error: { code: 2 },
      },
    } as unknown as Event);
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ocdn012.bdsmlr.com/uploads/photos/auth.mp4?e=1&t=1',
      expect.objectContaining({ method: 'HEAD', mode: 'cors', cache: 'no-store' }),
    );
    expect(signedRenderer.alternateFallbackReason).toBe('token-or-auth');
    expect(signedRenderer.alternatePlaybackFailed).toBe(false);

    const decodeRenderer = await newRenderer();
    decodeRenderer.alternateVideoSrc = 'https://ocdn012.bdsmlr.com/uploads/photos/decode.mp4?e=1&t=1';
    decodeRenderer.handleError({
      target: {
        tagName: 'VIDEO',
        error: { code: 3 },
      },
    } as unknown as Event);

    expect(decodeRenderer.alternateFallbackReason).toBe('codec-or-playback');
    expect(decodeRenderer.alternatePlaybackFailed).toBe(false);
  });

  it('post-detail-content emits the canonical detail media family from ordered blocks', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/post-detail-content.ts'), 'utf8');
    expect(src).toContain(".type=${'detail'}");
    expect(src).not.toContain(".type=${'post-detail'}");
    expect(src).toContain('.media-stage media-renderer {');
    expect(src).toContain('.media-gallery {');
    expect(src).toContain('const orderedBlocks = getOrderedContentBlocks(p);');
    expect(src).toContain("const alternateVideoSrc = item.kind === 'IMAGE' && representationKind === 'ANIMATED_VIDEO'");
    expect(src).toContain('.alternateVideoSrc=${alternateVideoSrc || undefined}');
    expect(src).toContain(".forceImage=${item.kind === 'IMAGE'}");
    expect(src).not.toContain('const mediaFiles = p.content?.files || [];');
    expect(src).not.toContain('const multiImageUrls = p.type === 2 && mediaFiles.length > 1 ? mediaFiles : [];');
    expect(src).not.toContain("import { resolvePostDetailMediaUrl } from '../services/media-resolver.js';");
    expect(src).toContain('width: auto;');
    expect(src).toContain('height: auto;');
    expect(src).toContain('max-width: min(100%, calc(100vw - 40px));');
    expect(src).toContain('max-height: calc(min(78vh, 920px) - 20px);');
  });

  it('media-renderer keeps video as the only visible media surface (no overlay poster hack)', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/media-renderer.ts'), 'utf8');
    expect(src).not.toContain('poster-overlay');
    expect(src).not.toContain('video-wrap');
  });

  it('lightbox forwards contract-derived media descriptors to media-renderer', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/post-lightbox.ts'), 'utf8');
    expect(src).toContain("const presentation = toPresentationModel(this.post, { surface: 'lightbox', page: 'post' });");
    expect(src).toContain("const mediaRenderType = presentation.media.preset as MediaRenderType;");
    expect(src).toContain("const mediaSources = buildLightboxMediaSources(this.post);");
    expect(src).toContain(".posterSrc=${source.posterSrc}");
    expect(src).toContain(".alternateVideoSrc=${source.alternateVideoSrc}");
    expect(src).toContain(".fallbackSrc=${source.fallbackSrc}");
    expect(src).toContain(".forceImage=${source.forceImage ?? false}");
    expect(src).toContain('.type=${mediaRenderType}');
  });

  it('lightbox does not show a missing-media ghost for text posts with no files', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/post-lightbox.ts'), 'utf8');
    expect(src).toContain("if (media.type === 'text' && mediaSources.length === 0) {");
    expect(src).toContain('return nothing;');
  });
});
