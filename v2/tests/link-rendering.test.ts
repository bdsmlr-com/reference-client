import { describe, it, expect } from 'vitest';
import { resolveLink } from '../src/services/link-resolver';

describe('link rendering contract', () => {
  it('renders context label/title/icon templates from media-config link contexts', () => {
    const permalink = resolveLink('post_permalink', { postId: 49369194 });
    expect(permalink.href).toBe('/post/49369194');
    expect(permalink.label).toBe('49369194');
    expect(permalink.icon).toBe('↗');
    expect(permalink.title).toBe('Open post 49369194');

    const tag = resolveLink('search_tag', { tag: 'ffm' });
    expect(tag.href).toBe('/search?q=ffm');
    expect(tag.label).toBe('#ffm');
    expect(tag.title).toBe('Search for #ffm');
  });
});
