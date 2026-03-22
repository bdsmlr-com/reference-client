import { describe, it, expect } from 'vitest';
import { getCardSkeletonPlan } from '../src/components/render-card';

describe('render card skeleton', () => {
  it('returns skeleton plan for configured card type', () => {
    const skeleton = getCardSkeletonPlan('post_grid');
    expect(skeleton).toBeDefined();
    expect(skeleton?.variant).toBe('post-card');
  });
});
