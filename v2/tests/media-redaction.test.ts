import { describe, expect, it } from 'vitest';
import {
  computePixelBlockCount,
  OBSCURE_PIXEL_BLOCK_PX,
  shouldObscureMedia,
} from '../src/services/media-redaction.js';
import type { ProcessedPost } from '../src/types/post.js';

describe('media redaction helpers', () => {
  it('targets roughly 12px mosaic cells relative to container width', () => {
    expect(computePixelBlockCount(300)).toBe(25);
    expect(computePixelBlockCount(300, OBSCURE_PIXEL_BLOCK_PX)).toBe(25);
    expect(computePixelBlockCount(0)).toBe(24);
  });

  it('detects obscured posts from authorization and retrieval policy', () => {
    const authorized = {
      authorization: { media: 'obscured', navigation: 'denied', reason: 'entitlement_search_depth' },
    } as ProcessedPost;
    const policyPixelated = {
      _retrievalPolicy: { redactionMode: 'pixelated', imageVariant: 'feed-pixelated' },
    } as ProcessedPost;
    const clear = { authorization: { media: 'clear' } } as ProcessedPost;

    expect(shouldObscureMedia(authorized)).toBe(true);
    expect(shouldObscureMedia(policyPixelated)).toBe(true);
    expect(shouldObscureMedia(clear)).toBe(false);
    expect(shouldObscureMedia(null)).toBe(false);
  });
});
