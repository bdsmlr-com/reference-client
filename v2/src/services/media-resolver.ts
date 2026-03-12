/**
 * Centralized Media Resolver for imgproxy-based transformations.
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
 * Normalizes a CDN URL to an S3 scheme for imgproxy using the authoritative bucket list.
 */
function toS3Scheme(url: string): string {
  if (!url) return '';
  
  const cleanUrl = url.split('?')[0];
  
  // 1. CRITICAL: Handle cdn012 -> ocdn012 mapping first
  if (cleanUrl.includes('cdn012.bdsmlr.com')) {
    const path = cleanUrl.split('cdn012.bdsmlr.com')[1];
    return `s3://ocdn012.bdsmlr.com${path}`;
  }

  // 2. Authoritative Bucket List (1:1 mapping)
  const AUTHORITATIVE_HOSTS = [
    'cdn002.reblogme.com',
    'cdn013.bdsmlr.com',
    'cdn101.bdsmlr.com',
    'ocdn011.bdsmlr.com',
    'ocdn012.bdsmlr.com'
  ];

  for (const host of AUTHORITATIVE_HOSTS) {
    if (cleanUrl.includes(host)) {
      const path = cleanUrl.split(host)[1];
      return `s3://${host}${path}`;
    }
  }

  // 3. Pattern Fallback for other bdsmlr CDNs
  const hostMatch = cleanUrl.match(/((?:o?cdn\d+)\.bdsmlr\.com)/);
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
