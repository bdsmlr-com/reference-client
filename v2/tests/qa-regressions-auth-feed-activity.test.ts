import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('QA regressions: auth, feed, activity semantics', () => {
  it('does not prefill home login with hardcoded fallback blog names', () => {
    const homeSrc = readFileSync(join(ROOT, 'pages/view-home.ts'), 'utf8');

    expect(homeSrc).toContain('getCurrentUsername');
    expect(homeSrc).not.toContain("this.blogName = (storedBlog && !isReservedPageRoute(storedBlog)) ? storedBlog : 'nonnudecuties';");
  });

  it('clears following feed state when resolving a blog with empty follow graph', () => {
    const feedSrc = readFileSync(join(ROOT, 'pages/view-feed.ts'), 'utf8');

    expect(feedSrc).toContain('this.sourceBlogIds = [];');
    expect(feedSrc).toContain('this.sourceCount = 0;');
    expect(feedSrc).toContain('this.timelineItems = [];');
  });

  it('links feed following-count text to the social following tab', () => {
    const feedSrc = readFileSync(join(ROOT, 'pages/view-feed.ts'), 'utf8');
    const config = readFileSync(join(process.cwd(), 'media-config.json'), 'utf8');

    expect(feedSrc).toContain('resolveLink(this.relationshipLinkContext');
    expect(config).toContain('"feed_following_list"');
    expect(config).toContain('/{blog}/social?tab=following');
    expect(feedSrc).toContain("private get relationshipLinkContext(): 'feed_following_list' | 'feed_followers_list'");
    expect(config).toContain('"feed_followers_list"');
    expect(config).toContain('/{blog}/social?tab=followers');
  });

  it('generalizes feed pages for following and follower modes', () => {
    const feedSrc = readFileSync(join(ROOT, 'pages/view-feed.ts'), 'utf8');
    const appRootSrc = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');

    expect(feedSrc).toContain("@property({ type: String }) mode: 'following' | 'followers' = 'following';");
    expect(feedSrc).toContain("private get relationshipDirection(): 1 | 2");
    expect(feedSrc).toContain("return this.isFollowerFeed ? 2 : 1;");
    expect(feedSrc).toContain("return this.isFollowerFeed ? 'followers' : 'following';");
    expect(feedSrc).toContain("Showing posts from");
    expect(feedSrc).toContain("this.relationshipSummarySuffix");
    expect(feedSrc).toContain("page=${this.isFollowerFeed ? 'follower-feed' : 'feed'}");
    expect(appRootSrc).toContain("path: '/follower-feed/:blogname'");
    expect(appRootSrc).toContain("<view-feed .blog=${this.resolveRouteBlogName(blogname || '')} .mode=${'followers'}></view-feed>");
  });

  it('keeps activity URLs focused on activity filters only', () => {
    const postsSrc = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');

    expect(postsSrc).not.toContain('sort: this.sortValue');
    expect(postsSrc).not.toContain('blog: this.blog');
    expect(postsSrc).toContain('buildTimelineRouteQueryParams');
  });

  it('guards activity timeline state against stale async responses', () => {
    const postsSrc = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');

    expect(postsSrc).toContain('private activeRequestToken = 0;');
    expect(postsSrc).toContain('const requestToken = ++this.activeRequestToken;');
    expect(postsSrc).toContain('if (requestToken !== this.activeRequestToken) return;');
  });

  it('hides self-like/comment actor chips in activity matrices and preserves reblog origin chips', () => {
    const streamSrc = readFileSync(join(ROOT, 'components/timeline-stream.ts'), 'utf8');
    const gridSrc = readFileSync(join(ROOT, 'components/activity-grid.ts'), 'utf8');

    expect(streamSrc).toContain('shouldSuppressSelfSameDayLike');
    expect(streamSrc).toContain('.showBlogChip=${!this.showActorInCluster}');
    expect(streamSrc).toContain('<result-group');
    expect(gridSrc).toContain('const shouldHideSelfInteractionChip =');
    expect(gridSrc).toContain("this.interactionType === 'like' || this.interactionType === 'comment'");
    expect(gridSrc).toContain('const chipBlogName = presentation.identity.chipBlogLabel;');
  });

  it('feed interaction clusters request only likes/comments, reject reblogs, and promote self-interactions to full cards', () => {
    const feedSrc = readFileSync(join(ROOT, 'pages/view-feed.ts'), 'utf8');

    expect(feedSrc).toContain("activity_kinds: ['like', 'comment']");
    expect(feedSrc).toContain("if (kind !== 'like' && kind !== 'comment') return;");
    expect(feedSrc).toContain("if (label.includes('reblog')) return 'reblog';");
    expect(feedSrc).toContain('const selfInteractionPosts = new Map<number, ProcessedPost>();');
    expect(feedSrc).toContain("import { toPresentationModel } from '../services/post-presentation.js';");
    expect(feedSrc).toContain("const processedPost: ProcessedPost = {");
    expect(feedSrc).toContain("const presentation = toPresentationModel(processedPost, { surface: 'card', page: 'activity', interactionKind: kind, role: 'cluster' });");
    expect(feedSrc).toContain('const isCanonicalPostCard = presentation.identity.isCanonicalCard;');
    expect(feedSrc).toContain('post.blogId === blogId && isCanonicalPostCard');
    expect(feedSrc).toContain('_activityCreatedAtUnix: post.updatedAtUnix || post.createdAtUnix');
    expect(feedSrc).toContain('_activityKindOverride: kind');
    expect(feedSrc).toContain("selfInteractionPosts.forEach((post) => clusters.push({ type: 1, post }));");
    expect(readFileSync(join(ROOT, 'components/timeline-stream.ts'), 'utf8')).toContain('if (p._activityKindOverride) return p._activityKindOverride;');
  });

  it('renders tag chips in post detail pages/lightbox cards', () => {
    const detailSrc = readFileSync(join(ROOT, 'components/post-detail-content.ts'), 'utf8');

    expect(detailSrc).toContain('class="post-tags"');
    expect(detailSrc).toContain('buildContextualTagSearchHref');
  });

  it('shows self-activity badge on promoted full cards', () => {
    const feedCardSrc = readFileSync(join(ROOT, 'components/post-feed-item.ts'), 'utf8');

    expect(feedCardSrc).toContain('self-activity-badge');
    expect(feedCardSrc).toContain('❤️ Self-liked');
    expect(feedCardSrc).toContain('💬 Self-commented');
    expect(feedCardSrc).toContain("post._activityKindOverride === 'like'");
    expect(feedCardSrc).toContain("post._activityKindOverride === 'comment'");
  });
});
