// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('media-renderer client redaction', () => {
  it('wraps redacted card media in a shell and keeps video alternates', async () => {
    const { MediaRenderer } = await import('../src/components/media-renderer.js');
    const renderer = new MediaRenderer();
    renderer.src = '/uploads/clear.jpg';
    renderer.alternateVideoSrc = '/uploads/clear.mp4';
    renderer.redacted = true;
    renderer.type = 'card';
    renderer.style.objectFit = 'cover';
    document.body.appendChild(renderer);
    await renderer.updateComplete;

    expect(renderer.hasAttribute('redacted')).toBe(true);
    expect(renderer.hasAttribute('redaction-full')).toBe(false);
    const shell = renderer.shadowRoot?.querySelector('.redaction-shell') as HTMLElement | null;
    expect(shell).not.toBeNull();
    // Bridge host → media; happy-dom may leave computed as "inherit" rather than resolving.
    expect(getComputedStyle(shell!).objectFit).toMatch(/^(cover|inherit)$/);
    expect(renderer.shadowRoot?.querySelector('video')).not.toBeNull();

    renderer.remove();
  });

  it('marks feed/detail surfaces as full redaction', async () => {
    const { MediaRenderer } = await import('../src/components/media-renderer.js');
    const renderer = new MediaRenderer();
    renderer.src = '/uploads/clear.jpg';
    renderer.redacted = true;
    renderer.type = 'feed';
    document.body.appendChild(renderer);
    await renderer.updateComplete;

    expect(renderer.hasAttribute('redaction-full')).toBe(true);
    expect(renderer.shadowRoot?.querySelector('.redaction-shell')).not.toBeNull();

    renderer.remove();
  });
});
