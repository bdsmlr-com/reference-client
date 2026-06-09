import { describe, expect, it } from 'vitest';
import { resolveTransportBase } from '../src/services/transport-base.ts';

describe('anonymous apex transport policy', () => {
  it('pins anonymous apex public-read traffic to api-prod even if env tries to point it at apex', () => {
    const hostileEnv = {
      VITE_API_BASE_URL: '/v2/api',
      VITE_PUBLIC_API_BASE_URL: '/v2/api',
    } as const;

    expect(
      resolveTransportBase('api', {
        hostname: 'bdsmlr.com',
        hasAuthUser: false,
        env: hostileEnv,
      })
    ).toBe('https://api-prod.bdsmlr.com/v2/api');

    expect(
      resolveTransportBase('auth', {
        hostname: 'www.bdsmlr.com',
        hasAuthUser: false,
        env: hostileEnv,
      })
    ).toBe('https://api-prod.bdsmlr.com/v2/api/auth');

    expect(
      resolveTransportBase('recs', {
        hostname: 'bdsmlr.com',
        hasAuthUser: false,
        env: hostileEnv,
      })
    ).toBe('https://api-prod.bdsmlr.com/v2/api/recs');
  });

  it('keeps logged-in and api-host traffic on the private transport base', () => {
    const hostileEnv = {
      VITE_API_BASE_URL: '/v2/api',
      VITE_PUBLIC_API_BASE_URL: '/v2/api',
    } as const;

    expect(
      resolveTransportBase('api', {
        hostname: 'bdsmlr.com',
        hasAuthUser: true,
        env: hostileEnv,
      })
    ).toBe('/v2/api');

    expect(
      resolveTransportBase('auth', {
        hostname: 'api-prod.bdsmlr.com',
        hasAuthUser: false,
        env: hostileEnv,
      })
    ).toBe('/v2/api/auth');
  });
});
