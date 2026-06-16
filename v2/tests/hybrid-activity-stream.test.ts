import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePostRenderPolicy } from '../src/services/post-render-policy';

const ROOT = join(process.cwd(), 'src');

describe('hybrid activity stream', () => {
  it('resolves post render policy with layered precedence', () => {
    const resolved = resolvePostRenderPolicy({
      view: 'activity',
      role: 'admin',
      env: 'staging',
    });

    expect(resolved).toBeDefined();
    expect(typeof resolved.showPermalink).toBe('boolean');
  });

  it('adds activity kind preferences for following and blog activity streams', () => {
    const src = readFileSync(join(ROOT, 'services/profile.ts'), 'utf8');

    expect(src).toContain('FOLLOWING_ACTIVITY_KINDS_KEY');
    expect(src).toContain('BLOG_ACTIVITY_KINDS_KEY');
    expect(src).toContain('getFollowingActivityKindsPreference');
    expect(src).toContain('setFollowingActivityKindsPreference');
    expect(src).toContain('getBlogActivityKindsPreference');
    expect(src).toContain('setBlogActivityKindsPreference');
  });

  it('uses shared timeline stream in both following and activity views', () => {
    const feedSrc = readFileSync(join(ROOT, 'pages/view-feed.ts'), 'utf8');
    const postsSrc = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');

    expect(feedSrc).toContain('<timeline-stream');
    expect(postsSrc).toContain('<timeline-stream');
    expect(feedSrc).toContain('.interactionGroupingMode=${this.timelineRoute.interactionGroupingMode}');
    expect(feedSrc).toContain('.activityCardVariant=${this.timelineRoute.activityCardVariant}');
    expect(postsSrc).toContain('.interactionGroupingMode=${this.timelineRoute.interactionGroupingMode}');
    expect(postsSrc).toContain('.activityCardVariant=${this.timelineRoute.activityCardVariant}');
  });

  it('following view augments merged posts with interaction clusters and shared control wiring', () => {
    const feedSrc = readFileSync(join(ROOT, 'pages/view-feed.ts'), 'utf8');

    expect(feedSrc).toContain('fetchInteractionClusters');
    expect(feedSrc).toContain('apiClient.posts.list({');
    expect(feedSrc).toContain('<control-panel');
    expect(feedSrc).toContain('.showActivityKinds=${true}');
    expect(feedSrc).toContain('.showTypes=${true}');
  });

  it('timeline stream renders compact clusters and full posts', () => {
    const streamSrc = readFileSync(join(ROOT, 'components/timeline-stream.ts'), 'utf8');

    expect(streamSrc).toContain('item.type === 1 && item.post');
    expect(streamSrc).toContain('item.type === 2 && item.cluster');
    expect(streamSrc).toContain('<activity-grid');
    expect(streamSrc).toContain('<result-group');
    expect(streamSrc).toContain('activityCardVariant');
    expect(streamSrc).toContain('interactionGroupingMode');
    expect(streamSrc).toContain('@activity-click=');
    expect(streamSrc).toContain('@post-select=');
  });

  it('groups like/comment interactions into local-date activity cards', () => {
    const renderingSrc = readFileSync(join(ROOT, 'services/timeline-rendering.ts'), 'utf8');

    expect(renderingSrc).toContain('getTimelineInteractionUnix(post)');
    expect(renderingSrc).toContain('post.updatedAtUnix');
    expect(renderingSrc).toContain("const actorBoundaryKey = args.interactionGroupingMode === 'date+actor' ? interactionEvent.actorKey : '';");
    expect(renderingSrc).toContain("if (kind !== 'like' && kind !== 'comment') {");
  });

  it('supports per-card load more for date-grouped activity cards', () => {
    const streamSrc = readFileSync(join(ROOT, 'components/timeline-stream.ts'), 'utf8');

    expect(streamSrc).toContain('clusterVisibleCounts = new Map<string, number>()');
    expect(streamSrc).toContain('clusterVisibleCounts.set(key, this.clusterPageSize)');
    expect(streamSrc).toContain("@result-group-load-more=${() => this.loadMoreInCluster(bucket.key)}");
  });

  it('deduplicates same post within a date bucket across like/comment clusters', () => {
    const renderingSrc = readFileSync(join(ROOT, 'services/timeline-rendering.ts'), 'utf8');

    expect(renderingSrc).toContain('interactionIndex: new Map<string, number>()');
    expect(renderingSrc).toContain('const existingIndex = run.interactionIndex.get(dedupKey);');
    expect(renderingSrc).toContain("if (existingIndex === undefined) {");
  });

  it('renders reblog cluster interactions as full-size feed cards', () => {
    const renderingSrc = readFileSync(join(ROOT, 'services/timeline-rendering.ts'), 'utf8');

    expect(renderingSrc).toContain("if (kind === 'reblog') {");
    expect(renderingSrc).toContain('_activityCreatedAtUnix');
    expect(renderingSrc).toContain("renderable.push({ type: 'post', post: event.post });");
  });

  it('sorts mixed reblog cards and interaction buckets by newest timestamp', () => {
    const renderingSrc = readFileSync(join(ROOT, 'services/timeline-rendering.ts'), 'utf8');

    expect(renderingSrc).toContain('latestInteractionUnix');
    expect(renderingSrc).toContain('events.sort((a, b) => {');
    expect(renderingSrc).toContain('if (b.ts !== a.ts) return b.ts - a.ts;');
  });

  it('classifies variant=2 timeline posts as reblogs', () => {
    const renderingSrc = readFileSync(join(ROOT, 'services/timeline-rendering.ts'), 'utf8');

    expect(renderingSrc).toContain("presentation.identity.isReblog ? 'reblog' : 'post'");
    expect(renderingSrc).toContain('presentation.identity.allowSelfSameDayLikeSuppression');
  });

  it('syncs activity kind filters into posts URL state', () => {
    const postsSrc = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');

    expect(postsSrc).toContain("getUrlParam('activity')");
    expect(postsSrc).toContain('buildTimelineRouteQueryParams');
  });
});
