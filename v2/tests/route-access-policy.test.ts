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

  it('allows anonymous related post routes only when more-like-this is enabled', () => {
    const enabled = { moreLikeThisOnPost: true };
    const disabled = { moreLikeThisOnPost: false };

    expect(isAnonymousReadableRoute('/post/552557503/related', disabled)).toBe(false);
    expect(isAnonymousReadableRoute('/post/552557503/related/for/you', disabled)).toBe(false);
    expect(isAnonymousReadableRoute('/post/552557503/related/for/teas-and-denial', disabled)).toBe(false);

    expect(isAnonymousReadableRoute('/post/552557503/related', enabled)).toBe(true);
    expect(isAnonymousReadableRoute('/post/552557503/related/for/you', enabled)).toBe(true);
    expect(isAnonymousReadableRoute('/post/552557503/related/for/teas-and-denial', enabled)).toBe(true);

    expect(isAnonymousReadableRoute('/post/552557503/comments', enabled)).toBe(false);
    expect(isAnonymousReadableRoute('/post/552557503/related/extra', enabled)).toBe(false);
  });
});
