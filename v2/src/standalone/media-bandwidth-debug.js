'use strict';

/**
 * Media bandwidth overlay for <media-renderer> elements.
 *
 * Toggle: uncomment the <script> tag in index.html (dev: /src/standalone/…,
 * production build: /v2/assets/media-bandwidth-debug.js).
 *
 * Color key (based on loaded media only — not mere src attributes):
 *   red    — animated image (gif/webp) AND video both loaded
 *   yellow — animated image loaded, no loaded video
 *   green  — video loaded, no loaded animated image
 *   blue   — static image only
 *   gray   — nothing loaded yet
 */

(function initMediaBandwidthDebug() {
  const LOG = '[media-bw-debug]';

  if (globalThis.__mediaBandwidthDebugActive) {
    console.warn(LOG, 'already active — skipping duplicate init');
    return;
  }
  globalThis.__mediaBandwidthDebugActive = true;

  try {
    performance.setResourceTimingBufferSize(5000);
  } catch (err) {
    console.warn(LOG, 'could not set resource timing buffer size', err);
  }

  /** @type {WeakMap<HTMLElement, { overlay: HTMLElement, eventsWired: boolean }>} */
  const tracked = new WeakMap();
  /** @type {WeakSet<Node>} */
  const watchedContainers = new WeakSet();

  /** Query all media-renderer elements, including inside nested shadow roots. */
  function queryAllMediaRenderers() {
    const seen = new Set();
    const out = [];

    function collectFrom(root) {
      if (!(root instanceof Document || root instanceof ShadowRoot)) return;
      for (const el of root.querySelectorAll('media-renderer')) {
        if (seen.has(el)) continue;
        seen.add(el);
        out.push(el);
      }
      const hosts = root.querySelectorAll('*');
      for (const host of hosts) {
        if (host.shadowRoot) collectFrom(host.shadowRoot);
      }
    }

    collectFrom(document);
    return out;
  }

  /** Attach MutationObservers to a container and every shadow root beneath it. */
  function watchContainer(container) {
    if (!(container instanceof Document || container instanceof ShadowRoot)) return;
    if (watchedContainers.has(container)) return;
    watchedContainers.add(container);
    domObserver.observe(container, { childList: true, subtree: true });

    const hosts = container instanceof Document
      ? container.querySelectorAll('*')
      : container.querySelectorAll('*');
    for (const host of hosts) {
      if (host.shadowRoot) watchContainer(host.shadowRoot);
    }
  }

  function whenShadowRootReady(host, callback) {
    if (host.shadowRoot) {
      callback(host.shadowRoot);
      return;
    }
    let attempts = 0;
    const poll = () => {
      if (host.shadowRoot) {
        callback(host.shadowRoot);
        return;
      }
      if (++attempts > 300) return;
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  }

  function registerShadowHost(host) {
    whenShadowRootReady(host, (root) => {
      watchContainer(root);
      scan();
    });
  }

  function handleAddedNode(node) {
    if (!(node instanceof Element)) return;
    if (node.localName === 'media-renderer') {
      attach(node);
      return;
    }
    registerShadowHost(node);
    for (const el of node.querySelectorAll('*')) registerShadowHost(el);
  }

  const COLORS = {
    both: { border: '#ff4444', bg: 'rgba(80,0,0,0.88)', label: 'GIF+VIDEO' },
    gif: { border: '#ffdd33', bg: 'rgba(50,45,0,0.88)', label: 'GIF only' },
    video: { border: '#44dd66', bg: 'rgba(0,40,10,0.88)', label: 'VIDEO only' },
    image: { border: '#66bbff', bg: 'rgba(0,25,50,0.88)', label: 'IMAGE' },
    pending: { border: '#888888', bg: 'rgba(20,20,20,0.85)', label: 'pending' },
  };

  function pathOf(url) {
    if (!url) return '';
    try {
      return new URL(url, location.href).pathname.toLowerCase();
    } catch (_) {
      return String(url).split('?')[0].split('#')[0].toLowerCase();
    }
  }

  function isAnimatedUrl(url) {
    const p = pathOf(url);
    return p.endsWith('.gif') || p.endsWith('.webp');
  }

  function isStaticImageUrl(url) {
    const p = pathOf(url);
    return /\.(jpe?g|png|avif|bmp|svg)$/.test(p)
      || p.includes('format:jpg')
      || p.includes('format:jpeg')
      || p.includes('format:png');
  }

  function isImageLoaded(img) {
    return img instanceof HTMLImageElement
      && img.complete
      && img.naturalWidth > 0
      && img.naturalHeight > 0;
  }

  function isVideoLoaded(video) {
    return video instanceof HTMLVideoElement && video.readyState >= 2;
  }

  function findResourceEntry(url) {
    if (!url) return null;
    const target = pathOf(url);
    const entries = performance.getEntriesByType('resource');
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.name === url || pathOf(entry.name) === target) return entry;
    }
    return null;
  }

  function resourceBytes(url) {
    const entry = findResourceEntry(url);
    if (!entry) return { transfer: null, encoded: null };
    const transfer = entry.transferSize || 0;
    const encoded = entry.encodedBodySize || 0;
    if (transfer === 0 && encoded === 0) return { transfer: null, encoded: null };
    return { transfer, encoded };
  }

  function fmtBytes(n) {
    if (n == null || n <= 0) return '—';
    if (n < 1024) return `${n}B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}kB`;
    return `${(n / (1024 * 1024)).toFixed(2)}MB`;
  }

  function fmtScale(el) {
    if (!el) return '';
    let iw = 0;
    let ih = 0;
    if (el instanceof HTMLImageElement) {
      iw = el.naturalWidth;
      ih = el.naturalHeight;
    } else if (el instanceof HTMLVideoElement) {
      iw = el.videoWidth;
      ih = el.videoHeight;
    }
    const rect = el.getBoundingClientRect();
    if (iw <= 0 || ih <= 0 || rect.width <= 0) return '';
    const cssPct = Math.round((rect.width / iw) * 100);
    const physPct = Math.round(((rect.width * devicePixelRatio) / iw) * 100);
    return `${iw}×${ih}→${Math.round(rect.width)}×${Math.round(rect.height)} · css ${cssPct}% · phys ${physPct}% @${devicePixelRatio}x`;
  }

  function mediaUrl(el) {
    if (el instanceof HTMLImageElement) return el.currentSrc || el.src || '';
    if (el instanceof HTMLVideoElement) return el.currentSrc || el.src || '';
    return '';
  }

  function inferProbeState(host) {
    const alternate = host.alternateVideoSrc || '';
    if (!alternate) return null;
    const reason = host.getAttribute('alternate-fallback-reason') || '';
    if (reason) return { status: 'unavailable', reason };
    const root = host.shadowRoot;
    if (!root) return { status: 'pending', reason: '' };
    if (root.querySelector('video')) return { status: 'playing', reason: '' };
    if (root.querySelector('img:not(.poster-frame)')) return { status: 'image-fallback', reason: '' };
    return { status: 'pending', reason: '' };
  }

  function analyze(host) {
    const root = host.shadowRoot;
    if (!root) return null;

    const imgs = [...root.querySelectorAll('img')];
    const videos = [...root.querySelectorAll('video')];

    const loadedImgs = imgs.filter(isImageLoaded);
    const loadedVideos = videos.filter(isVideoLoaded);

    const loadedAnimatedImgs = loadedImgs.filter((img) => isAnimatedUrl(mediaUrl(img)));
    const loadedStaticImgs = loadedImgs.filter((img) => isStaticImageUrl(mediaUrl(img))
      || (!isAnimatedUrl(mediaUrl(img)) && !isVideoUrlHeuristic(mediaUrl(img))));

    const hasLoadedAnimated = loadedAnimatedImgs.length > 0;
    const hasLoadedVideo = loadedVideos.length > 0;
    const hasLoadedStatic = loadedStaticImgs.length > 0 && !hasLoadedAnimated && !hasLoadedVideo;

    let tier = 'pending';
    if (hasLoadedAnimated && hasLoadedVideo) tier = 'both';
    else if (hasLoadedAnimated) tier = 'gif';
    else if (hasLoadedVideo) tier = 'video';
    else if (hasLoadedStatic || (loadedImgs.length > 0 && !hasLoadedAnimated && !hasLoadedVideo)) tier = 'image';

    const posterImg = imgs.find((img) => img.classList.contains('poster-frame'));
    const primaryImg = imgs.find((img) => !img.classList.contains('poster-frame'));
    const primaryVideo = videos[0] || null;

    const scaleEl = hasLoadedVideo
      ? loadedVideos[0]
      : (loadedAnimatedImgs[0] || loadedStaticImgs[0] || loadedImgs[0] || null);

    const byteLines = [];
    for (const img of loadedImgs) {
      const url = mediaUrl(img);
      const label = img.classList.contains('poster-frame') ? 'poster' : 'img';
      const kind = isAnimatedUrl(url) ? 'gif' : 'img';
      const b = resourceBytes(url);
      byteLines.push(`${label}/${kind} ${fmtBytes(b.transfer ?? b.encoded)}`);
    }
    for (const video of loadedVideos) {
      const b = resourceBytes(mediaUrl(video));
      byteLines.push(`video ${fmtBytes(b.transfer ?? b.encoded)}`);
    }

    const probe = inferProbeState(host);

    return {
      tier,
      loadedImgs: loadedImgs.length,
      loadedVideos: loadedVideos.length,
      posterLoaded: posterImg ? isImageLoaded(posterImg) : false,
      primaryImgLoaded: primaryImg ? isImageLoaded(primaryImg) : false,
      videoLoaded: hasLoadedVideo,
      scale: fmtScale(scaleEl),
      bytes: byteLines.join(' · ') || '—',
      probe,
      surface: host.type || host.getAttribute('type') || '?',
      hasAlternate: Boolean(host.alternateVideoSrc),
    };
  }

  function isVideoUrlHeuristic(url) {
    const p = pathOf(url);
    return /\.(mp4|webm|mov|m4v)$/.test(p) || p.includes('format:mp4');
  }

  function ensureOverlay(host) {
    const root = host.shadowRoot;
    if (!root) return null;

    let state = tracked.get(host);
    if (!state) {
      const overlay = document.createElement('div');
      overlay.className = 'media-bw-debug-overlay';
      overlay.style.cssText = [
        'position:absolute',
        'left:0',
        'right:0',
        'bottom:0',
        'z-index:20',
        'pointer-events:none',
        'font:9px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace',
        'padding:3px 4px',
        'border-top:2px solid #888',
        'color:#e8e8e8',
        'word-break:break-all',
      ].join(';');
      root.appendChild(overlay);
      state = { overlay, eventsWired: false };
      tracked.set(host, state);
    }
    return state.overlay;
  }

  function wireMediaEvents(host) {
    const state = tracked.get(host);
    if (!state || state.eventsWired) return;
    const root = host.shadowRoot;
    if (!root) return;

    const refresh = () => paint(host);
    root.addEventListener('load', refresh, true);
    root.addEventListener('loadeddata', refresh, true);
    root.addEventListener('loadedmetadata', refresh, true);
    root.addEventListener('error', refresh, true);
    state.eventsWired = true;
  }

  function paint(host) {
    const overlay = ensureOverlay(host);
    if (!overlay) return;

    wireMediaEvents(host);
    const info = analyze(host);
    if (!info) return;

    const palette = COLORS[info.tier] || COLORS.pending;
    overlay.style.borderTopColor = palette.border;
    overlay.style.background = palette.bg;

    const probeLine = info.probe
      ? `probe:${info.probe.status}${info.probe.reason ? ` (${info.probe.reason})` : ''}`
      : (info.hasAlternate ? 'probe:—' : '');

    const loadLine = [
      info.posterLoaded ? 'poster✓' : (host.shadowRoot?.querySelector('img.poster-frame') ? 'poster…' : ''),
      info.primaryImgLoaded ? 'img✓' : (host.shadowRoot?.querySelector('img:not(.poster-frame)') ? 'img…' : ''),
      info.videoLoaded ? 'video✓' : (host.shadowRoot?.querySelector('video') ? 'video…' : ''),
    ].filter(Boolean).join(' ');

    overlay.textContent = '';
    const lines = [
      `${palette.label} · ${info.surface}`,
      loadLine,
      probeLine,
      info.bytes,
      info.scale,
    ].filter(Boolean);
    for (const line of lines) {
      const row = document.createElement('div');
      row.textContent = line;
      overlay.appendChild(row);
    }
  }

  function attach(host) {
    if (!(host instanceof HTMLElement) || host.localName !== 'media-renderer') return;
    if (tracked.has(host) && host.shadowRoot) {
      paint(host);
      return;
    }

    const tryPaint = () => {
      if (!host.shadowRoot) return false;
      paint(host);
      return true;
    };

    if (tryPaint()) return;

    let attempts = 0;
    const poll = () => {
      if (tryPaint()) return;
      if (++attempts > 300) {
        console.warn(LOG, 'attach: gave up waiting for shadowRoot', host);
        return;
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  }

  function scan() {
    for (const el of queryAllMediaRenderers()) attach(el);
  }

  const domObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        handleAddedNode(node);
      }
    }
  });

  watchContainer(document);

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const perfObserver = new PerformanceObserver(() => {
        for (const host of queryAllMediaRenderers()) {
          if (tracked.has(host)) paint(host);
        }
      });
      perfObserver.observe({ type: 'resource', buffered: true });
    } catch (err) {
      console.warn(LOG, 'PerformanceObserver failed', err);
    }
  }

  const attrObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.target instanceof HTMLElement && mutation.target.localName === 'media-renderer') {
        paint(mutation.target);
      }
    }
  });
  attrObserver.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['alternate-fallback-reason', 'type'],
  });

  function boot() {
    scan();
    setInterval(() => {
      const all = queryAllMediaRenderers();
      for (const host of all) {
        if (tracked.has(host)) paint(host);
        else attach(host);
      }
      // New Lit routes may mount fresh shadow roots — ensure we are watching them.
      watchContainer(document);
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
