export type SearchNavigationMode = 'infinite' | 'paginated';

function readParamValue(input: string | URLSearchParams | null | undefined, key: string): string {
  if (input instanceof URLSearchParams) {
    return input.get(key) || '';
  }
  return typeof input === 'string' ? input : '';
}

export function parseSearchPageParam(input: string | URLSearchParams | null | undefined): number | undefined {
  const raw = readParamValue(input, 'page').trim();
  if (!raw) {
    return undefined;
  }
  const page = Number.parseInt(raw, 10);
  return Number.isFinite(page) && page > 0 ? page : undefined;
}

export function parseSearchSessionParam(input: string | URLSearchParams | null | undefined): string {
  return readParamValue(input, 'session').trim();
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
  if (page !== undefined || (sessionId || '').trim()) {
    return 'paginated';
  }
  return infinitePref ? 'infinite' : 'paginated';
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
  return navigationMode === 'infinite' && explicitPage === undefined && !(explicitSessionId || '').trim();
}
