import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEATURE_FLAGS, applyRuntimeConfig, ensureRuntimeConfigLoaded, resetRuntimeConfigForTests } from '../src/config.js';

describe('runtime config', () => {
  afterEach(() => {
    resetRuntimeConfigForTests();
    vi.restoreAllMocks();
  });

  it('overlays runtime media formats and feature flags onto defaults', () => {
    expect(FEATURE_FLAGS.media_format_by_surface?.card).toBe('card');
    expect(FEATURE_FLAGS.use_gif_posters).toBe(false);
    applyRuntimeConfig({
      features: {
        use_gif_posters: true,
        media_format_by_surface: {
          card: 'raw',
          masonry: 'raw',
        },
      },
    });

    expect(FEATURE_FLAGS.use_gif_posters).toBe(true);
    expect(FEATURE_FLAGS.media_format_by_surface?.card).toBe('raw');
    expect(FEATURE_FLAGS.media_format_by_surface?.masonry).toBe('raw');
    expect(FEATURE_FLAGS.media_format_by_surface?.['post-detail']).toBe('raw');
  });

  it('loads runtime config from the app endpoint once', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: {
          media_format_by_surface: {
            card: 'raw',
          },
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
    expect(FEATURE_FLAGS.media_format_by_surface?.card).toBe('raw');
  });
});
