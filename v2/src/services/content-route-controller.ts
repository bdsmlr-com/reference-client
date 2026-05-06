import type { SearchResultUnit } from './search-result-units.js';
import type { ContentNavigationMode } from './search-session.js';
import type { ViewStats } from '../types/post.js';
import { resetContentRouteNavigation } from './content-route-state.js';

export interface ContentRouteLoadState {
  currentPage: number;
  sessionId: string;
  navigationMode: ContentNavigationMode;
  replaceUrlOnPageBoundary: boolean;
  exhausted: boolean;
  hasNextPage: boolean;
  stats: ViewStats;
  resultUnits: SearchResultUnit[];
  statusMessage: string;
}

export function buildContentRouteLoadState({
  preserveNavigationState,
  infinitePref,
  forcePaginated = false,
  currentPage,
  currentSessionId,
  currentNavigationMode,
  currentReplaceUrlOnPageBoundary,
}: {
  preserveNavigationState: boolean;
  infinitePref: boolean;
  forcePaginated?: boolean;
  currentPage: number;
  currentSessionId: string;
  currentNavigationMode: ContentNavigationMode;
  currentReplaceUrlOnPageBoundary: boolean;
}): ContentRouteLoadState {
  const routeState = preserveNavigationState
    ? {
        currentPage,
        sessionId: currentSessionId,
        navigationMode: currentNavigationMode,
        replaceUrlOnPageBoundary: currentReplaceUrlOnPageBoundary,
      }
    : resetContentRouteNavigation({
        infinitePref,
        forcePaginated,
      });

  return {
    currentPage: routeState.currentPage,
    sessionId: routeState.sessionId,
    navigationMode: routeState.navigationMode,
    replaceUrlOnPageBoundary: routeState.replaceUrlOnPageBoundary,
    exhausted: false,
    hasNextPage: false,
    stats: { found: 0, deleted: 0, dupes: 0, notFound: 0 },
    resultUnits: [],
    statusMessage: '',
  };
}
