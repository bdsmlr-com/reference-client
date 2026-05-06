import { describe, expect, it } from 'vitest';

import { buildContentRouteLoadState } from '../src/services/content-route-controller.js';

describe('content-route-controller helpers', () => {
  it('builds a fresh content load state with reset navigation when not preserving state', () => {
    expect(buildContentRouteLoadState({
      preserveNavigationState: false,
      infinitePref: true,
      forcePaginated: false,
      currentPage: 4,
      currentSessionId: 'sess-demo',
      currentNavigationMode: 'paginated',
      currentReplaceUrlOnPageBoundary: false,
    })).toEqual({
      currentPage: 1,
      sessionId: '',
      navigationMode: 'infinite',
      replaceUrlOnPageBoundary: true,
      exhausted: false,
      hasNextPage: false,
      stats: { found: 0, deleted: 0, dupes: 0, notFound: 0 },
      resultUnits: [],
      statusMessage: '',
    });
  });

  it('preserves navigation state while still clearing content results', () => {
    expect(buildContentRouteLoadState({
      preserveNavigationState: true,
      infinitePref: true,
      forcePaginated: true,
      currentPage: 3,
      currentSessionId: 'sess-demo',
      currentNavigationMode: 'paginated',
      currentReplaceUrlOnPageBoundary: false,
    })).toEqual({
      currentPage: 3,
      sessionId: 'sess-demo',
      navigationMode: 'paginated',
      replaceUrlOnPageBoundary: false,
      exhausted: false,
      hasNextPage: false,
      stats: { found: 0, deleted: 0, dupes: 0, notFound: 0 },
      resultUnits: [],
      statusMessage: '',
    });
  });
});
