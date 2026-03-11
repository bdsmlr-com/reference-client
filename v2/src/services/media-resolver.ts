/**
 * Centralized Media Resolver for imgproxy-based transformations.
 * Handles resizing, cropping, and format conversion (GIF -> MP4).
 */

const MEDIA_PROXY_BASE = 'http://100.98.53.103:8085/unsafe';
const DEFAULT_GRAVITY = 'gravity:sm'; // Smart gravity (object detection)


export type MediaContext = 'thumbnail' | 'feed' | 'lightbox' | 'gutter' | 'poster';

interface MediaOptions {
  width?: number;
  height?: number;
  format?: 'webp' | 'mp4' | 'jpg';
  enlarge?: boolean;
}

const CONTEXT_PRESETS: Record<MediaContext, MediaOptions> = {
  thumbnail: { width: 300, height: 300 }, // Square grid
  feed: { width: 600, height: 0 },        // Proportional feed
  lightbox: { width: 1200, height: 0 },   // High-res proportional
  gutter: { width: 150, height: 150 },    // Small square gutter
  poster: { width: 600, height: 0, format: 'jpg' } // Video poster
};

/**
 * Normalizes a CDN URL to an S3 scheme for imgproxy.
 */
/**
 * Normalizes a CDN URL to an S3 scheme for imgproxy using the authoritative bucket list.
 */
function toS3Scheme(url: string): string {
  if (!url) return '';
  
  // 1. Strip query parameters (signed tokens, etc)
  const cleanUrl = url.split('?')[0];
  
  // 2. Authoritative Bucket List
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

  // 3. Fallback for other bdsmlr CDNs following the standard pattern
  const hostMatch = cleanUrl.match(/((?:o?cdn\d+)\.bdsmlr\.com)/);
  if (hostMatch) {
    const host = hostMatch[1];
    const path = cleanUrl.split(host)[1];
    return `s3://${host}${path}`;
  }

  return cleanUrl;
}

/**
 * Resolves a URL through the media proxy with context-specific options.
 */
export function resolveMediaUrl(url: string | undefined, context: MediaContext): string {
  if (!url) return '';
  
  const s3Url = toS3Scheme(url);
  const preset = CONTEXT_PRESETS[context];
  
  const parts: string[] = [];
  
  // 1. Resize logic
  const resizeMode = (preset.height && preset.height > 0) ? 'fill' : 'fit';
  parts.push(`resize:${resizeMode}:${preset.width || 0}:${preset.height || 0}`);
  
  // 2. Gravity
  parts.push(DEFAULT_GRAVITY);
  
  // 3. Format conversion
  let extension = '';
  if (url.toLowerCase().endsWith('.gif') && context !== 'poster') {
    parts.push('format:mp4');
    extension = '@mp4';
  } else if (preset.format) {
    parts.push(`format:${preset.format}`);
  }

  const optionsStr = parts.join('/');
  return `${MEDIA_PROXY_BASE}/${optionsStr}/plain/${s3Url}${extension}`;
}

/**
 * Specifically handles GIF to Video mapping.
 */
export function isGif(url: string | undefined): boolean {
  return !!url?.toLowerCase().endsWith('.gif');
}
