import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('hybrid activity stream', () => {
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
    expect(streamSrc).toContain('showActorInCluster');
  });
});
