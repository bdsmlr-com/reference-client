/**
 * Shared IntersectionObserver that primes <media-renderer> hosts when they
 * enter (or nearly enter) the viewport — so img/video src is not set until then.
 *
 * rootMargin: positive expands the preload zone ahead of the viewport;
 * negative shrinks it (useful for eyeballing deferred vs primed).
 */

type PrimeCallback = () => void;

/** Default margin in px applied to top/bottom of the viewport root. */
export let MEDIA_VIEWPORT_ROOT_MARGIN_PX = 30;

/**
 * When true, media-renderer outlines hosts that are still deferred (not yet primed).
 * Code-only: flip and rebuild — no runtime/localStorage switch.
 */
export let MEDIA_VIEWPORT_PRIME_DEBUG = false;

class MediaViewportPrimeObserver {
  private observer: IntersectionObserver | null = null;
  private callbacks = new WeakMap<Element, PrimeCallback>();
  private observedElements = new Set<Element>();
  private activeRootMarginPx: number | null = null;

  private rootMargin(): string {
    const px = MEDIA_VIEWPORT_ROOT_MARGIN_PX;
    return `${px}px 0px ${px}px 0px`;
  }

  private ensureObserver(): IntersectionObserver | null {
    if (typeof IntersectionObserver === 'undefined') {
      return null;
    }

    if (this.observer && this.activeRootMarginPx === MEDIA_VIEWPORT_ROOT_MARGIN_PX) {
      return this.observer;
    }

    const previous = this.observer;
    const previouslyObserved = [...this.observedElements];
    if (previous) {
      previous.disconnect();
    }

    this.activeRootMarginPx = MEDIA_VIEWPORT_ROOT_MARGIN_PX;
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const callback = this.callbacks.get(entry.target);
          if (!callback) continue;
          // One-shot: once primed, stop watching (keep media loaded off-screen).
          this.unobserve(entry.target);
          callback();
        }
      },
      { root: null, rootMargin: this.rootMargin(), threshold: 0 },
    );

    for (const el of previouslyObserved) {
      this.observer.observe(el);
    }

    return this.observer;
  }

  /**
   * Observe a host until it intersects the (margin-adjusted) viewport, then
   * invoke callback once. If IntersectionObserver is unavailable, callback runs immediately.
   */
  observe(element: Element, callback: PrimeCallback): void {
    const observer = this.ensureObserver();
    if (!observer) {
      callback();
      return;
    }

    this.callbacks.set(element, callback);
    this.observedElements.add(element);
    observer.observe(element);
  }

  unobserve(element: Element): void {
    if (this.observer) {
      this.observer.unobserve(element);
    }
    this.callbacks.delete(element);
    this.observedElements.delete(element);
  }

  /** Rebuild the observer after changing MEDIA_VIEWPORT_ROOT_MARGIN_PX at runtime. */
  refresh(): void {
    if (!this.observer || this.observedElements.size === 0) {
      this.activeRootMarginPx = null;
      return;
    }
    this.ensureObserver();
  }

  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.observedElements.clear();
    this.activeRootMarginPx = null;
  }
}

export const mediaViewportPrime = new MediaViewportPrimeObserver();

export function setMediaViewportRootMarginPx(px: number): void {
  if (!Number.isFinite(px) || px === MEDIA_VIEWPORT_ROOT_MARGIN_PX) return;
  MEDIA_VIEWPORT_ROOT_MARGIN_PX = px;
  mediaViewportPrime.refresh();
}
