import { extractMedia, type ProcessedPost } from '../types/post.js';

export function buildLightboxMediaSources(post: ProcessedPost): string[] {
  const media = post._media || extractMedia(post);
  const files = (post.content?.files || []).filter(Boolean);
  const fallback = [media.videoUrl, media.url].filter(Boolean) as string[];

  // Deleted posts can have dead original files but still-valid preview assets.
  if (post.deletedAtUnix && media.url) {
    return [media.url];
  }

  return files.length > 0 ? files : fallback;
}
