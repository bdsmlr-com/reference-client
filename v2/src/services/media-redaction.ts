import type { ProcessedPost } from '../types/post.js';

export function shouldObscureMedia(post: ProcessedPost | null | undefined): boolean {
  if (!post) return false;

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
