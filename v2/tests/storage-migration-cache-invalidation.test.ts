import { beforeEach, describe, expect, it } from 'vitest';
import { initStorage } from '../src/services/storage.js';

class MemoryStorage {
  private data = new Map<string, string>();

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key) ?? null : null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe('storage migration cache invalidation', () => {
  beforeEach(() => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
    storage.clear();
  });

  it('clears stale content caches when migrating to version 2', () => {
    localStorage.setItem('bdsmlr_storage_version', '1');
    localStorage.setItem('bdsmlr_swr_cache', '{"demo":1}');
    localStorage.setItem('bdsmlr_response_cache', '{"demo":1}');
    localStorage.setItem('bdsmlr_search_cache', '{"demo":1}');
    localStorage.setItem('bdsmlr_post_cache', '{"demo":1}');
    localStorage.setItem('bdsmlr_pagination_cursor_cache', '{"demo":1}');
    localStorage.setItem('bdsmlr_post_buffer', '{"demo":1}');
    localStorage.setItem('bdsmlr_blog_cache', '{"keep":1}');

    initStorage();

    expect(localStorage.getItem('bdsmlr_storage_version')).toBe('2');
    expect(localStorage.getItem('bdsmlr_swr_cache')).toBeNull();
    expect(localStorage.getItem('bdsmlr_response_cache')).toBeNull();
    expect(localStorage.getItem('bdsmlr_search_cache')).toBeNull();
    expect(localStorage.getItem('bdsmlr_post_cache')).toBeNull();
    expect(localStorage.getItem('bdsmlr_pagination_cursor_cache')).toBeNull();
    expect(localStorage.getItem('bdsmlr_post_buffer')).toBeNull();
    expect(localStorage.getItem('bdsmlr_blog_cache')).toBe('{"keep":1}');
  });
});
