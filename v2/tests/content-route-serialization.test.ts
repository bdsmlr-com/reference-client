import { describe, expect, it } from 'vitest';

import {
  buildContentPaginationSignature,
  buildContentRouteUrlParams,
} from '../src/services/content-route-serialization.js';

describe('content-route-serialization helpers', () => {
  it('builds canonical content route URL params', () => {
    expect(buildContentRouteUrlParams({
      query: 'tag:latex',
      sortValue: 'popular',
      includeSort: true,
      selectedTypes: [2, 3],
      selectedVariants: [1],
      whenValue: '2026-05',
      currentPage: 2,
      navigationMode: 'paginated',
      replaceUrlOnPageBoundary: false,
      sessionId: 'sess-demo',
      matchValue: 'soft',
      emptyVariantsToken: 'all',
      extraParams: { blog: 'demo-blog' },
    })).toEqual({
      q: 'tag:latex',
      sort: 'popular',
      types: 'image,video',
      variants: 'original',
      when: '2026-05',
      page: '2',
      session: 'sess-demo',
      match: 'soft',
      blog: 'demo-blog',
    });
  });

  it('omits page and session for unpaged infinite route state', () => {
    expect(buildContentRouteUrlParams({
      query: '',
      sortValue: 'newest',
      includeSort: false,
      selectedTypes: [1, 2, 3, 4, 5, 6, 7],
      selectedVariants: [],
      whenValue: '',
      currentPage: 1,
      navigationMode: 'infinite',
      replaceUrlOnPageBoundary: false,
      sessionId: '',
    })).toEqual({
      q: '',
      sort: '',
      types: '',
      variants: '',
      when: '',
      page: '',
      session: '',
    });
  });

  it('builds canonical pagination signatures', () => {
    expect(buildContentPaginationSignature({
      query: 'tag:latex',
      sortValue: 'popular',
      selectedTypes: [2, 3],
      selectedVariants: [1],
      whenValue: '2026-05',
      extra: { blog: 'demo-blog' },
    })).toEqual({
      q: 'tag:latex',
      sort: 'popular',
      types: 'image,video',
      variants: 'original',
      when: '2026-05',
      blog: 'demo-blog',
    });
  });
});
