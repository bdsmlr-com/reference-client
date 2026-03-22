import { describe, it, expect } from 'vitest';
import { buildInteractionHandler } from '../src/services/render-interactions';

describe('render interactions', () => {
  it('builds navigate handler with link context', () => {
    const handler = buildInteractionHandler({ type: 'navigate', linkContext: 'post_permalink' } as any);
    expect(typeof handler).toBe('function');
  });

  it('builds emit_event handler', () => {
    const handler = buildInteractionHandler({ type: 'emit_event', eventName: 'post-click' } as any);
    expect(typeof handler).toBe('function');
  });
});
