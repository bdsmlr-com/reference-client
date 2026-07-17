import type { ProcessedPost } from '../types/post.js';
import { ACTIVE_ENV } from '../config.js';

export function shouldObscureMedia(post: ProcessedPost | null | undefined): boolean {
  if (!post) return false;

  // TEMP DEV HACK — discard before merge. Force redaction on ~half of posts
  // (stable by id so re-renders don't flicker). Dev builds / vite serve only.
  if (
    (ACTIVE_ENV === 'dev' || Boolean(import.meta.env.DEV))
    && typeof post.id === 'number'
    && post.id % 2 === 0
  ) {
    return true;
  }

  if (post.authorization?.media === 'obscured') {
    return true;
  }
  const policy = post._retrievalPolicy;
  if (!policy) return false;
  if (policy.redactionMode === 'pixelated') {
    return true;
  }
  if (policy.imageVariant?.includes('pixelated')) {
    return true;
  }
  return false;
}
