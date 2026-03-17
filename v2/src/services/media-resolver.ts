/**
 * Centralized Media Resolver for imgproxy-based transformations.
 * Supports environment-specific routing (unsafe vs fixed paths).
 */

import { CONFIG, MEDIA_PRESETS } from '../config.js';

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
 */
function toS3Scheme(url: string): string {
  if (!url) return '';
  const cleanUrl = url.split('?')[0];
  
  try {
    const parsed = new URL(cleanUrl);
    let host = parsed.hostname;
    const path = parsed.pathname;

    // Handle standard bdsmlr/reblogme/tumblr domains
    if (host.includes('bdsmlr.com') || host.includes('reblogme.com') || host.includes('media.tumblr.com')) {
      // Normalize host (cdn012 -> ocdn012)
      if (host.includes('cdn012')) {
        host = 'ocdn012.bdsmlr.com';
      }
      return `s3://${host}${path}`;
    }
  } catch (e) {
    // Relative path (e.g. /uploads/photos/...)
    if (cleanUrl.startsWith('/') || cleanUrl.startsWith('uploads/')) {
      const path = cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
      return `s3://ocdn012.bdsmlr.com${path}`;
    }
  }

  return cleanUrl;
}

export function resolveMediaUrl(url: string | undefined, type: MediaRenderType): string {
  if (!url) return '';
  const s3Url = toS3Scheme(url);
  const preset = MEDIA_PRESETS[type];
  
  if (!preset) {
    console.warn(`[MediaResolver] Missing preset for type: ${type}`);
    return url;
  }

  if (CONFIG.imgproxyMode === 'fixed') {
    // FIXED PATH MODE: Uses pre-configured gateway aliases
    return `${CONFIG.mediaProxyBase}/${type}/${s3Url}`;
  }

  // UNSAFE MODE: Dynamic transformations
  const parts: string[] = [];
  const isAnim = isAnimation(url);
  
  // 1. Gravity (e.g. gravity:sm)
  if (!isAnim) {
    parts.push(preset.gravity);
  }

  // 2. Resize
  parts.push(`resize:${preset.resize}:${preset.width}:${preset.height}`);
  
  // 3. Format
  if (isAnim && type !== 'poster') {
    parts.push('format:mp4');
  } else if (preset.format) {
    parts.push(`format:${preset.format}`);
  }

  return `${CONFIG.mediaProxyBase}/${parts.join('/')}/plain/${s3Url}`;
}

export function isAnimation(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0].toLowerCase();
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

  if (!currentSrc || !currentSrc.includes('/plain/s3://')) return false;

  const parts = currentSrc.split('/plain/s3://');
  const proxyPart = parts[0];
  const s3Path = parts[1];
  const currentBucket = s3Path.split('/')[0];
  const filePath = s3Path.substring(currentBucket.length);

  let nextIndex = 0;
  const currentIndex = BUCKET_LIST.indexOf(currentBucket);
  if (currentIndex !== -1) {
    nextIndex = currentIndex + 1;
  }

  if (nextIndex < BUCKET_LIST.length) {
    const nextBucket = BUCKET_LIST[nextIndex];
    const nextSrc = `${proxyPart}/plain/s3://${nextBucket}${filePath}`;
    
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
