// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import {
  AUTH_STATUS_TTL_MS,
  clearAuthStatusCache,
  peekAuthStatusCache,
  writeAuthStatusCache,
} from '../src/services/auth-status-cache.js';
import type { AuthStatus } from '../src/services/auth-service.js';

const sampleStatus = (userId = 42): AuthStatus => ({
  user_id: userId,
  blog_id: 7,
  blog_name: 'tester',
  username: 'tester',
  blogs: [{ id: 7, name: 'tester' }],
  primary_blog_id: 7,
  capabilities: [],
});

afterEach(() => {
  clearAuthStatusCache();
});

describe('auth status cache', () => {
  it('round-trips a fresh snapshot', () => {
    writeAuthStatusCache(sampleStatus());
    expect(peekAuthStatusCache()?.user_id).toBe(42);
  });

  it('returns null after TTL expiry', () => {
    const now = 1_700_000_000_000;
    writeAuthStatusCache(sampleStatus(), now);
    expect(peekAuthStatusCache(now + AUTH_STATUS_TTL_MS + 1)).toBeNull();
  });

  it('clearAuthStatusCache drops the snapshot', () => {
    writeAuthStatusCache(sampleStatus());
    clearAuthStatusCache();
    expect(peekAuthStatusCache()).toBeNull();
  });

  it('ignores corrupt storage payloads', () => {
    localStorage.setItem('bdsmlr_auth_status_v1', '{not-json');
    expect(peekAuthStatusCache()).toBeNull();
  });
});
