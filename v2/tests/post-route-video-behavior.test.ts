import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('post route media behavior', () => {
  it('view-post disables lightbox click path for the top card', () => {
    const src = readFileSync(join(process.cwd(), 'src/pages/view-post.ts'), 'utf8');
    expect(src).toContain('<post-feed-item');
    expect(src).toContain('.disableClick=${true}');
    expect(src).not.toContain('@post-click=${this.handlePostClick}');
  });

  it('post-feed-item forwards post-detail video flags to media-renderer', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/post-feed-item.ts'), 'utf8');
    expect(src).toContain('@property({ type: Boolean }) disableClick = false;');
    expect(src).toContain('.autoplayVideo=${this.videoAutoplay}');
    expect(src).toContain('.controlsVideo=${this.videoControls}');
    expect(src).toContain('.loopVideo=${this.videoLoop}');
    expect(src).toContain(".type=${this.mediaRenderType}");
    expect(src).toContain("const rawUrl = media.type === 'video'");
    expect(src).toContain('? (media.videoUrl || media.url)');
    expect(src).toContain('.posterSrc=${posterSrc}');
  });

  it('media-renderer supports post-detail video mode defaults', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/media-renderer.ts'), 'utf8');
    expect(src).toContain("this.type === 'post-detail'");
    expect(src).toContain('controls=${effectiveControls}');
    expect(src).toContain('autoplay=${effectiveAutoplay}');
    expect(src).toContain('loop=${effectiveLoop}');
    expect(src).toContain('@property({ type: String }) posterSrc');
    expect(src).toContain("const effectivePreload = (effectiveAutoplay || this.type === 'post-detail') ? 'metadata' : 'none';");
  });

  it('media-renderer keeps video as the only visible media surface (no overlay poster hack)', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/media-renderer.ts'), 'utf8');
    expect(src).not.toContain('poster-overlay');
    expect(src).not.toContain('video-wrap');
  });

  it('lightbox forwards video poster source to media-renderer', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/post-lightbox.ts'), 'utf8');
    expect(src).toContain(".posterSrc=${media.type === 'video' ? media.url : undefined}");
  });
});
