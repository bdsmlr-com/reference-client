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
    expect(feedSrc).toContain('.showActorInCluster=${true}');
    expect(postsSrc).toContain('.showActorInCluster=${false}');
  });

  it('following view augments merged posts with interaction clusters and filter pills', () => {
    const feedSrc = readFileSync(join(ROOT, 'pages/view-feed.ts'), 'utf8');

    expect(feedSrc).toContain('fetchInteractionClusters');
    expect(feedSrc).toContain('apiClient.posts.list({');
    expect(feedSrc).toContain('<activity-kind-pills');
  });

  it('timeline stream renders compact clusters and full posts', () => {
    const streamSrc = readFileSync(join(ROOT, 'components/timeline-stream.ts'), 'utf8');

    expect(streamSrc).toContain('item.type === 1 && item.post');
    expect(streamSrc).toContain('item.type === 2 && item.cluster');
    expect(streamSrc).toContain('<activity-grid');
    expect(streamSrc).toContain('<result-group');
    expect(streamSrc).toContain('showActorInCluster');
    expect(streamSrc).toContain('@post-click=');
    expect(streamSrc).not.toContain('@post-select=');
  });

  it('groups like/comment interactions into local-date activity cards', () => {
    const streamSrc = readFileSync(join(ROOT, 'components/timeline-stream.ts'), 'utf8');

    expect(streamSrc).toContain('getInteractionUnix(post)');
    expect(streamSrc).toContain('post.updatedAtUnix');
    expect(streamSrc).toContain('const label = `Activity on ${bucket.dateKey} : ❤️ ${bucket.likeCount} . 💬 ${bucket.commentCount}${actorSuffix}`;');
    expect(streamSrc).toContain("if (kind !== 'like' && kind !== 'comment')");
  });

  it('supports per-card load more for date-grouped activity cards', () => {
    const streamSrc = readFileSync(join(ROOT, 'components/timeline-stream.ts'), 'utf8');

    expect(streamSrc).toContain('clusterVisibleCounts = new Map<string, number>()');
    expect(streamSrc).toContain('clusterVisibleCounts.set(key, this.clusterPageSize)');
    expect(streamSrc).toContain("@result-group-load-more=${() => this.loadMoreInCluster(bucket.key)}");
  });

  it('deduplicates same post within a date bucket across like/comment clusters', () => {
    const streamSrc = readFileSync(join(ROOT, 'components/timeline-stream.ts'), 'utf8');

    expect(streamSrc).toContain('interactionIndex: new Map<number, number>()');
    expect(streamSrc).toContain('const existingIndex = bucket.interactionIndex.get(postId);');
    expect(streamSrc).toContain("if (existingIndex === undefined)");
  });

  it('renders reblog cluster interactions as full-size feed cards', () => {
    const streamSrc = readFileSync(join(ROOT, 'components/timeline-stream.ts'), 'utf8');

    expect(streamSrc).toContain("if (kind === 'reblog')");
    expect(streamSrc).toContain('_activityCreatedAtUnix');
    expect(streamSrc).toContain("type: 'post'");
  });

  it('sorts mixed reblog cards and interaction buckets by newest timestamp', () => {
    const streamSrc = readFileSync(join(ROOT, 'components/timeline-stream.ts'), 'utf8');

    expect(streamSrc).toContain('latestInteractionUnix');
    expect(streamSrc).toContain('item.post._activityCreatedAtUnix || item.post.createdAtUnix || 0');
    expect(streamSrc).toContain('renderable.sort((a, b) => this.getRenderableTimestamp(b) - this.getRenderableTimestamp(a));');
  });

  it('classifies variant=2 timeline posts as reblogs', () => {
    const streamSrc = readFileSync(join(ROOT, 'components/timeline-stream.ts'), 'utf8');

    expect(streamSrc).toContain('presentation.identity.isReblog ? \'reblog\' : \'post\'');
    expect(streamSrc).toContain('presentation.identity.allowSelfSameDayLikeSuppression');
  });

  it('syncs activity kind filters into posts URL state', () => {
    const postsSrc = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');

    expect(postsSrc).toContain("getUrlParam('activity')");
    expect(postsSrc).toContain('activity:');
  });
});
