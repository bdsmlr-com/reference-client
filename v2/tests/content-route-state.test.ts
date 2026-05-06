import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/blog-resolver.js', () => ({
  getUrlParam: vi.fn((key: string) => {
    const values: Record<string, string | null> = {
      q: 'tag:latex',
      sort: 'popular',
      types: 'image,video',
      variants: 'all',
      when: '2026-05',
      page: '3',
      session: 'sess-demo',
      sessionId: null,
    };
    return values[key] ?? null;
  }),
}));

vi.mock('../src/services/storage.js', () => ({
  getInfiniteScrollPreference: vi.fn(() => true),
}));

import {
  forcePaginatedContentRouteNavigation,
  readContentRouteUrlState,
  resetContentRouteNavigation,
} from '../src/services/content-route-state.js';

describe('content-route-state helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads shared content route state from URL params', () => {
    const state = readContentRouteUrlState({
      pageName: 'search',
      normalizeWhen: (raw) => raw,
      forcePaginatedOnWhen: true,
    });

    expect(state.query).toBe('tag:latex');
    expect(state.sort).toBe('popular');
    expect(state.when).toBe('2026-05');
    expect(state.forcePaginatedFromUrl).toBe(true);
    expect(state.routeState.currentPage).toBe(3);
    expect(state.routeState.sessionId).toBe('');
    expect(state.routeState.navigationMode).toBe('paginated');
  });

  it('resets fresh content navigation without preserving session state', () => {
    const state = resetContentRouteNavigation({ infinitePref: true });

    expect(state.currentPage).toBe(1);
    expect(state.sessionId).toBe('');
    expect(state.navigationMode).toBe('infinite');
  });

  it('forces paginated content navigation for explicit constrained views', () => {
    const state = forcePaginatedContentRouteNavigation(true);

    expect(state.currentPage).toBe(1);
    expect(state.sessionId).toBe('');
    expect(state.navigationMode).toBe('paginated');
  });
});
