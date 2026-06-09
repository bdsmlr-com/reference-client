import { describe, expect, it } from 'vitest';
import { resolveTransportBase } from '../src/services/transport-base.js';

describe('runtime transport base selection', () => {
  it('routes anonymous apex public reads directly to api-prod for api/auth/recs', () => {
    const context = {
      hostname: 'bdsmlr.com',
      hasAuthUser: false,
      env: {},
    };

    expect(resolveTransportBase('api', context)).toBe('https://api-prod.bdsmlr.com/v2/api');
    expect(resolveTransportBase('auth', context)).toBe('https://api-prod.bdsmlr.com/v2/api/auth');
    expect(resolveTransportBase('recs', context)).toBe('https://api-prod.bdsmlr.com/v2/api/recs');
  });

  it('keeps api-* hosts on the local /v2/api namespace', () => {
    const context = {
      hostname: 'api-dev.bdsmlr.com',
      hasAuthUser: false,
      env: {},
    };

    expect(resolveTransportBase('api', context)).toBe('/v2/api');
    expect(resolveTransportBase('auth', context)).toBe('/v2/api/auth');
    expect(resolveTransportBase('recs', context)).toBe('/v2/api/recs');
  });

  it('routes authenticated apex users directly to api-prod for api/auth/recs', () => {
    const context = {
      hostname: 'bdsmlr.com',
      hasAuthUser: true,
      env: {},
    };

    expect(resolveTransportBase('api', context)).toBe('https://api-prod.bdsmlr.com/v2/api');
    expect(resolveTransportBase('auth', context)).toBe('https://api-prod.bdsmlr.com/v2/api/auth');
    expect(resolveTransportBase('recs', context)).toBe('https://api-prod.bdsmlr.com/v2/api/recs');
  });
});
