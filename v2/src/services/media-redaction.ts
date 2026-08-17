import type { ProcessedPost } from '../types/post.js';
import type { IdentityDecoration } from '../types/api.js';

export function isEntitlementRoadblock(post: ProcessedPost | null | undefined): boolean {
  if (!post) return false;
  if (post.authorization?.navigation === 'denied') {
    return true;
  }
  return post.id == null;
}

function decorationHasRestrictedToken(decorations: IdentityDecoration[] | null | undefined): boolean {
  return (decorations || []).some((decoration) => String(decoration?.token || '').trim() === 'restricted');
}

export function shouldObscureMedia(post: ProcessedPost | null | undefined): boolean {
  if (!post) return false;

  if (isEntitlementRoadblock(post)) {
    return true;
  }
  if (post.authorization?.media === 'obscured') {
    return true;
  }
  if (
    decorationHasRestrictedToken(post.blogIdentityDecorations)
    || decorationHasRestrictedToken(post.originBlogIdentityDecorations)
  ) {
    return true;
  }
  const policy = post._retrievalPolicy;
  if (!policy) return false;
  if (policy.redactionMode === 'pixelated' || policy.redactionMode === 'obscured') {
    return true;
  }
  if (policy.imageVariant?.includes('pixelated')) {
    return true;
  }
  return false;
}
