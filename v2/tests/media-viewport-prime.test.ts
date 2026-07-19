// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('media-viewport-prime', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('invokes callback immediately when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { mediaViewportPrime } = await import('../src/services/media-viewport-prime.js');
    const el = document.createElement('div');
    const cb = vi.fn();
    mediaViewportPrime.observe(el, cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('primes once when the observed element intersects', async () => {
    let observerCallback: IntersectionObserverCallback | null = null;
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();

    class MockIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        observerCallback = cb;
      }
      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
      takeRecords() { return []; }
      root = null;
      rootMargin = '';
      thresholds = [0];
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    const { mediaViewportPrime, MEDIA_VIEWPORT_ROOT_MARGIN_PX } = await import('../src/services/media-viewport-prime.js');
    expect(MEDIA_VIEWPORT_ROOT_MARGIN_PX).toBe(30);

    const el = document.createElement('div');
    const cb = vi.fn();
    mediaViewportPrime.observe(el, cb);
    expect(observe).toHaveBeenCalledWith(el);
    expect(cb).not.toHaveBeenCalled();

    observerCallback?.(
      [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(cb).toHaveBeenCalledTimes(1);
    expect(unobserve).toHaveBeenCalledWith(el);

    // Second intersect should not re-fire (unobserved / callback cleared).
    observerCallback?.(
      [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('media-renderer viewport priming', () => {
  let observerCallback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
    observerCallback = null;
    const observe = vi.fn();
    const unobserve = vi.fn();

    class MockIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        observerCallback = cb;
      }
      observe = observe;
      unobserve = unobserve;
      disconnect = vi.fn();
      takeRecords() { return []; }
      root = null;
      rootMargin = '';
      thresholds = [0];
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.body.replaceChildren();
  });

  it('defers media DOM until primed; debug outline marks deferred hosts', async () => {
    const { MediaRenderer } = await import('../src/components/media-renderer.js');
    const renderer = new MediaRenderer();
    renderer.src = '/uploads/clear.jpg';
    renderer.type = 'feed';
    document.body.appendChild(renderer);
    await renderer.updateComplete;

    expect(renderer.primed).toBe(false);
    expect(renderer.hasAttribute('prime-debug')).toBe(false);
    expect(renderer.hasAttribute('primed')).toBe(false);
    expect(renderer.shadowRoot?.querySelector('img')).toBeNull();
    expect(renderer.shadowRoot?.querySelector('video')).toBeNull();

    observerCallback?.(
      [{ isIntersecting: true, target: renderer } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await renderer.updateComplete;

    expect(renderer.primed).toBe(true);
    expect(renderer.hasAttribute('primed')).toBe(true);
    expect(renderer.shadowRoot?.querySelector('img')).not.toBeNull();

    renderer.remove();
  });
});
