import { afterEach, describe, expect, it, vi } from 'vitest';
import mediaConfig from '../media-config.json';
import { FEATURE_FLAGS, applyRuntimeConfig, ensureRuntimeConfigLoaded, resetRuntimeConfigForTests } from '../src/config.js';

describe('runtime config', () => {
  afterEach(() => {
    resetRuntimeConfigForTests();
    vi.restoreAllMocks();
  });

  it('keeps baseline feature flags intact when runtime config omits dead media overrides', () => {
    expect(FEATURE_FLAGS.more_like_this_on_post).toBe(false);
    expect(FEATURE_FLAGS.use_gif_posters).toBe(false);
    applyRuntimeConfig({
      features: {
        more_like_this_on_post: true,
        use_gif_posters: true,
      },
    });

    expect(FEATURE_FLAGS.more_like_this_on_post).toBe(true);
    expect(FEATURE_FLAGS.use_gif_posters).toBe(true);
  });

  it('does not expose or carry media_format_by_surface in frontend runtime config', async () => {
    const { FEATURE_FLAGS } = await import('../src/config.js');
    expect('media_format_by_surface' in FEATURE_FLAGS).toBe(false);
    expect('media_format_by_surface' in ((mediaConfig as any).features || {})).toBe(false);
  });

  it('loads runtime config from the app endpoint once', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: {
          more_like_this_on_post: true,
        },
      }),
    });

    await ensureRuntimeConfigLoaded(fetchMock as unknown as typeof fetch);
    await ensureRuntimeConfigLoaded(fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/v2/runtime-config', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    expect(FEATURE_FLAGS.more_like_this_on_post).toBe(true);
  });
});
