import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildContentNavigationState,
  buildSharedContentRouteParams,
  parseOpaqueParam,
  parsePositivePageParam,
  parseSearchPageParam,
  parseSearchSessionParam,
  resolveSearchNavigationMode,
  resolveContentNavigationMode,
  shouldReplaceContentUrlOnPageChange,
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

  it('shares route-state resolution across search and archive style boundaries', () => {
    expect(resolveContentNavigationMode({
      infinitePref: true,
      page: 1,
      cursor: '',
      sessionId: '',
      forcePaginated: true,
    })).toBe('paginated');
    expect(resolveContentNavigationMode({
      infinitePref: true,
      page: undefined,
      cursor: 'cursor-2',
      sessionId: '',
    })).toBe('paginated');
    expect(shouldReplaceContentUrlOnPageChange({
      navigationMode: 'infinite',
      explicitPage: undefined,
      explicitCursor: '',
      explicitSessionId: '',
    })).toBe(true);
    expect(shouldReplaceContentUrlOnPageChange({
      navigationMode: 'paginated',
      explicitPage: 1,
      explicitCursor: '',
      explicitSessionId: '',
      forcePaginated: true,
    })).toBe(false);
  });

  it('builds normalized shared navigation state snapshots', () => {
    expect(buildContentNavigationState({
      infinitePref: true,
      page: 3,
      cursor: 'cursor-3',
      sessionId: 'sess-demo',
      forcePaginated: false,
    })).toEqual({
      currentPage: 3,
      currentCursor: 'cursor-3',
      sessionId: 'sess-demo',
      navigationMode: 'paginated',
      replaceUrlOnPageBoundary: false,
    });

    expect(buildContentNavigationState({
      infinitePref: true,
      page: undefined,
      cursor: null,
      sessionId: '',
      forcePaginated: false,
    })).toEqual({
      currentPage: 1,
      currentCursor: null,
      sessionId: '',
      navigationMode: 'infinite',
      replaceUrlOnPageBoundary: true,
    });
  });

  it('parses page and session url values defensively', () => {
    expect(parseSearchPageParam('4')).toBe(4);
    expect(parseSearchPageParam('0')).toBeUndefined();
    expect(parseSearchPageParam('not-a-number')).toBeUndefined();
    expect(parseSearchSessionParam('sess-demo')).toBe('sess-demo');
    expect(parseSearchSessionParam('   ')).toBe('');
    expect(parsePositivePageParam('7')).toBe(7);
    expect(parseOpaqueParam(' cursor-7 ')).toBe('cursor-7');
  });

  it('builds shared content route params for common sort/filter/when controls', () => {
    expect(buildSharedContentRouteParams({
      sortValue: 'newest',
      includeSort: false,
      selectedTypes: [1, 2, 3],
      selectedVariants: [],
      whenValue: '2026-05',
      emptyVariantsToken: 'all',
    })).toEqual({
      sort: '',
      types: 'text,image,video',
      variants: 'all',
      when: '2026-05',
    });
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

  it('maps explicit session/page archive requests onto the route wire aliases', async () => {
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

    const { listBlogPosts } = await import('../src/services/api.js');

    await listBlogPosts({
      blog_id: 123,
      session_id: 'sess-archive',
      page_number: 3,
      page_size: 20,
      activity_kinds: ['post', 'reblog'],
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || '{}'));
    expect(body.blog_id).toBe(123);
    expect(body.session).toBe('sess-archive');
    expect(body.page).toBe(3);
    expect(body.page_size).toBe(20);
    expect(body.session_id).toBeUndefined();
    expect(body.page_number).toBeUndefined();
  });
});
