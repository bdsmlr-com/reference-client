import {
  describeMediaItemForSurface,
  getMediaItems,
  extractMedia,
  type ProcessedPost,
  type RendererMediaSource,
} from '../types/post.js';

export type LightboxMediaSource = RendererMediaSource;

export function buildLightboxMediaSources(post: ProcessedPost): LightboxMediaSource[] {
  const media = post._media || extractMedia(post);
  const items = getMediaItems(media);

  if (post.deletedAtUnix && media.url) {
    return [{ kind: 'image', src: media.url, forceImage: true }];
  }

  if (items.length > 0) {
    return items
      .map((item) => describeMediaItemForSurface(item, media.representationKind, 'lightbox'))
      .filter((item): item is LightboxMediaSource => !!item && !!item.src);
  }

  const fallback = [media.videoUrl, media.audioUrl, media.url].filter(Boolean) as string[];
  return fallback.map((src) => ({
    kind: media.type === 'audio' ? 'audio' : media.type === 'video' ? 'video' : 'image',
    src,
    posterSrc: media.posterUrl || media.url,
    forceImage: media.type === 'image',
  }));
}
