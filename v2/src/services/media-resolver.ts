/**
 * Centralized Media Resolver for imgproxy-based transformations.
 * DUMB FRONTEND: Trusts the backend URLs entirely.
 */

const MEDIA_PROXY_BASE = 'http://100.98.53.103:8085/unsafe';
const DEFAULT_GRAVITY = 'gravity:sm';

export type MediaContext = 'thumbnail' | 'feed' | 'lightbox' | 'gutter' | 'poster';

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
 * Normalizes a URL to an S3 scheme for imgproxy.
 * Only identifies host and path to wrap in s3://.
 */
function toS3Scheme(url: string): string {
  if (!url) return '';
  
  // 1. Strip query parameters
  const cleanUrl = url.split('?')[0];
  
  // 2. Authoritative Mapping
  // We strictly identify the host and the path
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
    // Priority rule: any host that looks like cdn012 -> ocdn012
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
  
  const resizeMode = (preset.height && preset.height > 0) ? 'fill' : 'fit';
  parts.push(`resize:${resizeMode}:${preset.width || 0}:${preset.height || 0}`);
  parts.push(DEFAULT_GRAVITY);
  
  let extension = '';
  if (url.toLowerCase().endsWith('.gif') && context !== 'poster') {
    parts.push('format:mp4');
    extension = '@mp4';
  } else if (preset.format) {
    parts.push(`format:${preset.format}`);
  }

  return `${MEDIA_PROXY_BASE}/${parts.join('/')}/plain/${s3Url}${extension}`;
}

export function isGif(url: string | undefined): boolean {
  return !!url?.toLowerCase().endsWith('.gif');
}
