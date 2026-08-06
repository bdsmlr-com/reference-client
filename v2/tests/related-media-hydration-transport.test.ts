import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../src/services/api-error.js';

function stubApiBrowserState(): void {
  vi.stubGlobal('window', {
    location: { hostname: 'api-dev.bdsmlr.com', origin: 'https://api-dev.bdsmlr.com', search: '' },
    addEventListener: vi.fn(),
  });
  vi.stubGlobal('document', { cookie: '' });
  vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() });
  vi.stubGlobal('navigator', { onLine: true });
}

describe('related media hydration transport', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('omits credentials and Authorization for anonymous hydration while preserving the AbortSignal', async () => {
    stubApiBrowserState();
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        media: {
          '42:/uploads/42.jpg': {
            original: 'https://media.example/fresh-original',
            preview: 'https://media.example/fresh-preview',
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { hydrateRelatedMedia } = await import('../src/services/api.js');
    const result = await hydrateRelatedMedia(
      { references: [{ postId: 42, path: '/uploads/42.jpg' }] },
      { scope: 'original', signal: controller.signal },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/v2/api/related-media-hydration');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: controller.signal });
    expect(fetchMock.mock.calls[0][1].credentials).toBe('omit');
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      references: [{ postId: 42, path: '/uploads/42.jpg' }],
    });
    expect(result.media['42:/uploads/42.jpg'].original).toContain('fresh-original');
  });

  it('keeps viewer hydration private while allowing credentials', async () => {
    stubApiBrowserState();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ media: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { hydrateRelatedMedia } = await import('../src/services/api.js');
    await hydrateRelatedMedia({ references: [] }, { scope: 'viewer' });

    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('preserves structured hydration errors', async () => {
    stubApiBrowserState();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        error: {
          code: 'invalid_related_media_references',
          message: 'references must contain between 1 and 100 stable post/media references',
          retryable: false,
        },
      }),
    }));

    const { hydrateRelatedMedia } = await import('../src/services/api.js');
    const error = await hydrateRelatedMedia({ references: [] }, { scope: 'reblogger' }).catch((reason: unknown) => reason as ApiError);

    expect(error).toMatchObject({
      serverCode: 'invalid_related_media_references',
      message: 'references must contain between 1 and 100 stable post/media references',
      isRetryable: false,
    });
  });
});
