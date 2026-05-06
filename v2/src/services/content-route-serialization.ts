import { buildSharedContentRouteParams, type ContentNavigationMode } from './search-session.js';
import { serializePostTypesParam, serializeVariantsParam } from './post-filter-url.js';
import type { PostType, PostVariant } from '../types/api.js';

export function buildContentRouteUrlParams({
  query,
  sortValue,
  includeSort = true,
  selectedTypes,
  selectedVariants,
  whenValue = '',
  currentPage,
  navigationMode,
  replaceUrlOnPageBoundary,
  sessionId,
  matchValue = '',
  emptyVariantsToken,
  extraParams = {},
}: {
  query: string;
  sortValue: string;
  includeSort?: boolean;
  selectedTypes: PostType[];
  selectedVariants: PostVariant[];
  whenValue?: string;
  currentPage: number;
  navigationMode: ContentNavigationMode;
  replaceUrlOnPageBoundary: boolean;
  sessionId: string;
  matchValue?: string;
  emptyVariantsToken?: string;
  extraParams?: Record<string, string>;
}): Record<string, string> {
  return {
    q: query,
    ...buildSharedContentRouteParams({
      sortValue,
      includeSort,
      selectedTypes,
      selectedVariants,
      whenValue,
      emptyVariantsToken,
    }),
    page: navigationMode === 'paginated' || (replaceUrlOnPageBoundary && currentPage > 1)
      ? String(currentPage)
      : '',
    session: sessionId || '',
    ...(matchValue ? { match: matchValue } : {}),
    ...extraParams,
  };
}

export function buildContentPaginationSignature({
  query,
  sortValue,
  selectedTypes,
  selectedVariants,
  whenValue = '',
  emptyVariantsToken,
  extra = {},
}: {
  query: string;
  sortValue: string;
  selectedTypes: PostType[];
  selectedVariants: PostVariant[];
  whenValue?: string;
  emptyVariantsToken?: string;
  extra?: Record<string, string>;
}): Record<string, string> {
  return {
    q: query,
    sort: sortValue,
    types: serializePostTypesParam(selectedTypes),
    variants: serializeVariantsParam(
      selectedVariants,
      emptyVariantsToken ? { emptyToken: emptyVariantsToken } : undefined,
    ),
    when: whenValue,
    ...extra,
  };
}
