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

  it('post-grid forwards explicit page context into post-card', () => {
    const src = readFileSync(join(ROOT, 'post-grid.ts'), 'utf8');

    expect(src).toContain("@property({ type: String }) page: 'feed' | 'archive' | 'search' | 'activity' | 'post' | 'social' = 'archive';");
    expect(src).toContain('<post-card .post=${post} .page=${this.page} @post-select=${this.handlePostSelect}></post-card>');
  });
});
