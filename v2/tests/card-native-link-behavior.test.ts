import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src/components');

function read(name: string): string {
  return readFileSync(join(ROOT, name), 'utf8');
}

describe('native card link behavior', () => {
  it('uses real overlay anchors so cards support browser-native tab and window gestures', () => {
    const postCardSrc = read('post-card.ts');
    const feedItemSrc = read('post-feed-item.ts');
    const groupCardSrc = read('search-group-card.ts');

    for (const src of [postCardSrc, feedItemSrc, groupCardSrc]) {
      expect(src).toContain('class="card-overlay-link"');
      expect(src).toContain('event.metaKey || event.ctrlKey || event.shiftKey || event.altKey');
      expect(src).toContain('event.preventDefault();');
      expect(src).toContain('z-index: 2;');
    }
  });

  it('keeps SPA routing only for plain left-clicks', () => {
    const postCardSrc = read('post-card.ts');
    const feedItemSrc = read('post-feed-item.ts');
    const groupCardSrc = read('search-group-card.ts');

    expect(postCardSrc).toContain('event.button !== 0');
    expect(postCardSrc).toContain('this.handleClick();');
    expect(feedItemSrc).toContain('event.button !== 0');
    expect(feedItemSrc).toContain('this.handlePostClick();');
    expect(groupCardSrc).toContain('event.button !== 0');
    expect(groupCardSrc).toContain('this.handleClick();');
  });

  it('uses surface-driven click zones so large timeline cards only bind the media area', () => {
    const feedItemSrc = read('post-feed-item.ts');
    const presentationSrc = readFileSync(join(process.cwd(), 'src/services/post-presentation.ts'), 'utf8');

    expect(feedItemSrc).toContain("const useMediaClickZone = presentation.layout.clickZone === 'media'");
    expect(feedItemSrc).toContain('<div class="media-container">');
    expect(presentationSrc).toContain("clickZone: ctx.surface === 'timeline' ? 'media' : 'card'");
  });
});
