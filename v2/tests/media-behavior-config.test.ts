import { describe, it, expect } from 'vitest';
import mediaConfig from '../media-config.json';

describe('media behavior config', () => {
  it('defines media behavior defaults and gallery autoplay policy', () => {
    const behavior = (mediaConfig as any).media_behavior;
    expect(behavior).toBeDefined();
    expect(behavior.default).toBeDefined();
    expect(behavior['gallery-grid'].autoplay).toBe(true);
    expect(behavior['gallery-masonry'].autoplay).toBe(true);
    expect(behavior.gutter.autoplay).toBe(true);
    expect(behavior['post-detail'].autoplay).toBe(false);
    expect(behavior.lightbox.controls).toBe(true);
  });
});

