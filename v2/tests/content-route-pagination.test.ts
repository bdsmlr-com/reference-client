import { describe, expect, it } from 'vitest';

import {
  applyContentPageResponseState,
  mergeContentPageUnits,
  resolveToggledContentNavigationMode,
} from '../src/services/content-route-pagination.js';
import type { SearchResultUnit } from '../src/services/search-result-units.js';

describe('content-route-pagination helpers', () => {
  it('applies shared session/page response state', () => {
    expect(applyContentPageResponseState({
      responseSessionId: 'sess-next',
      currentSessionId: 'sess-current',
      responsePageNumber: 4,
      targetPage: 3,
      hasMore: true,
    })).toEqual({
      sessionId: 'sess-next',
      currentPage: 4,
      hasNextPage: true,
      exhausted: false,
    });
  });

  it('falls back to current session and target page when response metadata is sparse', () => {
    expect(applyContentPageResponseState({
      responseSessionId: '',
      currentSessionId: 'sess-current',
      responsePageNumber: 0,
      targetPage: 3,
      hasMore: false,
    })).toEqual({
      sessionId: 'sess-current',
      currentPage: 3,
      hasNextPage: false,
      exhausted: true,
    });
  });

  it('replaces or appends page units based on navigation mode and page number', () => {
    const existingUnits = [
      { kind: 'post', post: { id: 1 } },
    ] satisfies SearchResultUnit[];
    const newUnits = [
      { kind: 'post', post: { id: 2 } },
    ] satisfies SearchResultUnit[];

    expect(mergeContentPageUnits({
      navigationMode: 'paginated',
      targetPage: 2,
      existingUnits,
      newUnits,
    })).toEqual(newUnits);

    expect(mergeContentPageUnits({
      navigationMode: 'infinite',
      targetPage: 1,
      existingUnits,
      newUnits,
    })).toEqual(newUnits);

    expect(mergeContentPageUnits({
      navigationMode: 'infinite',
      targetPage: 2,
      existingUnits,
      newUnits,
    })).toEqual([...existingUnits, ...newUnits]);
  });

  it('resolves toggled content navigation mode', () => {
    expect(resolveToggledContentNavigationMode({
      infiniteEnabled: true,
      forcedPaginatedFromUrl: false,
    })).toBe('infinite');

    expect(resolveToggledContentNavigationMode({
      infiniteEnabled: false,
      forcedPaginatedFromUrl: false,
    })).toBe('paginated');

    expect(resolveToggledContentNavigationMode({
      infiniteEnabled: true,
      forcedPaginatedFromUrl: true,
    })).toBe('paginated');
  });
});
