import { describe, expect, it } from 'vitest';

import { blogIsRestrictedForViewer, getRestrictedEmptyStateMessage } from '../src/services/blog-visibility.js';
import type { Blog } from '../src/types/api.js';

describe('blog visibility helpers', () => {
  it('detects a restricted blog from identity decorations', () => {
    const blog: Blog = {
      id: 10352167,
      name: 'AwesomeMrandMrsGrey',
      identityDecorations: [{ token: 'restricted', label: 'Only approved followers can view' }],
    };

    expect(blogIsRestrictedForViewer(blog)).toBe(true);
    expect(getRestrictedEmptyStateMessage(blog, 'archive')).toBe('This blog is private.');
    expect(getRestrictedEmptyStateMessage(blog, 'activity')).toBe('This blog is private.');
  });

  it('does not treat unrestricted blogs as gated-empty states', () => {
    const blog: Blog = {
      id: 42,
      name: 'public-blog',
      identityDecorations: [{ token: 'moderator', label: 'Moderator' }],
    };

    expect(blogIsRestrictedForViewer(blog)).toBe(false);
    expect(getRestrictedEmptyStateMessage(blog, 'archive')).toBe('');
  });
});
