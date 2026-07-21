export type MediaRenderType = 'card' | 'masonry' | 'detail' | 'poster' | 'gallery-grid' | 'gallery-masonry' | 'feed' | 'lightbox' | 'post-detail' | 'gutter';

export const BUCKET_LIST = ['ocdn012.bdsmlr.com'];

function mediaPathForDetection(url: string | undefined): string {
  if (!url) return '';
  let checkUrl = url;
  if (url.includes('/plain/s3://')) {
    checkUrl = url.split('/plain/s3://')[1];
  }
  return checkUrl.split('?')[0].toLowerCase();
}

export function toS3Scheme(url: string): [string, string] {
  if (!url) return ['', ''];

  let targetUrl = url;
  if (url.startsWith('s3://')) {
    targetUrl = 'https://' + url.slice('s3://'.length);
  } else if (url.startsWith('/s3://')) {
    targetUrl = 'https://' + url.slice('/s3://'.length);
  } else if (url.includes('/plain/s3://')) {
    const parts = url.split('/plain/s3://');
    targetUrl = 'https://' + parts[1];
  } else if (url.includes('/s3://')) {
    const parts = url.split('/s3://');
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
  } catch {
    return [cleanUrl, queryParams];
  }
}

export function resolveMediaUrl(url: string | undefined, _type: MediaRenderType): string {
  return url || '';
}

export function resolvePostDetailMediaUrl(url: string | undefined): string {
  return resolveMediaUrl(url, 'post-detail');
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

export function toOriginFallbackUrl(url: string | undefined): string {
  if (!url) return '';
  const [s3Url, queryParams] = toS3Scheme(url);
  if (!s3Url) return url;
  const queryString = queryParams ? `?${queryParams}` : '';
  if (s3Url.startsWith('s3://')) {
    return s3Url.replace('s3://', 'https://') + queryString;
  }
  return s3Url + queryString;
}

export function probeNextBucket(_el: HTMLElement): boolean {
  return false;
}
