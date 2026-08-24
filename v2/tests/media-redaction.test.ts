import { describe, expect, it } from 'vitest';
import { isEntitlementRoadblock, REDACT_PRIVATE_POSTS, shouldObscureMedia } from '../src/services/media-redaction.js';
import type { ProcessedPost } from '../src/types/post.js';

describe('media redaction helpers', () => {
  it('keeps private-post overlay off without a config lookup', () => {
    expect(REDACT_PRIVATE_POSTS).toBe(false);
  });

  it('still redacts search-depth teasers while private-post overlay is off', () => {
    const authorized = {
      id: 12,
      authorization: { media: 'obscured', navigation: 'denied', reason: 'entitlement_search_depth' },
    } as ProcessedPost;
    const teaser = { id: null, _media: { type: 'image' } } as ProcessedPost;
    const clear = { id: 15, authorization: { media: 'clear' } } as ProcessedPost;

    expect(isEntitlementRoadblock(authorized)).toBe(true);
    expect(shouldObscureMedia(authorized)).toBe(true);
    expect(isEntitlementRoadblock(teaser)).toBe(true);
    expect(shouldObscureMedia(teaser)).toBe(true);
    expect(shouldObscureMedia(clear)).toBe(false);
    expect(shouldObscureMedia(null)).toBe(false);
  });

  it('does not redact follower-gated or policy-obscured posts while private-post overlay is off', () => {
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
    const policyPixelated = {
      id: 13,
      _retrievalPolicy: { redactionMode: 'pixelated', imageVariant: 'feed-pixelated' },
    } as ProcessedPost;
    const policyObscured = {
      id: 14,
      _retrievalPolicy: { redactionMode: 'obscured', imageVariant: 'feed', treatment: 'access_obscured' },
    } as ProcessedPost;

    expect(isEntitlementRoadblock(gated)).toBe(false);
    expect(shouldObscureMedia(gated)).toBe(false);
    expect(shouldObscureMedia(originGated)).toBe(false);
    expect(shouldObscureMedia(approved)).toBe(false);
    expect(shouldObscureMedia(policyPixelated)).toBe(false);
    expect(shouldObscureMedia(policyObscured)).toBe(false);
  });
});
