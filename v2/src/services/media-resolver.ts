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
  
  // Strip params just in case, though backend should have handled it
  const cleanUrl = url.split('?')[0];
  
  // Extract host and path for S3 mapping
  // Supports: cdnXXX.bdsmlr.com, ocdnXXX.bdsmlr.com, cdnXXX.reblogme.com
  const hostMatch = cleanUrl.match(/((?:o?cdn\d+(?:\.bdsmlr|\.reblogme))\.com)/);
  if (hostMatch) {
    const host = hostMatch[1];
    const path = cleanUrl.split(host)[1];
    return `s3://${host}${path}`;
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
