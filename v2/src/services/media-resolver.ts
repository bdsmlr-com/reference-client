/**
 * Centralized Media Resolver for imgproxy-based transformations.
 * Handles resizing, cropping, and format conversion (GIF -> MP4).
 */

const MEDIA_PROXY_BASE = 'http://100.98.53.103:8085/unsafe';
const DEFAULT_GRAVITY = 'gravity:sm'; // Smart gravity (object detection)
const DETECTION_ENABLED = 'draw_detections:1';

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
function toS3Scheme(url: string): string {
  if (!url) return '';
  
  // Support ocdn012, cdn012, cdn101, etc.
  const cdnMatch = url.match(/(o?cdn\d+)\.bdsmlr\.com/);
  if (cdnMatch) {
    const host = cdnMatch[0];
    const path = url.split(host)[1];
    // We map all of them to the same logical S3 bucket structure
    // (If ocdn012 maps to a specific bucket, we can adjust this)
    const bucket = host === 'ocdn012.bdsmlr.com' ? 'ocdn012.bdsmlr.com' : 'ocdn012.bdsmlr.com';
    return `s3://${bucket}${path}`;
  }

  return url;
}

/**
 * Resolves a URL through the media proxy with context-specific options.
 */
export function resolveMediaUrl(url: string | undefined, context: MediaContext): string {
  if (!url) return '';
  
  const s3Url = toS3Scheme(url);
  const preset = CONTEXT_PRESETS[context];
  
  // Build processing options
  const parts: string[] = [];
  
  // 1. Detections (Admin/Dev feature)
  parts.push(DETECTION_ENABLED);
  
  // 2. Resize logic: fill means crop-to-fit, proportional means 0 for height
  const resizeMode = (preset.height && preset.height > 0) ? 'fill' : 'fit';
  parts.push(`resize:${resizeMode}:${preset.width || 0}:${preset.height || 0}`);
  
  // 3. Gravity
  parts.push(DEFAULT_GRAVITY);
  
  // 4. Auto-convert GIF to MP4 if requested (imgproxy supports this via extension)
  let extension = '';
  if (url.toLowerCase().endsWith('.gif') && context !== 'poster') {
    // Note: In imgproxy, you often append @mp4 or similar to the format section
    // but the most reliable way is setting the format option
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
