import { beforeEach, describe, expect, it } from 'vitest';
import { getTypePreference, setTypePreference } from '../src/services/storage.js';

class MemoryStorage {
  private data = new Map<string, string>();

  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.has(key) ? this.data.get(key) ?? null : null; }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
  removeItem(key: string): void { this.data.delete(key); }
}

describe('post type preference sanitization', () => {
  beforeEach(() => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
    storage.clear();
  });

  it('filters unsupported legacy post type ids when reading and writing preferences', () => {
    localStorage.setItem('bdsmlr_prefs', JSON.stringify({ pagePrefs: { timeline: { postTypes: [1, 2, 7, 8] } } }));

    expect(getTypePreference('timeline')).toEqual([1, 2, 7]);

    setTypePreference([1, 2, 7, 8], 'timeline');

    expect(getTypePreference('timeline')).toEqual([1, 2, 7]);
  });
});
