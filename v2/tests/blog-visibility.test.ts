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
    expect(getRestrictedEmptyStateMessage(blog, 'archive')).toBe('This archive is follower-only. Follow and get approved to browse these posts.');
    expect(getRestrictedEmptyStateMessage(blog, 'activity')).toBe('This activity is follower-only. Follow and get approved to view it.');
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
