import { describe, expect, it } from 'vitest';
import { resolveRetrievalClickMode } from '../src/services/retrieval-presentation.js';

describe('retrieval click policy', () => {
  it('defaults to navigation when no policy is present', () => {
    expect(resolveRetrievalClickMode(undefined)).toBe('navigate');
  });

  it('prefers the modal path for canonical gated posts', () => {
    expect(resolveRetrievalClickMode({
      linkAllowed: false,
      clickAction: 'open_modal',
    })).toBe('open_modal');
  });

  it('blocks navigation when linkAllowed is explicitly false', () => {
    expect(resolveRetrievalClickMode({
      linkAllowed: false,
    })).toBe('open_modal');
  });
});
