import type { ProcessedPost } from '../types/post.js';

/** Target visible mosaic cell size in CSS pixels once the image is laid out. */
export const OBSCURE_PIXEL_BLOCK_PX = 12;

const MIN_PIXEL_BLOCKS = 8;
const MAX_PIXEL_BLOCKS = 64;

export function computePixelBlockCount(containerWidthPx: number, blockPx = OBSCURE_PIXEL_BLOCK_PX): number {
  if (!Number.isFinite(containerWidthPx) || containerWidthPx <= 0) {
    return 24;
  }
  const blocks = Math.round(containerWidthPx / blockPx);
  return Math.max(MIN_PIXEL_BLOCKS, Math.min(MAX_PIXEL_BLOCKS, blocks));
}

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
