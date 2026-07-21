export type MediaRenderType = 'card' | 'masonry' | 'detail' | 'poster' | 'gallery-grid' | 'gallery-masonry' | 'feed' | 'lightbox' | 'post-detail' | 'gutter';

function mediaPathForDetection(url: string | undefined): string {
  if (!url) return '';
  let checkUrl = url;
  if (url.includes('/plain/s3://')) {
    checkUrl = url.split('/plain/s3://')[1];
  }
  return checkUrl.split('?')[0].toLowerCase();
}

export function resolveMediaUrl(url: string | undefined, _type: MediaRenderType): string {
  return url || '';
}

export function resolvePostDetailMediaUrl(url: string | undefined): string {
  return resolveMediaUrl(url, 'post-detail');
}

export function toOriginFallbackUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('/uploads/')) {
    return `https://ocdn012.bdsmlr.com${url}`;
  }
  if (url.startsWith('https://') || url.startsWith('http://')) {
    try {
      if (url.includes('/plain/s3://')) {
        const [beforeQuery, query = ''] = url.split('?', 2);
        const plain = beforeQuery.split('/plain/s3://')[1];
        if (plain?.startsWith('ocdn012.bdsmlr.com/')) {
          const path = plain.slice('ocdn012.bdsmlr.com'.length);
          return `https://ocdn012.bdsmlr.com${path}${query ? `?${query}` : ''}`;
        }
      }
    } catch {
      return url;
    }
  }
  return url;
}

export function probeNextBucket(_el: HTMLElement): boolean {
  return false;
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
