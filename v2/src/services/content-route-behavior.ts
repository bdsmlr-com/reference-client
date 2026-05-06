import type { ContentNavigationMode } from './search-session.js';

export function shouldObserveContentSentinel(navigationMode: ContentNavigationMode): boolean {
  return navigationMode === 'infinite';
}

export function canLoadMoreContentPage({
  navigationMode,
  loading,
  exhausted,
}: {
  navigationMode: ContentNavigationMode;
  loading: boolean;
  exhausted: boolean;
}): boolean {
  return navigationMode === 'infinite' && !loading && !exhausted;
}

export function shouldSyncContentUrlAfterPageLoad({
  navigationMode,
  replaceUrlOnPageBoundary,
  currentPage,
}: {
  navigationMode: ContentNavigationMode;
  replaceUrlOnPageBoundary: boolean;
  currentPage: number;
}): boolean {
  return navigationMode === 'paginated' || (replaceUrlOnPageBoundary && currentPage > 1);
}

export function getAdjacentContentPageTarget({
  direction,
  currentPage,
  hasNextPage,
  loading,
}: {
  direction: 'previous' | 'next';
  currentPage: number;
  hasNextPage: boolean;
  loading: boolean;
}): number | null {
  if (loading) {
    return null;
  }
  if (direction === 'previous') {
    return currentPage > 1 ? currentPage - 1 : null;
  }
  return hasNextPage ? currentPage + 1 : null;
}
