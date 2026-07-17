// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('media-renderer client redaction', () => {
  it('marks redacted media and still allows video alternates under CSS blur', async () => {
    const { MediaRenderer } = await import('../src/components/media-renderer.js');
    const renderer = new MediaRenderer();
    renderer.src = '/uploads/clear.jpg';
    renderer.alternateVideoSrc = '/uploads/clear.mp4';
    renderer.redacted = true;
    renderer.type = 'card';
    document.body.appendChild(renderer);
    await renderer.updateComplete;

    expect(renderer.hasAttribute('redacted')).toBe(true);
    expect(renderer.shadowRoot?.querySelector('video')).not.toBeNull();
    expect(renderer.shadowRoot?.querySelector('.pixelate-shell')).toBeNull();

    renderer.remove();
  });
});
