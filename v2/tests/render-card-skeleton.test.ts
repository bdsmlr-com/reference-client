import { describe, it, expect } from 'vitest';
import { getCardSkeletonPlan, getCardRegionOrder } from '../src/components/render-card';

describe('render card skeleton', () => {
  it('returns skeleton plan for configured card type', () => {
    const skeleton = getCardSkeletonPlan('post_grid');
    expect(skeleton).toBeDefined();
    expect(skeleton?.variant).toBe('post-card');
  });

  it('resolves region order by mode override', () => {
    expect(getCardRegionOrder('post_grid', 'regular')).toEqual(['media', 'meta']);
    expect(getCardRegionOrder('post_grid', 'admin')).toEqual(['header', 'badges', 'media', 'meta', 'actions']);
  });
});
