import type { SearchResultUnit } from './search-result-units.js';
import type { ContentNavigationMode } from './search-session.js';

export interface AppliedContentPageResponseState {
  sessionId: string;
  currentPage: number;
  hasNextPage: boolean;
  exhausted: boolean;
}

export function applyContentPageResponseState({
  responseSessionId,
  currentSessionId,
  responsePageNumber,
  targetPage,
  hasMore,
}: {
  responseSessionId?: string | null;
  currentSessionId: string;
  responsePageNumber?: number | null;
  targetPage: number;
  hasMore?: boolean;
}): AppliedContentPageResponseState {
  return {
    sessionId: responseSessionId || currentSessionId,
    currentPage: responsePageNumber || targetPage,
    hasNextPage: !!hasMore,
    exhausted: !hasMore,
  };
}

export function mergeContentPageUnits({
  navigationMode,
  targetPage,
  existingUnits,
  newUnits,
}: {
  navigationMode: ContentNavigationMode;
  targetPage: number;
  existingUnits: SearchResultUnit[];
  newUnits: SearchResultUnit[];
}): SearchResultUnit[] {
  if (navigationMode === 'paginated' || targetPage === 1) {
    return newUnits;
  }
  return [...existingUnits, ...newUnits];
}

export function resolveToggledContentNavigationMode({
  infiniteEnabled,
  forcedPaginatedFromUrl,
}: {
  infiniteEnabled: boolean;
  forcedPaginatedFromUrl: boolean;
}): ContentNavigationMode {
  if (forcedPaginatedFromUrl) {
    return 'paginated';
  }
  return infiniteEnabled ? 'infinite' : 'paginated';
}
