/**
 * Shared IntersectionObserver service for infinite scroll functionality.
 *
 * This service provides a singleton IntersectionObserver that can be reused
 * across all paginated pages, reducing resource usage compared to creating
 * a new observer on each page.
 *
 * Usage:
 * ```typescript
 * import { scrollObserver } from '../services/scroll-observer.js';
 *
 * // In connectedCallback or after render:
 * const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
 * if (sentinel) {
 *   scrollObserver.observe(sentinel, () => {
 *     if (this.infiniteScroll && !this.loading && !this.exhausted) {
 *       this.loadMore();
 *     }
 *   });
 * }
 *
 * // In disconnectedCallback:
 * const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
 * if (sentinel) {
 *   scrollObserver.unobserve(sentinel);
 * }
 * ```
 *
 * Resolves: UIC-023 - New IntersectionObserver per page
 */

type ScrollCallback = () => void;

class ScrollObserver {
  private observer: IntersectionObserver | null = null;
  private callbacks = new WeakMap<Element, ScrollCallback>();
  private observedElements = new Set<Element>();

  constructor() {
    // Lazy initialization - observer created on first observe() call
  }

  /**
   * Initialize the IntersectionObserver if not already created.
   * Uses threshold: 0.1 matching the previous per-page implementation.
   */
  private ensureObserver(): IntersectionObserver {
    if (!this.observer) {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const callback = this.callbacks.get(entry.target);
              if (callback) {
                callback();
              }
            }
          }
        },
        { threshold: 0.1 }
      );
    }
    return this.observer;
  }

  /**
   * Observe an element and call the callback when it enters the viewport.
   *
   * @param element - The sentinel element to observe (typically #scroll-sentinel)
   * @param callback - Function to call when element is visible (typically loadMore)
   */
  observe(element: Element, callback: ScrollCallback): void {
    const observer = this.ensureObserver();

    // Store the callback for this element
    this.callbacks.set(element, callback);
    this.observedElements.add(element);

    // Start observing
    observer.observe(element);
  }

  /**
   * Stop observing an element and remove its callback.
   *
   * @param element - The sentinel element to stop observing
   */
  unobserve(element: Element): void {
    if (this.observer) {
      this.observer.unobserve(element);
    }
    this.callbacks.delete(element);
    this.observedElements.delete(element);
  }

  /**
   * Check if an element is currently being observed.
   *
   * @param element - The element to check
   * @returns true if the element is being observed
   */
  isObserving(element: Element): boolean {
    return this.observedElements.has(element);
  }

  /**
   * Get the count of currently observed elements.
   * Useful for debugging and monitoring.
   *
   * @returns Number of elements being observed
   */
  getObservedCount(): number {
    return this.observedElements.size;
  }

  /**
   * Disconnect the observer entirely and clear all callbacks.
   * Typically only called during app teardown.
   */
  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.observedElements.clear();
    // WeakMap entries will be garbage collected automatically
  }

  /**
   * Re-observe an element (useful when the element is recreated in the DOM).
   * Disconnects and reconnects the element with its existing callback.
   *
   * @param element - The sentinel element to re-observe
   */
  reobserve(element: Element): void {
    const callback = this.callbacks.get(element);
    if (callback && this.observer) {
      this.observer.unobserve(element);
      this.observer.observe(element);
    }
  }
}

// Singleton instance
export const scrollObserver = new ScrollObserver();

// Also export the class for testing purposes
export { ScrollObserver };
