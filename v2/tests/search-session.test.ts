import { describe, expect, it } from 'vitest';
import {
  parseSearchPageParam,
  parseSearchSessionParam,
  resolveSearchNavigationMode,
  shouldReplaceSearchUrlOnPageChange,
} from '../src/services/search-session.js';

describe('search session navigation helpers', () => {
  it('forces paginated mode when url carries session/page state', () => {
    expect(resolveSearchNavigationMode({ infinitePref: true, page: 3, sessionId: '' })).toBe('paginated');
    expect(resolveSearchNavigationMode({ infinitePref: true, page: undefined, sessionId: 'sess-demo' })).toBe('paginated');
    expect(resolveSearchNavigationMode({ infinitePref: true, page: 1, sessionId: 'sess-demo' })).toBe('paginated');
  });

  it('uses infinite mode when no explicit page/session state is present and pref is on', () => {
    expect(resolveSearchNavigationMode({ infinitePref: true, page: undefined, sessionId: '' })).toBe('infinite');
    expect(shouldReplaceSearchUrlOnPageChange({
      navigationMode: 'infinite',
      explicitPage: undefined,
      explicitSessionId: '',
    })).toBe(true);
  });

  it('parses page and session url values defensively', () => {
    expect(parseSearchPageParam('4')).toBe(4);
    expect(parseSearchPageParam('0')).toBeUndefined();
    expect(parseSearchPageParam('not-a-number')).toBeUndefined();
    expect(parseSearchSessionParam('sess-demo')).toBe('sess-demo');
    expect(parseSearchSessionParam('   ')).toBe('');
  });
});
