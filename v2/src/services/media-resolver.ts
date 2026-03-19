/**
 * Centralized Media Resolver for imgproxy-based transformations.
 * Supports environment-specific routing (unsafe vs fixed paths).
 */

import { CONFIG, MEDIA_PRESETS } from '../config.js';
import { isAdminMode } from './blog-resolver.js';

export type MediaRenderType = 'gallery-grid' | 'gallery-masonry' | 'feed' | 'lightbox' | 'gutter' | 'poster';

export const BUCKET_LIST = [
  'ocdn012.bdsmlr.com',
  'cdn101.bdsmlr.com',
  'ocdn011.bdsmlr.com',
  'cdn013.bdsmlr.com',
  'cdn002.reblogme.com'
];

/**
 * Maps a URL to an S3 scheme for imgproxy.
 * Returns [s3Url, queryParams]
 */
function toS3Scheme(url: string): [string, string] {
  if (!url) return ['', ''];
  
  // 1. Detect and Unwrap existing proxying to prevent double-proxying
  let targetUrl = url;
  if (url.includes('/plain/s3://')) {
    const parts = url.split('/plain/s3://');
    targetUrl = 'https://' + parts[1];
  } else if (url.includes('media.i.bdsmlr.com/')) {
    const parts = url.split('media.i.bdsmlr.com/')[1].split('/');
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
  const parts: string[] = [];

  if (currentMode === 'fixed' || currentMode === 'ergonomic') {
    const base = CONFIG.mediaProxyBase.replace('imgproxy.i.', 'media.i.');
    return `${base}/${type}/${s3Url}${queryString}`;
  }

  // UNSAFE MODE: Dynamic transformations
  if (!isAnim) {
    parts.push(preset.gravity.replace('gravity:', 'g:'));
  }

  parts.push(`rs:${preset.resize}:${preset.width}:${preset.height}`);
  
  if (isAnim && type !== 'poster') {
    parts.push('format:mp4');
  } else if (preset.format) {
    parts.push(`format:${preset.format}`);
  }

  return `${CONFIG.mediaProxyBase}/unsafe/${parts.join('/')}/plain/${s3Url}${queryString}`;
}

export function isAnimation(url: string | undefined): boolean {
  if (!url) return false;
  // Unwrap if needed to check original extension
  let checkUrl = url;
  if (url.includes('/plain/s3://')) {
    checkUrl = url.split('/plain/s3://')[1];
  }
  const path = checkUrl.split('?')[0].toLowerCase();
  return path.endsWith('.gif') || path.endsWith('.webp');
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

  if (currentSrc.includes('/plain/s3://')) {
    const parts = currentSrc.split('/plain/s3://');
    proxyPart = parts[0] + '/plain/s3:'; 
    const rest = parts[1].split('?');
    s3Path = rest[0];
    queryParams = rest[1] ? `?${rest[1]}` : '';
  } else {
    try {
      const urlObj = new URL(currentSrc);
      const pathParts = urlObj.pathname.split('/');
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
