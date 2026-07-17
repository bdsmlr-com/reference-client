// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getRedactionBlurFactor,
  setRedactionBlurFactor,
  shouldObscureMedia,
} from '../src/services/media-redaction.js';
import type { ProcessedPost } from '../src/types/post.js';

describe('media redaction helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--redaction-blur-factor');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--redaction-blur-factor');
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

  it('stores and applies a live redaction blur factor', () => {
    expect(setRedactionBlurFactor(0.5)).toBe(0.5);
    expect(getRedactionBlurFactor()).toBe(0.5);
    expect(localStorage.getItem('redaction-blur-factor')).toBe('0.5');
    expect(document.documentElement.style.getPropertyValue('--redaction-blur-factor')).toBe('0.5');
  });
});
