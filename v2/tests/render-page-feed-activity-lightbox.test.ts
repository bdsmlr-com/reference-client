import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mediaConfig from '../media-config.json';

describe('feed/activity render contract usage', () => {
  it('maps pages/cards/interactions from render contract ids', () => {
    const feedSrc = readFileSync(join(process.cwd(), 'src/pages/view-feed.ts'), 'utf8');
    const postsSrc = readFileSync(join(process.cwd(), 'src/pages/view-posts.ts'), 'utf8');
    const streamSrc = readFileSync(join(process.cwd(), 'src/components/timeline-stream.ts'), 'utf8');
    const render = (mediaConfig as any).render;

    expect(feedSrc).toContain("import { getPageSlotConfig } from '../services/render-page.js';");
    expect(postsSrc).toContain("import { getPageSlotConfig } from '../services/render-page.js';");
    expect(feedSrc).toContain("getPageSlotConfig('feed', 'main_stream')");
    expect(postsSrc).toContain("getPageSlotConfig('activity', 'main_stream')");
    expect(streamSrc).toContain("detail: { post, posts, index: index >= 0 ? index : 0, from }");
    expect(streamSrc).toContain("const from = this.page === 'follower-feed' ? 'follower-feed' : this.page;");

    expect(render.pages.feed.slots.main_stream.loading.cardType).toBe('post_feed');
    expect(render.pages.activity.slots.main_stream.loading.cardType).toBe('post_feed');
    expect(render.interactions.open_recommendation_post.type).toBe('navigate');
  });
});
