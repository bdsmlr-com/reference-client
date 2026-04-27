import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src/components');

describe('post wrapper context', () => {
  it('post-feed forwards explicit page context into post-feed-item', () => {
    const src = readFileSync(join(ROOT, 'post-feed.ts'), 'utf8');

    expect(src).toContain("@property({ type: String }) page: 'feed' | 'archive' | 'search' | 'activity' | 'post' | 'social' = 'feed';");
    expect(src).toContain('<post-feed-item .post=${post} .page=${this.page} @post-select=${this.handlePostSelect}></post-feed-item>');
  });

  it('post-grid forwards explicit mode and re-emits post-click through activity-grid', () => {
    const src = readFileSync(join(ROOT, 'post-grid.ts'), 'utf8');

    expect(src).toContain("@property({ type: String }) page: 'feed' | 'archive' | 'search' | 'activity' | 'post' | 'social' = 'archive';");
    expect(src).toContain("@property({ type: String, reflect: true }) mode: 'grid' | 'masonry' = 'grid';");
    expect(src).toContain('<activity-grid');
    expect(src).toContain('.mode=${this.mode}');
    expect(src).toContain("@activity-click=${this.handleActivityClick}");
  });
});
