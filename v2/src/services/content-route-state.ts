import { getUrlParam } from './blog-resolver.js';
import { getInfiniteScrollPreference } from './storage.js';
import {
  buildContentNavigationState,
  parseSearchPageParam,
  parseSearchSessionParam,
  type ContentNavigationState,
} from './search-session.js';

export interface ContentRouteUrlStateOptions {
  pageName: 'search' | 'archive';
  normalizeWhen: (raw: string) => string;
  forcePaginatedOnWhen?: boolean;
}

export interface ContentRouteUrlState {
  query: string;
  sort: string | null;
  types: string | null;
  variants: string | null;
  when: string;
  infinitePref: boolean;
  forcePaginatedFromUrl: boolean;
  routeState: ContentNavigationState;
}

export function readContentRouteUrlState({
  pageName,
  normalizeWhen,
  forcePaginatedOnWhen = true,
}: ContentRouteUrlStateOptions): ContentRouteUrlState {
  const query = getUrlParam('q');
  const sort = getUrlParam('sort');
  const types = getUrlParam('types');
  const variants = getUrlParam('variants');
  const when = normalizeWhen(getUrlParam('when') || '');
  const explicitPage = parseSearchPageParam(getUrlParam('page'));
  const explicitSessionId = parseSearchSessionParam(getUrlParam('session') || getUrlParam('sessionId'));
  const infinitePref = getInfiniteScrollPreference(pageName);
  const forcePaginatedFromUrl = explicitPage !== undefined || !!explicitSessionId || (!!when && forcePaginatedOnWhen);
  const routeState = buildContentNavigationState({
    infinitePref,
    page: explicitPage ?? (when && forcePaginatedOnWhen ? 1 : undefined),
    sessionId: when && forcePaginatedOnWhen ? '' : explicitSessionId,
    forcePaginated: forcePaginatedFromUrl,
  });

  return {
    query,
    sort,
    types,
    variants,
    when,
    infinitePref,
    forcePaginatedFromUrl,
    routeState,
  };
}

export function resetContentRouteNavigation({
  infinitePref,
  forcePaginated = false,
}: {
  infinitePref: boolean;
  forcePaginated?: boolean;
}): ContentNavigationState {
  return buildContentNavigationState({
    infinitePref,
    page: undefined,
    sessionId: '',
    forcePaginated,
  });
}

export function forcePaginatedContentRouteNavigation(infinitePref: boolean): ContentNavigationState {
  return buildContentNavigationState({
    infinitePref,
    page: 1,
    sessionId: '',
    forcePaginated: true,
  });
}
