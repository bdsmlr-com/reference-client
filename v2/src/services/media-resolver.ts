/**
 * Centralized Media Resolver for imgproxy-based transformations.
 * DUMB FRONTEND: Trusts the backend URLs entirely.
 */

const MEDIA_PROXY_BASE = 'http://100.98.53.103:8085/unsafe';
const DEFAULT_GRAVITY = 'gravity:sm';

export type MediaContext = 'thumbnail' | 'feed' | 'lightbox' | 'gutter' | 'poster';

export const BUCKET_LIST = [
  'ocdn012.bdsmlr.com',
  'cdn101.bdsmlr.com',
  'ocdn011.bdsmlr.com',
  'cdn013.bdsmlr.com',
  'cdn002.reblogme.com'
];

interface MediaOptions {
  width?: number;
  height?: number;
  format?: 'webp' | 'mp4' | 'jpg';
}

const CONTEXT_PRESETS: Record<MediaContext, MediaOptions> = {
  thumbnail: { width: 300, height: 300 },
  feed: { width: 600, height: 0 },
  lightbox: { width: 1200, height: 0 },
  gutter: { width: 150, height: 150 },
  poster: { width: 600, height: 0, format: 'jpg' }
};

/**
 * Maps a URL to an S3 scheme for imgproxy.
 */
function toS3Scheme(url: string): string {
  if (!url) return '';
  const cleanUrl = url.split('?')[0];
  
  let host = '';
  let path = '';

  if (cleanUrl.includes('bdsmlr.com')) {
    const parts = cleanUrl.split('bdsmlr.com');
    const rawHost = parts[0].split('//').pop() || '';
    host = `${rawHost}bdsmlr.com`;
    path = parts[1];
  } else if (cleanUrl.includes('reblogme.com')) {
    const parts = cleanUrl.split('reblogme.com');
    const rawHost = parts[0].split('//').pop() || '';
    host = `${rawHost}reblogme.com`;
    path = parts[1];
  }

  if (host && path) {
    const finalHost = host.includes('cdn012') ? 'ocdn012.bdsmlr.com' : host;
    return `s3://${finalHost}${path}`;
  }
  return cleanUrl;
}

export function resolveMediaUrl(url: string | undefined, context: MediaContext): string {
  if (!url) return '';
  const s3Url = toS3Scheme(url);
  const preset = CONTEXT_PRESETS[context];
  const parts: string[] = [];
  
  const isAnim = isAnimation(url);
  const resizeMode = (preset.height && preset.height > 0) ? 'fill' : 'fit';
  parts.push(`resize:${resizeMode}:${preset.width || 0}:${preset.height || 0}`);
  
  if (!isAnim) parts.push(DEFAULT_GRAVITY);
  
  if (isAnim && context !== 'poster') {
    parts.push('format:mp4');
  } else if (preset.format) {
    parts.push(`format:${preset.format}`);
  }

  return `${MEDIA_PROXY_BASE}/${parts.join('/')}/plain/${s3Url}`;
}

export function isAnimation(url: string | undefined): boolean {
  if (!url) return false;
  return url.split('?')[0].toLowerCase().endsWith('.gif') || url.split('?')[0].toLowerCase().endsWith('.webp');
}

/**
 * Probes the next available bucket if an image fails to load.
 */
export function probeNextBucket(img: HTMLImageElement): boolean {
  const currentSrc = img.src;
  if (!currentSrc.includes('/plain/s3://')) return false;

  const parts = currentSrc.split('/plain/s3://');
  const proxyPart = parts[0];
  const s3Path = parts[1];
  const currentBucket = s3Path.split('/')[0];
  const filePath = s3Path.substring(currentBucket.length);

  // Determine current index in the rotation
  let nextIndex = 0;
  const currentIndex = BUCKET_LIST.indexOf(currentBucket);
  if (currentIndex !== -1) {
    nextIndex = currentIndex + 1;
  }

  if (nextIndex < BUCKET_LIST.length) {
    const nextBucket = BUCKET_LIST[nextIndex];
    img.src = `${proxyPart}/plain/s3://${nextBucket}${filePath}`;
    console.log(`[MediaProbe] Failover: ${currentBucket} -> ${nextBucket}`);
    return true;
  }

  return false;
}
