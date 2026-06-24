import { describe, expect, it, vi } from 'vitest';
import { compensateScrollForAboveViewportResize } from '../src/services/media-scroll-anchor.js';

describe('compensateScrollForAboveViewportResize', () => {
  it('adjusts window scroll when the resized media slot is above the viewport', () => {
    const scrollBy = vi.fn();
    vi.stubGlobal('window', { scrollBy });

    compensateScrollForAboveViewportResize({ anchorTop: -120, heightDelta: -80 });

    expect(scrollBy).toHaveBeenCalledWith({ top: -80, left: 0 });
  });

  it('does not adjust scroll when the media slot is still visible at the top edge', () => {
    const scrollBy = vi.fn();
    vi.stubGlobal('window', { scrollBy });

    compensateScrollForAboveViewportResize({ anchorTop: 12, heightDelta: -80 });

    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('does not adjust scroll when height is unchanged', () => {
    const scrollBy = vi.fn();
    vi.stubGlobal('window', { scrollBy });

    compensateScrollForAboveViewportResize({ anchorTop: -40, heightDelta: 0 });

    expect(scrollBy).not.toHaveBeenCalled();
  });
});
