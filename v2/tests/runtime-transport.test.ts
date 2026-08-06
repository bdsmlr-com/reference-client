import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/services/api-error.js';
import { resolveTransportBase } from '../src/services/transport-base.js';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubApiBrowserState(): void {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal('window', {
    location: {
      hostname: 'api-dev.bdsmlr.com',
      origin: 'https://api-dev.bdsmlr.com',
      search: '',
    },
    addEventListener: vi.fn(),
  });
  vi.stubGlobal('navigator', { onLine: true });
}

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

describe('runtime transport API errors', () => {
  it('omits credentials for cacheable anonymous related document reads', async () => {
    stubApiBrowserState();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ posts: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { getRelatedPostsDocument } = await import('../src/services/api.js');
    await getRelatedPostsDocument({
      seed_post_id: 625562977,
      perspective_role: 'reblogger',
      perspective_blog_id: 12,
      displayed_reblog_post_id: 700,
      page_size: 6,
      page_token: 'next',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(init.credentials).toBe('omit');
    expect(new URL(url).searchParams).toEqual(new URLSearchParams({
      seed_post_id: '625562977',
      perspective_role: 'reblogger',
      perspective_blog_id: '12',
      displayed_reblog_post_id: '700',
      page_size: '6',
      page_token: 'next',
    }));
  });

  it('includes credentials only for private viewer related document reads', async () => {
    stubApiBrowserState();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ posts: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { getRelatedPostsDocument } = await import('../src/services/api.js');
    await getRelatedPostsDocument({
      seed_post_id: 625562977,
      perspective_role: 'viewer',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('propagates a caller abort signal through strict related requests', async () => {
    stubApiBrowserState();
    let requestSignal: AbortSignal | undefined;
    let resolveFetch!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn((_url, init) => {
      requestSignal = init?.signal;
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    }));
    const { getRelatedPosts } = await import('../src/services/api.js');
    const controller = new AbortController();
    const request = getRelatedPosts({ seed_post_id: 625562977, perspective_role: 'viewer' }, { signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();

    expect(requestSignal?.aborted).toBe(true);
    resolveFetch({ ok: true, status: 200, headers: new Headers(), json: async () => ({ posts: [] }) } as Response);
    await request.catch(() => undefined);
  });

  it('preserves safe structured fields from a 400 error envelope', async () => {
    stubApiBrowserState();
    const json = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: 'recommendation_perspective_unavailable',
        message: 'Recommendations are unavailable for @bdsmlrstaff because its preference profile has not been indexed yet.',
        retryable: false,
        perspectiveRole: 'viewer',
        blogId: 10372546,
        blogName: 'bdsmlrstaff',
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers(),
      json,
    }));

    const { getRelatedPosts } = await import('../src/services/api.js');
    const error = await getRelatedPosts({
      seed_post_id: 625562977,
      perspective_role: 'viewer',
    }).catch((reason: unknown) => reason as ApiError);

    expect(error).toMatchObject({
      serverCode: 'recommendation_perspective_unavailable',
      message: 'Recommendations are unavailable for @bdsmlrstaff because its preference profile has not been indexed yet.',
      isRetryable: false,
      details: {
        perspectiveRole: 'viewer',
        blogId: 10372546,
        blogName: 'bdsmlrstaff',
      },
    } satisfies Partial<ApiError>);
    expect(json).toHaveBeenCalledTimes(1);
  });

  it('excludes unrecognized flat and nested fields from API error details', async () => {
    stubApiBrowserState();
    const json = vi.fn().mockResolvedValue({
      error: {
        code: 'recommendation_perspective_unavailable',
        message: 'Recommendations are unavailable for this perspective.',
        retryable: false,
        requestId: 'sensitive-request-id',
        upstreamCode: 'UNKNOWN_VIEWER_BLOG_ID',
        details: {
          perspectiveRole: 'legacy',
          blogId: 10372546,
          blogName: 'bdsmlrstaff',
          stack: 'sensitive stack trace',
          databaseKey: 'sensitive-database-key',
        },
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers(),
      json,
    }));

    const { getRelatedPosts } = await import('../src/services/api.js');
    const error = await getRelatedPosts({
      seed_post_id: 625562977,
      perspective_role: 'viewer',
    }).catch((reason: unknown) => reason as ApiError);

    expect(error.details).toEqual({
      perspectiveRole: 'legacy',
      blogId: 10372546,
      blogName: 'bdsmlrstaff',
    });
    expect(error.details).not.toHaveProperty('requestId');
    expect(error.details).not.toHaveProperty('upstreamCode');
    expect(error.details).not.toHaveProperty('stack');
    expect(error.details).not.toHaveProperty('databaseKey');
    expect(json).toHaveBeenCalledTimes(1);
  });

  it('keeps structured-looking errors status-derived for non-opted endpoints', async () => {
    stubApiBrowserState();
    vi.useFakeTimers();
    const json = vi.fn().mockResolvedValue({
      error: {
        code: 'untrusted_server_code',
        message: 'Display this arbitrary server message.',
        retryable: true,
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers(),
      json,
    });
    vi.stubGlobal('fetch', fetchMock);

    const { getForYouPosts } = await import('../src/services/api.js');
    const errorPromise = getForYouPosts({}).catch((reason: unknown) => reason as ApiError);

    await vi.runAllTimersAsync();
    const error = await errorPromise;
    expect(error).toMatchObject({
      code: 'BAD_REQUEST',
      statusCode: 400,
      message: 'HTTP 400',
      isRetryable: false,
      serverCode: undefined,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(json).not.toHaveBeenCalled();
  });

  it('keeps the abort timeout active while consuming a trusted error body', async () => {
    stubApiBrowserState();
    vi.useFakeTimers();
    let firstSignal: AbortSignal | undefined;
    let resolveFirstBody: ((value: unknown) => void) | undefined;
    const firstJson = vi.fn().mockImplementation(() => new Promise((resolve, reject) => {
      resolveFirstBody = resolve;
      firstSignal?.addEventListener('abort', () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    }));
    const fetchMock = vi.fn()
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        firstSignal = init.signal as AbortSignal;
        return Promise.resolve({
          ok: false,
          status: 400,
          headers: new Headers(),
          json: firstJson,
        });
      })
      .mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({
          error: {
            code: 'recommendation_perspective_unavailable',
            message: 'Recommendations are unavailable for this perspective.',
            retryable: false,
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { getRelatedPosts } = await import('../src/services/api.js');
    const errorPromise = getRelatedPosts({
      seed_post_id: 625562977,
      perspective_role: 'viewer',
    }).catch((reason: unknown) => reason as ApiError);

    await vi.advanceTimersByTimeAsync(60_000);
    const wasAbortedDuringBodyRead = firstSignal?.aborted === true;
    if (!wasAbortedDuringBodyRead) {
      resolveFirstBody?.({
        error: {
          code: 'recommendation_perspective_unavailable',
          message: 'Recommendations are unavailable for this perspective.',
          retryable: false,
        },
      });
    }
    await vi.runAllTimersAsync();
    await errorPromise;

    expect(wasAbortedDuringBodyRead).toBe(true);
    expect(firstJson).toHaveBeenCalledTimes(1);
  });

  it('sends roles for strict related requests and omits them for legacy requests', async () => {
    stubApiBrowserState();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({}),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({
          error: {
            code: 'recommendation_perspective_unavailable',
            message: 'Recommendations are unavailable for this legacy perspective.',
            retryable: false,
            perspectiveRole: 'legacy',
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { PostsApi } = await import('../src/services/api.js');
    const posts = new PostsApi();
    await posts.related({
      seed_post_id: 625562977,
      perspective_role: 'reblogger',
      perspective_blog_name: 'ExampleReblogger',
      displayedReblogPostId: 625562977,
    });
    const legacyError = await posts.relatedLegacy({
      seed_post_id: 625562977,
      perspective_blog_name: 'ExampleReblogger',
    }).catch((reason: unknown) => reason as ApiError);

    const strictBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const legacyBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(strictBody).toMatchObject({
      perspective_role: 'reblogger',
      displayed_reblog_post_id: 625562977,
    });
    expect(strictBody).not.toHaveProperty('displayedReblogPostId');
    expect(legacyBody).not.toHaveProperty('perspective_role');
    expect(legacyError).toMatchObject({
      serverCode: 'recommendation_perspective_unavailable',
      message: 'Recommendations are unavailable for this legacy perspective.',
      details: { perspectiveRole: 'legacy' },
    });
  });

  it('preserves a retryable recommendation service error from a 503 envelope', async () => {
    stubApiBrowserState();
    vi.useFakeTimers();
    const json = vi.fn().mockResolvedValue({
      error: {
        code: 'recommendation_service_unavailable',
        message: 'Recommendations are temporarily unavailable. Please try again later.',
        retryable: true,
        perspectiveRole: 'reblogger',
        blogId: 12,
        blogName: 'ExampleReblogger',
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers(),
      json,
    }));

    const { getRelatedPosts } = await import('../src/services/api.js');
    const rejection = getRelatedPosts({
      seed_post_id: 625562977,
      perspective_role: 'reblogger',
    });
    const assertion = expect(rejection).rejects.toMatchObject({
      serverCode: 'recommendation_service_unavailable',
      message: 'Recommendations are temporarily unavailable. Please try again later.',
      isRetryable: true,
      details: {
        perspectiveRole: 'reblogger',
        blogId: 12,
        blogName: 'ExampleReblogger',
      },
    } satisfies Partial<ApiError>);

    await vi.runAllTimersAsync();
    await assertion;
    expect(json).toHaveBeenCalledTimes(4);
  });

  it('falls back to status retryability when retryable is omitted', async () => {
    stubApiBrowserState();
    const json = vi.fn().mockResolvedValue({
      error: {
        code: 'recommendation_perspective_unavailable',
        message: 'Recommendations are not available for @bdsmlrstaff yet.',
        perspectiveRole: 'viewer',
        blogId: 10372546,
        blogName: 'bdsmlrstaff',
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers(),
      json,
    }));

    const { getRelatedPosts } = await import('../src/services/api.js');
    const error = await getRelatedPosts({
      seed_post_id: 625562977,
      perspective_role: 'viewer',
    }).catch((reason: unknown) => reason as ApiError);

    expect(error.isRetryable).toBe(false);
    expect(json).toHaveBeenCalledTimes(1);
  });

  it('falls back to status retryability when retryable is not boolean', async () => {
    stubApiBrowserState();
    vi.useFakeTimers();
    const json = vi.fn().mockResolvedValue({
      error: {
        code: 'recommendation_service_unavailable',
        message: 'Recommendations are temporarily unavailable. Please try again later.',
        retryable: 'yes',
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers(),
      json,
    }));

    const { getRelatedPosts } = await import('../src/services/api.js');
    const rejection = getRelatedPosts({
      seed_post_id: 625562977,
      perspective_role: 'original',
    });
    const assertion = expect(rejection).rejects.toMatchObject({ isRetryable: true });

    await vi.runAllTimersAsync();
    await assertion;
    expect(json).toHaveBeenCalledTimes(4);
  });

  it('keeps status-derived behavior when a failed response contains malformed JSON', async () => {
    stubApiBrowserState();
    const json = vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers(),
      json,
    }));

    const { getRelatedPosts } = await import('../src/services/api.js');
    const error = await getRelatedPosts({
      seed_post_id: 625562977,
      perspective_role: 'original',
    }).catch((reason: unknown) => reason as ApiError);

    expect(error).toMatchObject({
      code: 'BAD_REQUEST',
      statusCode: 400,
      message: 'HTTP 400',
      isRetryable: false,
    });
    expect(json).toHaveBeenCalledTimes(1);
  });

  it('keeps status-derived behavior for a legacy string error payload', async () => {
    stubApiBrowserState();
    const json = vi.fn().mockResolvedValue({ error: 'legacy server message' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers(),
      json,
    }));

    const { getRelatedPosts } = await import('../src/services/api.js');
    const error = await getRelatedPosts({
      seed_post_id: 625562977,
      perspective_role: 'original',
    }).catch((reason: unknown) => reason as ApiError);

    expect(error).toMatchObject({
      code: 'BAD_REQUEST',
      statusCode: 400,
      message: 'HTTP 400',
      isRetryable: false,
    });
    expect(json).toHaveBeenCalledTimes(1);
  });
});
