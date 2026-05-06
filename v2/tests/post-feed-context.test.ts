import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('post feed context', () => {
  it('lets post-feed-item derive presentation from an explicit page context', () => {
    const src = readFileSync(join(ROOT, 'components/post-feed-item.ts'), 'utf8');

    expect(src).toContain("import { toPresentationModel } from '../services/post-presentation.js';");
    expect(src).toContain("@property({ type: String }) page: 'feed' | 'archive' | 'search' | 'activity' | 'post' | 'social' = 'feed';");
    expect(src).toContain("const presentation = toPresentationModel(post, {");
    expect(src).toContain("surface: this.page === 'post' ? 'detail' : 'timeline'");
    expect(src).toContain("page: this.page === 'activity' ? 'activity' : this.page");
    expect(src).toContain("const from: PostRouteSource = this.page === 'post' ? 'direct' : this.page;");
    expect(src).toContain('EventNames.POST_SELECT');
    expect(src).toContain("detail: { post: this.post, from },");
    expect(src).toContain('presentation.identity.postTypeIcon');
    expect(src).not.toContain('POST_TYPE_ICONS[post.type as PostType]');
  });

  it('passes explicit page context from feed, activity, and post routes', () => {
    const feedSrc = readFileSync(join(ROOT, 'pages/view-feed.ts'), 'utf8');
    const postsSrc = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');
    const postSrc = readFileSync(join(ROOT, 'pages/view-post.ts'), 'utf8');
    const streamSrc = readFileSync(join(ROOT, 'components/timeline-stream.ts'), 'utf8');

    expect(feedSrc).toContain('<timeline-stream');
    expect(feedSrc).toContain('.page=${this.timelineRoute.streamPage}');
    expect(feedSrc).toContain("import { toPresentationModel } from '../services/post-presentation.js';");
    expect(feedSrc).toContain("const processedPost: ProcessedPost = {");
    expect(feedSrc).toContain("const presentation = toPresentationModel(processedPost, { surface: 'card', page: 'activity', interactionKind: kind, role: 'cluster' });");
    expect(feedSrc).toContain('const isCanonicalPostCard = presentation.identity.isCanonicalCard;');
    expect(postsSrc).toContain('<timeline-stream');
    expect(postsSrc).toContain('page="activity"');
    expect(postSrc).toContain('<post-feed-item');
    expect(postSrc).toContain('page="post"');
    expect(streamSrc).toContain("@property({ type: String }) page: 'feed' | 'follower-feed' | 'activity' = 'feed';");
    expect(streamSrc).toContain("detail: { post, posts, index: index >= 0 ? index : 0, from },");
  });

  it('uses a simplified shell on the post route instead of repeating body, tags, and footer metadata', () => {
    const feedItemSrc = readFileSync(join(ROOT, 'components/post-feed-item.ts'), 'utf8');
    const detailSrc = readFileSync(join(ROOT, 'components/post-detail-content.ts'), 'utf8');
    const engagementSrc = readFileSync(join(ROOT, 'components/post-engagement.ts'), 'utf8');

    expect(feedItemSrc).toContain("const isPostShell = this.page === 'post';");
    expect(feedItemSrc).toContain("${!isPostShell && bodyText ? html`<div class=\"card-body\">${bodyText}</div>` : ''}");
    expect(feedItemSrc).toContain("${!isPostShell && tags.length > 0 ? html`");
    expect(feedItemSrc).toContain("${!isPostShell ? html`");
    expect(detailSrc).toContain('<post-engagement');
    expect(detailSrc).toContain('.from=${this.from as PostRouteSource}');
    expect(engagementSrc).not.toContain('<div class="lightbox-links">');
    expect(engagementSrc).not.toContain('<div class="meta">Posted');
  });
});
