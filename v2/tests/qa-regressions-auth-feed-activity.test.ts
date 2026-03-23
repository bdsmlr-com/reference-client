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

    expect(feedSrc).toContain('this.followingBlogIds = [];');
    expect(feedSrc).toContain('this.followingCount = 0;');
    expect(feedSrc).toContain('this.timelineItems = [];');
  });

  it('links feed following-count text to the social following tab', () => {
    const feedSrc = readFileSync(join(ROOT, 'pages/view-feed.ts'), 'utf8');
    const config = readFileSync(join(process.cwd(), 'media-config.json'), 'utf8');

    expect(feedSrc).toContain("resolveLink('feed_following_list'");
    expect(config).toContain('"feed_following_list"');
    expect(config).toContain('/{blog}/social?tab=following');
  });

  it('does not force blog query params when activity route already includes blog path', () => {
    const postsSrc = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');

    expect(postsSrc).toContain('if (!isBlogInPath()) {');
    expect(postsSrc).not.toContain('setUrlParams({\n      sort: this.sortValue,\n      activity: this.activityKinds.join(\',\') === DEFAULT_ACTIVITY_KINDS.join(\',\') ? \'\' : this.activityKinds.join(\',\'),\n      blog: this.blog,');
  });

  it('filters self-like same-day interactions and preserves origin chip for reblog activity cards', () => {
    const streamSrc = readFileSync(join(ROOT, 'components/timeline-stream.ts'), 'utf8');
    const gridSrc = readFileSync(join(ROOT, 'components/activity-grid.ts'), 'utf8');

    expect(streamSrc).toContain('shouldSuppressSelfSameDayLike');
    expect(gridSrc).toContain('const chipBlogName =');
    expect(gridSrc).toContain('p.originBlogName');
  });

  it('renders tag chips in post detail pages/lightbox cards', () => {
    const detailSrc = readFileSync(join(ROOT, 'components/post-detail-content.ts'), 'utf8');

    expect(detailSrc).toContain('class="post-tags"');
    expect(detailSrc).toContain("resolveLink('search_tag'");
  });
});
