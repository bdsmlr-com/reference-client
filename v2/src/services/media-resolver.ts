/**
 * Centralized Media Resolver for imgproxy-based transformations.
 * Supports environment-specific routing (unsafe vs fixed paths).
 */

import { CONFIG, MEDIA_PRESETS } from '../config.js';
import { isAdminMode } from './blog-resolver.js';

export type MediaRenderType = 'gallery-grid' | 'gallery-masonry' | 'feed' | 'lightbox' | 'post-detail' | 'gutter' | 'poster';

// Consolidated media now lives on a single bucket; keep list to one to avoid
// unnecessary failover/probing.
export const BUCKET_LIST = ['ocdn012.bdsmlr.com'];

function mediaPathForDetection(url: string | undefined): string {
  if (!url) return '';
  let checkUrl = url;
  if (url.includes('/plain/s3://')) {
    checkUrl = url.split('/plain/s3://')[1];
  }
  return checkUrl.split('?')[0].toLowerCase();
}

/**
 * Maps a URL to an S3 scheme for imgproxy.
 * Returns [s3Url, queryParams]
 */
export function toS3Scheme(url: string): [string, string] {
  if (!url) return ['', ''];
  
  // 1. Detect and Unwrap existing proxying to prevent double-proxying
  let targetUrl = url;
  if (url.includes('/plain/s3://')) {
    const parts = url.split('/plain/s3://');
    targetUrl = 'https://' + parts[1];
  } else if (url.includes('/s3://')) {
    // pattern: /<alias>/s3://<bucket>/<path>
    const parts = url.split('/s3://');
    targetUrl = 'https://' + parts[1];
  } else if (url.includes('media.i.bdsmlr.com/')) {
    // pattern: /media.i.bdsmlr.com/<alias>/<bucket>/<path>
    const parts = url.split('media.i.bdsmlr.com/')[1].split('/');
    // parts[0] is alias, parts[1] is bucket, parts[2...] is path
    targetUrl = 'https://' + parts.slice(1).join('/');
  }

  const parts = targetUrl.split('?');
  const cleanUrl = parts[0];
  const queryParams = parts[1] || '';
  
  try {
    const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://ocdn012.bdsmlr.com${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`);
    let host = parsed.hostname;
    const path = parsed.pathname;

    if (!host) {
      return ['', ''];
    }

    if (host.includes('bdsmlr.com') || host.includes('reblogme.com') || host.includes('media.tumblr.com')) {
      if (host.includes('cdn012') && !host.includes('ocdn012')) {
        host = 'ocdn012.bdsmlr.com';
      }
      return [`s3://${host}${path}`, queryParams];
    }
    
    return [cleanUrl, queryParams];
  } catch (e) {
    return [cleanUrl, queryParams];
  }
}

export function resolveMediaUrl(url: string | undefined, type: MediaRenderType): string {
  if (!url) return '';

  // Preserve URLs that already encode an explicit obscuration transform.
  // Search/archive policy can return pixelated variants directly from the API,
  // and re-deriving them from the render type would silently downgrade them
  // back to clear variants.
  if (url.includes('/unsafe/') && (url.includes('/pix:') || url.includes('/bd:') || url.includes('/bl:'))) {
    return url;
  }

  const params = new URLSearchParams(window.location.search);
  const modeOverride = (isAdminMode() && params.get('media_mode')) || null;

  if (modeOverride === 'origin') {
    const [s3Url, queryParams] = toS3Scheme(url);
    const queryString = queryParams ? `?${queryParams}` : '';
    return s3Url.replace('s3://', 'https://') + queryString;
  }

  const [s3Url, queryParams] = toS3Scheme(url);
  const preset = MEDIA_PRESETS[type];
  
  if (!preset) {
    return url;
  }

  const queryString = queryParams ? `?${queryParams}` : '';
  const currentMode = modeOverride || CONFIG.imgproxyMode;

  const isAnim = isAnimation(url);
  const isVideo = isNativeVideo(url);

  if (currentMode === 'unsafe' && isVideo) {
    return url;
  }
  
  if (currentMode === 'fixed' || currentMode === 'ergonomic') {
    // FIXED PATH MODE: Uses pre-configured gateway aliases
    // Pattern: /media.i.bdsmlr.com/<type>/s3://bucket/path?sig
    const base = CONFIG.mediaProxyBase.replace('imgproxy.i.', 'media.i.');
    // Note: We use the 'type' (e.g. 'lightbox', 'feed') directly as the Nginx alias
    return `${base}/${type}/${s3Url}${queryString}`;
  }

  // UNSAFE MODE: Dynamic transformations
  const parts: string[] = [];
  
  // 1. Gravity (e.g. g:sm)
  if (!isAnim) {
    parts.push(preset.gravity.replace('gravity:', 'g:'));
  }

  // 2. Resize
  parts.push(`rs:${preset.resize}:${preset.width}:${preset.height}`);
  
  // 3. Format
  if (isAnim && type !== 'poster') {
    parts.push('format:mp4');
  } else if (preset.format) {
    parts.push(`format:${preset.format}`);
  }

  // Pattern: /imgproxy.i.bdsmlr.com/unsafe/<filters>/plain/s3://bucket/path?sig
  const unsafeQuery = stripSigningQueryParams(queryParams);
  const unsafeQueryString = unsafeQuery ? `?${unsafeQuery}` : '';
  return `${CONFIG.mediaProxyBase}/unsafe/${parts.join('/')}/plain/${s3Url}${unsafeQueryString}`;
}

function stripSigningQueryParams(queryParams: string): string {
  if (!queryParams) return '';
  const params = new URLSearchParams(queryParams);
  params.delete('e');
  params.delete('t');
  params.delete('cb');
  return params.toString();
}

export function isAnimation(url: string | undefined): boolean {
  const path = mediaPathForDetection(url);
  if (!path) return false;
  return path.endsWith('.gif') || path.endsWith('.webp');
}

export function isNativeVideo(url: string | undefined): boolean {
  const path = mediaPathForDetection(url);
  if (!path) return false;
  return path.endsWith('.mp4') || path.endsWith('.mov') || path.endsWith('.m4v') || path.endsWith('.webm');
}

export function isNativeAudio(url: string | undefined): boolean {
  const path = mediaPathForDetection(url);
  if (!path) return false;
  return path.endsWith('.mp3') || path.endsWith('.aac') || path.endsWith('.wav') || path.endsWith('.ogg');
}

/**
 * Build a direct-origin fallback URL from any media URL shape.
 * Keeps existing signature query params so the same auth envelope is preserved.
 */
export function toOriginFallbackUrl(url: string | undefined): string {
  if (!url) return '';
  const [s3Url, queryParams] = toS3Scheme(url);
  if (!s3Url) return url;
  const queryString = queryParams ? `?${queryParams}` : '';
  return s3Url.replace('s3://', 'https://') + queryString;
}

/**
 * Probes the next available bucket if a media element fails to load.
 */
export function probeNextBucket(el: HTMLElement): boolean {
  let currentSrc = '';
  if (el instanceof HTMLImageElement) currentSrc = el.src;
  else if (el instanceof HTMLVideoElement) currentSrc = el.src;
  else if (el instanceof HTMLSourceElement) currentSrc = el.src;

  if (!currentSrc || (!currentSrc.includes('/plain/s3://') && !currentSrc.includes('.bdsmlr.com/'))) return false;

  let proxyPart = '';
  let s3Path = '';
  let queryParams = '';
  let ergonomicS3Alias = '';
  let usesErgonomicS3 = false;

  if (currentSrc.includes('/plain/s3://')) {
    const parts = currentSrc.split('/plain/s3://');
    // Important: keep the filters part of the proxyPart
    proxyPart = parts[0] + '/plain/s3:'; 
    const rest = parts[1].split('?');
    s3Path = rest[0];
    queryParams = rest[1] ? `?${rest[1]}` : '';
  } else if (currentSrc.includes('/s3://')) {
    // Ergonomic form: https://media.i.../<alias>/s3://<bucket>/<path>?...
    try {
      const urlObj = new URL(currentSrc);
      const afterHost = `${urlObj.pathname}${urlObj.search}`.replace(/^\/+/, '');
      const alias = afterHost.split('/')[0];
      const s3Part = afterHost.slice(alias.length + 1).split('?')[0];
      const m = s3Part.match(/^s3:\/\/([^/]+)(\/.*)$/);
      if (!m) return false;
      ergonomicS3Alias = alias;
      usesErgonomicS3 = true;
      s3Path = `${m[1]}${m[2]}`;
      queryParams = urlObj.search;
      proxyPart = `${urlObj.origin}/${alias}/s3:`;
    } catch (e) {
      return false;
    }
  } else {
    try {
      const urlObj = new URL(currentSrc);
      const pathParts = urlObj.pathname.split('/');
      // pathParts[0]='', [1]=alias, [2]=bucket, [3...]=path
      proxyPart = `${urlObj.origin}/${pathParts[1]}`;
      s3Path = pathParts.slice(2).join('/');
      queryParams = urlObj.search;
    } catch (e) {
      return false;
    }
  }

  const pathSegments = s3Path.replace(/^\/\//, '').split('/');
  const currentBucket = pathSegments[0];
  const filePath = '/' + pathSegments.slice(1).join('/');

  let nextIndex = 0;
  const currentIndex = BUCKET_LIST.indexOf(currentBucket);
  if (currentIndex !== -1) {
    nextIndex = currentIndex + 1;
  }

  if (nextIndex < BUCKET_LIST.length) {
    const nextBucket = BUCKET_LIST[nextIndex];
    let nextSrc = '';
    
    if (currentSrc.includes('/plain/s3://')) {
      nextSrc = `${proxyPart}//${nextBucket}${filePath}${queryParams}`;
    } else if (usesErgonomicS3) {
      nextSrc = `${new URL(currentSrc).origin}/${ergonomicS3Alias}/s3://${nextBucket}${filePath}${queryParams}`;
    } else {
      nextSrc = `${proxyPart}/${nextBucket}${filePath}${queryParams}`;
    }
    
    if (el instanceof HTMLImageElement) el.src = nextSrc;
    else if (el instanceof HTMLVideoElement) {
      el.src = nextSrc;
      el.load();
      el.play().catch(() => {});
    }
    else if (el instanceof HTMLSourceElement) {
      const video = el.parentElement as HTMLVideoElement;
      el.src = nextSrc;
      if (video && video.load) {
        video.load();
        video.play().catch(() => {});
      }
    }
    
    console.log(`[MediaProbe] Failover: ${currentBucket} -> ${nextBucket}`);
    return true;
  }

  return false;
}
