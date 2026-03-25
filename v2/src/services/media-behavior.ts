import { MEDIA_BEHAVIOR, type MediaBehavior } from '../config.js';
import type { MediaRenderType } from './media-resolver.js';

const FALLBACK_BEHAVIOR: MediaBehavior = {
  autoplay: false,
  controls: false,
  loop: true,
  preload: 'none',
};

export function getMediaBehavior(type: MediaRenderType): MediaBehavior {
  return MEDIA_BEHAVIOR[type] || MEDIA_BEHAVIOR.default || FALLBACK_BEHAVIOR;
}

