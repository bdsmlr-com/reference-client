import { describe, it, expect } from 'vitest';
import mediaConfig from '../media-config.json';

describe('media behavior config', () => {
  it('defines canonical media behavior defaults', () => {
    const behavior = (mediaConfig as any).media_behavior;
    expect(behavior).toBeDefined();
    expect(behavior.default).toBeDefined();
    expect(behavior.card.autoplay).toBe(true);
    expect(behavior.masonry.autoplay).toBe(true);
    expect(behavior.detail.autoplay).toBe(true);
    expect(behavior.detail.controls).toBe(true);
    expect(behavior.poster.autoplay).toBe(false);
  });
});
