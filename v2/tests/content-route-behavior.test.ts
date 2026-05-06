import { describe, expect, it } from 'vitest';

import {
  canLoadMoreContentPage,
  getAdjacentContentPageTarget,
  shouldObserveContentSentinel,
  shouldSyncContentUrlAfterPageLoad,
} from '../src/services/content-route-behavior.js';

describe('content-route-behavior helpers', () => {
  it('decides whether content routes should observe the infinite sentinel', () => {
    expect(shouldObserveContentSentinel('infinite')).toBe(true);
    expect(shouldObserveContentSentinel('paginated')).toBe(false);
  });

  it('decides whether content routes can load more', () => {
    expect(canLoadMoreContentPage({
      navigationMode: 'infinite',
      loading: false,
      exhausted: false,
    })).toBe(true);

    expect(canLoadMoreContentPage({
      navigationMode: 'paginated',
      loading: false,
      exhausted: false,
    })).toBe(false);

    expect(canLoadMoreContentPage({
      navigationMode: 'infinite',
      loading: true,
      exhausted: false,
    })).toBe(false);

    expect(canLoadMoreContentPage({
      navigationMode: 'infinite',
      loading: false,
      exhausted: true,
    })).toBe(false);
  });

  it('decides when content routes should sync page state back into the URL', () => {
    expect(shouldSyncContentUrlAfterPageLoad({
      navigationMode: 'paginated',
      replaceUrlOnPageBoundary: false,
      currentPage: 1,
    })).toBe(true);

    expect(shouldSyncContentUrlAfterPageLoad({
      navigationMode: 'infinite',
      replaceUrlOnPageBoundary: true,
      currentPage: 2,
    })).toBe(true);

    expect(shouldSyncContentUrlAfterPageLoad({
      navigationMode: 'infinite',
      replaceUrlOnPageBoundary: true,
      currentPage: 1,
    })).toBe(false);
  });

  it('resolves adjacent page targets for previous and next navigation', () => {
    expect(getAdjacentContentPageTarget({
      direction: 'previous',
      currentPage: 3,
      hasNextPage: true,
      loading: false,
    })).toBe(2);

    expect(getAdjacentContentPageTarget({
      direction: 'previous',
      currentPage: 1,
      hasNextPage: true,
      loading: false,
    })).toBeNull();

    expect(getAdjacentContentPageTarget({
      direction: 'next',
      currentPage: 3,
      hasNextPage: true,
      loading: false,
    })).toBe(4);

    expect(getAdjacentContentPageTarget({
      direction: 'next',
      currentPage: 3,
      hasNextPage: false,
      loading: false,
    })).toBeNull();

    expect(getAdjacentContentPageTarget({
      direction: 'next',
      currentPage: 3,
      hasNextPage: true,
      loading: true,
    })).toBeNull();
  });
});
