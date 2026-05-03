import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseSearchPageParam,
  parseSearchSessionParam,
  resolveSearchNavigationMode,
  shouldReplaceSearchUrlOnPageChange,
} from '../src/services/search-session.js';

describe('search session navigation helpers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forces paginated mode when url carries session/page state', () => {
    expect(resolveSearchNavigationMode({ infinitePref: true, page: 3, sessionId: '' })).toBe('paginated');
    expect(resolveSearchNavigationMode({ infinitePref: true, page: undefined, sessionId: 'sess-demo' })).toBe('paginated');
    expect(resolveSearchNavigationMode({ infinitePref: true, page: 2, sessionId: 'sess-demo' })).toBe('paginated');
  });

  it('keeps page-one search in infinite mode when no session is present and pref is on', () => {
    expect(resolveSearchNavigationMode({ infinitePref: true, page: 1, sessionId: '' })).toBe('infinite');
  });

  it('uses infinite mode when no explicit page/session state is present and pref is on', () => {
    expect(resolveSearchNavigationMode({ infinitePref: true, page: undefined, sessionId: '' })).toBe('infinite');
    expect(shouldReplaceSearchUrlOnPageChange({
      navigationMode: 'infinite',
      explicitPage: undefined,
      explicitSessionId: '',
    })).toBe(true);
  });

  it('parses page and session url values defensively', () => {
    expect(parseSearchPageParam('4')).toBe(4);
    expect(parseSearchPageParam('0')).toBeUndefined();
    expect(parseSearchPageParam('not-a-number')).toBeUndefined();
    expect(parseSearchSessionParam('sess-demo')).toBe('sess-demo');
    expect(parseSearchSessionParam('   ')).toBe('');
  });

  it('maps explicit session/page search requests onto the route wire aliases', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ posts: [], hasMore: false }),
    }));
    const getItem = vi.fn(() => null);
    const setItem = vi.fn();
    const removeItem = vi.fn();

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem, setItem, removeItem });
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      location: {
        origin: 'https://example.test',
        search: '',
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      history: { replaceState: vi.fn() },
    });

    const { searchPostsByTag } = await import('../src/services/api.js');

    await searchPostsByTag({
      tag_name: 'demo',
      session_id: 'sess-demo',
      page_number: 3,
      page_size: 20,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || '{}'));
    expect(body.session).toBe('sess-demo');
    expect(body.page).toBe(3);
    expect(body.page_size).toBe(20);
    expect(body.session_id).toBeUndefined();
    expect(body.page_number).toBeUndefined();
  });
});
