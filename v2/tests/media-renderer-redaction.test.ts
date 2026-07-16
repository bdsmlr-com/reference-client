// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('media-renderer client redaction', () => {
  it('renders obscured media through the pixelation shell and skips video alternates', async () => {
    const { MediaRenderer } = await import('../src/components/media-renderer.js');
    const renderer = new MediaRenderer();
    renderer.src = '/uploads/clear.jpg';
    renderer.alternateVideoSrc = '/uploads/clear.mp4';
    renderer.redacted = true;
    renderer.type = 'card';
    document.body.appendChild(renderer);
    await renderer.updateComplete;

    expect(renderer.shadowRoot?.querySelector('.pixelate-shell')).not.toBeNull();
    expect(renderer.shadowRoot?.querySelector('video')).toBeNull();
    expect(renderer.shadowRoot?.querySelector('img.pixelate-media')?.getAttribute('src') || '').not.toContain('/pix:');

    renderer.remove();
  });
});
