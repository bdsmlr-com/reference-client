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
    const activityGridSrc = read('activity-grid.ts');
    const helperSrc = readFileSync(join(process.cwd(), 'src/services/card-overlay.ts'), 'utf8');

    expect(helperSrc).toContain('renderCardOverlayLink');
    expect(helperSrc).toContain('shouldLetBrowserHandleCardLink');
    for (const src of [postCardSrc, feedItemSrc, groupCardSrc, activityGridSrc]) {
      expect(src).toContain("from '../services/card-overlay.js'");
      expect(src).toContain('renderCardOverlayLink(');
      expect(src).toContain('shouldLetBrowserHandleCardLink(');
    }
  });

  it('keeps SPA routing only for plain left-clicks', () => {
    const postCardSrc = read('post-card.ts');
    const feedItemSrc = read('post-feed-item.ts');
    const groupCardSrc = read('search-group-card.ts');

    expect(postCardSrc).toContain('shouldLetBrowserHandleCardLink(event)');
    expect(postCardSrc).toContain('this.handleClick();');
    expect(feedItemSrc).toContain('shouldLetBrowserHandleCardLink(event)');
    expect(feedItemSrc).toContain('this.handlePostClick();');
    expect(groupCardSrc).toContain('shouldLetBrowserHandleCardLink(event)');
    expect(groupCardSrc).toContain('this.handleClick();');
    expect(read('activity-grid.ts')).toContain('shouldLetBrowserHandleCardLink(event)');
    expect(read('activity-grid.ts')).toContain('this.handleClick();');
  });

  it('uses surface-driven click zones so large timeline cards only bind the media area', () => {
    const feedItemSrc = read('post-feed-item.ts');
    const presentationSrc = readFileSync(join(process.cwd(), 'src/services/post-presentation.ts'), 'utf8');

    expect(feedItemSrc).toContain("const useMediaClickZone = presentation.layout.clickZone === 'media'");
    expect(feedItemSrc).toContain('<div class="media-container">');
    expect(presentationSrc).toContain("clickZone: ctx.surface === 'timeline' ? 'media' : 'card'");
  });
  it('disables overlay links while media has failed so retry remains clickable', () => {
    const helperSrc = readFileSync(join(process.cwd(), 'src/services/card-overlay.ts'), 'utf8');
    const mediaSrc = readFileSync(join(process.cwd(), 'src/components/media-renderer.ts'), 'utf8');
    const postCardSrc = read('post-card.ts');
    const feedItemSrc = read('post-feed-item.ts');
    const groupCardSrc = read('search-group-card.ts');
    const activityGridSrc = read('activity-grid.ts');

    expect(mediaSrc).toContain("this.dispatchEvent(new CustomEvent('media-state-change'");
    expect(helperSrc).toContain('mediaFailed');
    for (const src of [postCardSrc, feedItemSrc, groupCardSrc, activityGridSrc]) {
      expect(src).toContain('@media-state-change=${this.handleMediaStateChange}');
      expect(src).toContain('this.mediaFailed');
    }
  });

});
