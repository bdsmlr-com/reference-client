import type { ProcessedPost } from '../types/post.js';
import type { IdentityDecoration } from '../types/api.js';

/**
 * Client overlay for follower-gated / "pseudo-private" posts (🔒 restricted,
 * access_obscured retrieval policy, etc). Search-depth teasers are unaffected.
 *
 * Flip to true to restore that overlay without touching teaser/modal redaction.
 */
export const REDACT_PRIVATE_POSTS = false;

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

function hasPrivatePostRedactionSignal(post: ProcessedPost): boolean {
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

export function shouldObscureMedia(post: ProcessedPost | null | undefined): boolean {
  if (!post) return false;

  if (isEntitlementRoadblock(post)) {
    return true;
  }
  if (!REDACT_PRIVATE_POSTS) {
    return false;
  }
  return hasPrivatePostRedactionSignal(post);
}
