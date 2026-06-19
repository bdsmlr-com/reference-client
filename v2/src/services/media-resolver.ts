/**
 * Centralized Media Resolver for imgproxy-based transformations.
 * Supports environment-specific routing (unsafe vs fixed paths).
 */

import { CONFIG, MEDIA_PRESETS } from '../config.js';

export type MediaRenderType = 'card' | 'masonry' | 'detail' | 'poster' | 'gallery-grid' | 'gallery-masonry' | 'feed' | 'lightbox' | 'post-detail' | 'gutter';

// Consolidated media now lives on a single bucket; keep list to one to avoid
// unnecessary failover/probing.
export const BUCKET_LIST = ['ocdn012.bdsmlr.com'];

function canonicalMediaType(type: MediaRenderType): 'card' | 'masonry' | 'detail' | 'poster' {
  switch (type) {
    case 'gallery-grid':
    case 'gutter':
    case 'card':
      return 'card';
    case 'gallery-masonry':
    case 'feed':
    case 'masonry':
      return 'masonry';
    case 'lightbox':
    case 'post-detail':
    case 'detail':
      return 'detail';
    case 'poster':
    default:
      return 'poster';
  }
}

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

  if (url.includes('/raw/s3://')) {
    return url;
  }

  // Preserve URLs that already encode an explicit obscuration transform.
  // Search/archive policy can return pixelated variants directly from the API,
  // and re-deriving them from the render type would silently downgrade them
  // back to clear variants.
  if (url.includes('/unsafe/') && (url.includes('/pix:') || url.includes('/bd:') || url.includes('/bl:'))) {
    return url;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const [s3Url, queryParams] = toS3Scheme(url);


  const canonicalType = canonicalMediaType(type);
  const preset = MEDIA_PRESETS[canonicalType] || MEDIA_PRESETS[type];
  const aliasType = canonicalType;
  
  if (!preset) {
    return url;
  }

  const queryString = queryParams ? `?${queryParams}` : '';
  const currentMode = CONFIG.imgproxyMode;

  const isAnim = isAnimation(url);
  const isVideo = isNativeVideo(url);

  if (currentMode === 'unsafe' && isVideo) {
    return url;
  }
  
  if (currentMode === 'fixed') {
    // FIXED PATH MODE: Uses pre-configured gateway aliases
    // Pattern: /media.i.bdsmlr.com/<type>/s3://bucket/path?sig
    const base = CONFIG.mediaProxyBase.replace('imgproxy.i.', 'media.i.');
    // Note: We use the 'type' (e.g. 'lightbox', 'feed') directly as the Nginx alias
    return `${base}/${aliasType}/${s3Url}${queryString}`;
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

export function resolvePostDetailMediaUrl(url: string | undefined): string {
  if (!url) return '';


  if (url.includes('/raw/s3://')) {
    return url;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const [s3Url, queryParams] = toS3Scheme(url);
  if (!s3Url || !s3Url.startsWith('s3://')) {
    return url;
  }

  const base = CONFIG.mediaProxyBase.replace('imgproxy.i.', 'media.i.');
  const queryString = queryParams ? `?${queryParams}` : '';
  return `${base}/detail/${s3Url}${queryString}`;
}

/**
 * Probes the next available bucket if a media element fails to load.
 */
export function probeNextBucket(_el: HTMLElement): boolean {
  return false;
}

