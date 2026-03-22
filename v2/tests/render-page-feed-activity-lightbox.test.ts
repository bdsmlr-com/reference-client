import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mediaConfig from '../media-config.json';

describe('feed/activity/lightbox render contract usage', () => {
  it('maps pages/cards/interactions from render contract ids', () => {
    const feedSrc = readFileSync(join(process.cwd(), 'src/pages/view-feed.ts'), 'utf8');
    const postsSrc = readFileSync(join(process.cwd(), 'src/pages/view-posts.ts'), 'utf8');
    const streamSrc = readFileSync(join(process.cwd(), 'src/components/timeline-stream.ts'), 'utf8');
    const lightboxSrc = readFileSync(join(process.cwd(), 'src/components/post-lightbox.ts'), 'utf8');
    const render = (mediaConfig as any).render;

    expect(feedSrc).toContain("import { getPageSlotConfig } from '../services/render-page.js';");
    expect(postsSrc).toContain("import { getPageSlotConfig } from '../services/render-page.js';");
    expect(feedSrc).toContain("getPageSlotConfig('feed', 'main_stream')");
    expect(postsSrc).toContain("getPageSlotConfig('activity', 'main_stream')");
    expect(streamSrc).toContain('buildInteractionHandler');
    expect(streamSrc).toContain('open_lightbox_post');
    expect(lightboxSrc).toContain('buildInteractionHandler');
    expect(lightboxSrc).toContain('open_recommendation_post');

    expect(render.pages.feed.slots.main_stream.loading.cardType).toBe('post_feed');
    expect(render.pages.activity.slots.main_stream.loading.cardType).toBe('post_feed');
    expect(render.interactions.open_lightbox_post.type).toBe('open_lightbox');
    expect(render.interactions.open_recommendation_post.type).toBe('navigate');
  });
});
