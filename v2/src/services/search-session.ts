import { isDefaultTypes } from './blog-resolver.js';
import { serializePostTypesParam, serializeVariantsParam } from './post-filter-url.js';
import type { PostType, PostVariant } from '../types/api.js';

export type SearchNavigationMode = 'infinite' | 'paginated';
export type ContentNavigationMode = SearchNavigationMode;

interface ReadParamOptions {
  key?: string;
}

export interface ContentNavigationState {
  currentPage: number;
  currentCursor: string | null;
  sessionId: string;
  navigationMode: ContentNavigationMode;
  replaceUrlOnPageBoundary: boolean;
}

export interface SharedContentRouteParamsOptions {
  sortValue: string;
  includeSort?: boolean;
  selectedTypes: PostType[];
  selectedVariants: PostVariant[];
  whenValue?: string;
  emptyVariantsToken?: string;
}

function readParamValue(
  input: string | URLSearchParams | null | undefined,
  { key }: ReadParamOptions = {},
): string {
  if (input instanceof URLSearchParams) {
    return key ? input.get(key) || '' : '';
  }
  return typeof input === 'string' ? input : '';
}

export function parsePositivePageParam(
  input: string | URLSearchParams | null | undefined,
  key = 'page',
): number | undefined {
  const raw = readParamValue(input, { key }).trim();
  if (!raw) {
    return undefined;
  }
  const page = Number.parseInt(raw, 10);
  return Number.isFinite(page) && page > 0 ? page : undefined;
}

export function parseOpaqueParam(
  input: string | URLSearchParams | null | undefined,
  key?: string,
): string {
  return readParamValue(input, { key }).trim();
}

export function parseSearchPageParam(input: string | URLSearchParams | null | undefined): number | undefined {
  return parsePositivePageParam(input, 'page');
}

export function parseSearchSessionParam(input: string | URLSearchParams | null | undefined): string {
  return parseOpaqueParam(input, 'session');
}

export function buildContentNavigationState({
  infinitePref,
  page,
  cursor,
  sessionId,
  forcePaginated = false,
}: {
  infinitePref: boolean;
  page?: number;
  cursor?: string | null;
  sessionId?: string;
  forcePaginated?: boolean;
}): ContentNavigationState {
  const normalizedPage = page && page > 0 ? page : 1;
  const normalizedCursor = (cursor || '').trim();
  const normalizedSessionId = (sessionId || '').trim();
  const navigationMode = resolveContentNavigationMode({
    infinitePref,
    page,
    cursor: normalizedCursor,
    sessionId: normalizedSessionId,
    forcePaginated,
  });

  return {
    currentPage: normalizedPage,
    currentCursor: normalizedCursor || null,
    sessionId: normalizedSessionId,
    navigationMode,
    replaceUrlOnPageBoundary: shouldReplaceContentUrlOnPageChange({
      navigationMode,
      explicitPage: page,
      explicitCursor: normalizedCursor,
      explicitSessionId: normalizedSessionId,
      forcePaginated,
    }),
  };
}

export function buildSharedContentRouteParams({
  sortValue,
  includeSort = true,
  selectedTypes,
  selectedVariants,
  whenValue = '',
  emptyVariantsToken,
}: SharedContentRouteParamsOptions): Record<string, string> {
  return {
    sort: includeSort ? sortValue : '',
    types: isDefaultTypes(selectedTypes) ? '' : serializePostTypesParam(selectedTypes),
    variants: serializeVariantsParam(
      selectedVariants,
      emptyVariantsToken ? { emptyToken: emptyVariantsToken } : undefined,
    ),
    when: whenValue,
  };
}

export function resolveContentNavigationMode({
  infinitePref,
  page,
  cursor,
  sessionId,
  forcePaginated = false,
}: {
  infinitePref: boolean;
  page?: number;
  cursor?: string | null;
  sessionId?: string;
  forcePaginated?: boolean;
}): ContentNavigationMode {
  if (forcePaginated) {
    return 'paginated';
  }
  if ((page !== undefined && page > 1) || (cursor || '').trim() || (sessionId || '').trim()) {
    return 'paginated';
  }
  return infinitePref ? 'infinite' : 'paginated';
}

export function resolveSearchNavigationMode({
  infinitePref,
  page,
  sessionId,
}: {
  infinitePref: boolean;
  page?: number;
  sessionId?: string;
}): SearchNavigationMode {
  return resolveContentNavigationMode({ infinitePref, page, sessionId });
}

export function shouldReplaceContentUrlOnPageChange({
  navigationMode,
  explicitPage,
  explicitCursor,
  explicitSessionId,
  forcePaginated = false,
}: {
  navigationMode: ContentNavigationMode;
  explicitPage?: number;
  explicitCursor?: string | null;
  explicitSessionId?: string;
  forcePaginated?: boolean;
}): boolean {
  return (
    navigationMode === 'infinite'
    && !forcePaginated
    && explicitPage === undefined
    && !(explicitCursor || '').trim()
    && !(explicitSessionId || '').trim()
  );
}

export function shouldReplaceSearchUrlOnPageChange({
  navigationMode,
  explicitPage,
  explicitSessionId,
}: {
  navigationMode: SearchNavigationMode;
  explicitPage?: number;
  explicitSessionId?: string;
}): boolean {
  return shouldReplaceContentUrlOnPageChange({
    navigationMode,
    explicitPage,
    explicitSessionId,
  });
}
