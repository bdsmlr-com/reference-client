import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src/components');

describe('post action surfaces', () => {
  it('enables post-actions on blog and feed timeline cards through the explicit showActions flag', () => {
    const streamSrc = readFileSync(join(ROOT, 'timeline-stream.ts'), 'utf8');
    const itemSrc = readFileSync(join(ROOT, 'post-feed-item.ts'), 'utf8');
    expect(streamSrc).toContain(".showActions=${this.page === 'activity' || this.page === 'feed' || this.page === 'follower-feed'}");
    expect(itemSrc).toContain("@property({ type: Boolean }) showActions = false;");
    expect(itemSrc).toContain('<post-actions variant="card" .post=${post}></post-actions>');
  });

  it('keeps delete as a detail-only action in post-actions', () => {
    const src = readFileSync(join(ROOT, 'post-actions.ts'), 'utf8');
    expect(src).toContain("this.variant === 'detail'");
    expect(src).toContain('deletePostRequest');
    expect(src).toContain('Delete post ${post.id}?');
  });
});
