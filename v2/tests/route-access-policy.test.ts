import { describe, it, expect } from 'vitest';

import { isAnonymousReadableRoute } from '../src/services/route-access-policy.js';

describe('route access policy', () => {
  it('allows anonymous reads only on canonical public blog and post routes', () => {
    expect(isAnonymousReadableRoute('/blog/teas-and-denial')).toBe(true);
    expect(isAnonymousReadableRoute('/blog/you')).toBe(true);
    expect(isAnonymousReadableRoute('/post/552557503')).toBe(true);
    expect(isAnonymousReadableRoute('/post/552557503/')).toBe(true);

    expect(isAnonymousReadableRoute('/')).toBe(false);
    expect(isAnonymousReadableRoute('/activity/teas-and-denial')).toBe(false);
    expect(isAnonymousReadableRoute('/archive/teas-and-denial')).toBe(false);
    expect(isAnonymousReadableRoute('/search')).toBe(false);
    expect(isAnonymousReadableRoute('/post/552557503/related')).toBe(false);
    expect(isAnonymousReadableRoute('/social/teas-and-denial')).toBe(false);
  });
});
