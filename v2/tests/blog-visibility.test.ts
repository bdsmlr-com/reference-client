import { afterEach, describe, expect, it, vi } from 'vitest';

import { blogIsRestrictedForViewer, getRestrictedEmptyStateMessage } from '../src/services/blog-visibility.js';
import * as profile from '../src/services/profile.js';
import type { Blog } from '../src/types/api.js';

describe('blog visibility helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    profile.clearProfileState();
  });
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

  it('shows follower-gated detail for logged-in viewers on restricted blogs', () => {
    vi.spyOn(profile, 'isLoggedIn').mockReturnValue(true);
    const blog: Blog = {
      id: 10352167,
      name: 'AwesomeMrandMrsGrey',
      identityDecorations: [{ token: 'restricted', label: 'Only approved followers can view' }],
    };

    expect(getRestrictedEmptyStateMessage(blog, 'archive')).toBe('This blog is follower-only. Follow and get approved to browse these posts.');
    expect(getRestrictedEmptyStateMessage(blog, 'activity')).toBe('This blog is follower-only. Follow and get approved to view this activity.');
  });

  it('treats private blogs from the privacy contract as gated-empty states', () => {
    const blog: Blog = {
      id: 10713028,
      name: 'BDSMBFF',
      privacy: { isPrivate: true },
    };

    expect(blogIsRestrictedForViewer(blog)).toBe(true);
    expect(getRestrictedEmptyStateMessage(blog, 'archive')).toBe('This blog is private.');
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
