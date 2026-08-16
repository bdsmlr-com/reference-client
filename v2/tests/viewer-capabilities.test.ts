// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setAuthUser, clearAuthUser } from '../src/state/auth-state.js';
import { getMe } from '../src/services/auth-service.js';
import { ensureViewerCapabilities, getViewerCapabilities } from '../src/services/viewer-capabilities.js';

vi.mock('../src/services/auth-service.js', () => ({
  getMe: vi.fn(),
}));

afterEach(() => {
  clearAuthUser();
  vi.clearAllMocks();
});

describe('ensureViewerCapabilities', () => {
  it('stores /me capabilities on the auth user and fails closed when /me errors', async () => {

    setAuthUser({
      userId: 7,
      blogId: 42,
      capabilities: [],
    });
    vi.mocked(getMe).mockResolvedValueOnce({
      user_id: 7,
      capabilities: ['use_masonry', 'use_archive_non_newest_sort'],
    });

    await expect(ensureViewerCapabilities()).resolves.toEqual([
      'use_masonry',
      'use_archive_non_newest_sort',
    ]);
    expect(getViewerCapabilities()).toEqual([
      'use_masonry',
      'use_archive_non_newest_sort',
    ]);

    vi.mocked(getMe).mockRejectedValueOnce(new Error('auth request failed: 500'));
    await expect(ensureViewerCapabilities()).resolves.toEqual([
      'use_masonry',
      'use_archive_non_newest_sort',
    ]);
    expect(getMe).toHaveBeenCalledTimes(1);

    clearAuthUser();
    setAuthUser({
      userId: 8,
      blogId: 99,
      capabilities: [],
    });
    vi.mocked(getMe).mockRejectedValueOnce(new Error('auth request failed: 404'));
    await expect(ensureViewerCapabilities()).resolves.toEqual([]);
    expect(getViewerCapabilities()).toEqual([]);
  });
});
