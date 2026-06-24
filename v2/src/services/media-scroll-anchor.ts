/**
 * When a media slot above the viewport shrinks or grows on load, the document
 * shifts under a fixed scroll position. Adjust scrollTop so content already
 * on screen stays put.
 */
export function compensateScrollForAboveViewportResize(options: {
  anchorTop: number;
  heightDelta: number;
  scrollElement?: Element | null;
}): void {
  const { anchorTop, heightDelta, scrollElement } = options;
  if (!heightDelta) return;
  if (anchorTop >= 0) return;

  const target = resolveScrollElement(scrollElement);
  if (target === window) {
    window.scrollBy({ top: heightDelta, left: 0 });
    return;
  }

  (target as Element).scrollTop += heightDelta;
}

function resolveScrollElement(scrollElement?: Element | null): Element | Window {
  if (scrollElement instanceof Element) {
    return scrollElement;
  }
  return window;
}
