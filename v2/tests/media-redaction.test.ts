import { describe, expect, it } from 'vitest';
import { isEntitlementRoadblock, shouldObscureMedia } from '../src/services/media-redaction.js';
import type { ProcessedPost } from '../src/types/post.js';

describe('media redaction helpers', () => {
  it('detects obscured posts from authorization and retrieval policy', () => {
    const authorized = {
      id: 12,
      authorization: { media: 'obscured', navigation: 'denied', reason: 'entitlement_search_depth' },
    } as ProcessedPost;
    const policyPixelated = {
      id: 13,
      _retrievalPolicy: { redactionMode: 'pixelated', imageVariant: 'feed-pixelated' },
    } as ProcessedPost;
    const policyObscured = {
      id: 14,
      _retrievalPolicy: { redactionMode: 'obscured', imageVariant: 'feed' },
    } as ProcessedPost;
    const clear = { id: 15, authorization: { media: 'clear' } } as ProcessedPost;

    expect(shouldObscureMedia(authorized)).toBe(true);
    expect(shouldObscureMedia(policyPixelated)).toBe(true);
    expect(shouldObscureMedia(policyObscured)).toBe(true);
    expect(shouldObscureMedia(clear)).toBe(false);
    expect(shouldObscureMedia(null)).toBe(false);
  });

  it('redacts search-depth teasers that had their navigation id stripped', () => {
    const teaser = { id: null, _media: { type: 'image' } } as ProcessedPost;

    expect(isEntitlementRoadblock(teaser)).toBe(true);
    expect(shouldObscureMedia(teaser)).toBe(true);
  });

  it('redacts follower-gated posts from the restricted identity decoration already shown on /post', () => {
    const gated = {
      id: 99,
      blogIdentityDecorations: [{ token: 'restricted', label: 'Only approved followers can view' }],
    } as ProcessedPost;
    const originGated = {
      id: 100,
      originBlogIdentityDecorations: [{ token: 'restricted', icon: '🔒' }],
    } as ProcessedPost;
    const approved = {
      id: 101,
      blogIdentityDecorations: [{ token: 'restricted-allowed', icon: '🔐' }],
    } as ProcessedPost;

    expect(shouldObscureMedia(gated)).toBe(true);
    expect(shouldObscureMedia(originGated)).toBe(true);
    expect(shouldObscureMedia(approved)).toBe(false);
  });
});
