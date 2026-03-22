import { describe, it, expect } from 'vitest';
import mediaConfig from '../media-config.json';

describe('render contract schema', () => {
  it('defines pages, cards, elements, and interactions', () => {
    const render = (mediaConfig as any).render;
    expect(render).toBeDefined();
    expect(render.pages).toBeDefined();
    expect(render.cards).toBeDefined();
    expect(render.elements).toBeDefined();
    expect(render.interactions).toBeDefined();
  });
});
