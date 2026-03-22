import { describe, it, expect } from 'vitest';
import { resolveBinding } from '../src/services/render-binding';

describe('render binding', () => {
  it('resolves nested paths from model', () => {
    const value = resolveBinding({ post: { id: 42 } }, 'post.id');
    expect(value).toBe(42);
  });

  it('throws for unknown binding path', () => {
    expect(() => resolveBinding({ post: { id: 42 } }, 'post.missing')).toThrowError();
  });
});
